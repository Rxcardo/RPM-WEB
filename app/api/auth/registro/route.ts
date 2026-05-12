import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RegistroExistentePayload = {
  tipo: "existente";
  cedula: string;
  telefono: string;
  email: string;
  password: string;
};

type RegistroNuevoPayload = {
  tipo: "nuevo";
  nombre: string;
  cedula?: string;
  telefono: string;
  email: string;
  fecha_nacimiento?: string | null;
  motivo?: string | null;
};

type Payload = RegistroExistentePayload | RegistroNuevoPayload;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeCedula(value: string) {
  return value.toUpperCase().replace(/\s+/g, "").trim();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    if (!body?.tipo || !["existente", "nuevo"].includes(body.tipo)) {
      return NextResponse.json(
        { ok: false, error: "Tipo de registro inválido." },
        { status: 400 }
      );
    }

    if (body.tipo === "nuevo") {
      const nombre = clean(body.nombre);
      const cedula = normalizeCedula(clean(body.cedula));
      const telefono = normalizePhone(clean(body.telefono));
      const email = clean(body.email).toLowerCase();
      const fecha_nacimiento = body.fecha_nacimiento || null;
      const motivo = clean(body.motivo) || null;

      if (!nombre || !telefono || !email) {
        return NextResponse.json(
          { ok: false, error: "Nombre, teléfono y correo son obligatorios." },
          { status: 400 }
        );
      }

      if (!isEmail(email)) {
        return NextResponse.json(
          { ok: false, error: "Correo inválido." },
          { status: 400 }
        );
      }

      const { data: existente } = await supabaseAdmin
        .from("solicitudes_registro")
        .select("id, estado")
        .eq("email", email)
        .in("estado", ["pendiente", "aprobada"])
        .maybeSingle();

      if (existente) {
        return NextResponse.json(
          {
            ok: false,
            error:
              existente.estado === "pendiente"
                ? "Ya tienes una solicitud pendiente."
                : "Ya existe una solicitud aprobada con este correo.",
          },
          { status: 409 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("solicitudes_registro")
        .insert({
          nombre,
          cedula: cedula || null,
          telefono,
          email,
          fecha_nacimiento,
          motivo,
          estado: "pendiente",
        })
        .select("id")
        .single();

      if (error) throw error;

      return NextResponse.json({
        ok: true,
        tipo: "nuevo",
        solicitud_id: data.id,
        message:
          "Solicitud enviada correctamente. Recepción revisará tus datos.",
      });
    }

    const cedula = normalizeCedula(clean(body.cedula));
    const telefono = normalizePhone(clean(body.telefono));
    const email = clean(body.email).toLowerCase();
    const password = clean(body.password);

    if (!cedula || !telefono || !email || !password) {
      return NextResponse.json(
        {
          ok: false,
          error: "Cédula, teléfono, correo y contraseña son obligatorios.",
        },
        { status: 400 }
      );
    }

    if (!isEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Correo inválido." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "La contraseña debe tener mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    const { data: clientes, error: clienteError } = await supabaseAdmin
      .from("clientes")
      .select("id, nombre, telefono, email, cedula, estado, auth_user_id")
      .eq("cedula", cedula)
      .limit(5);

    if (clienteError) throw clienteError;

    const cliente = clientes?.find((c) => {
      const telDb = normalizePhone(c.telefono || "");
      return telDb === telefono;
    });

    if (!cliente) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tus datos no coinciden con recepción. Verifica cédula y teléfono.",
        },
        { status: 404 }
      );
    }

    if (cliente.estado === "eliminado") {
      return NextResponse.json(
        {
          ok: false,
          error: "Este cliente no está activo. Contacta recepción.",
        },
        { status: 403 }
      );
    }

    if (cliente.auth_user_id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este cliente ya tiene acceso al portal.",
        },
        { status: 409 }
      );
    }

    const { data: createdUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre: cliente.nombre,
          cliente_id: cliente.id,
          rol: "cliente",
        },
      });

    if (authError) {
      return NextResponse.json(
        {
          ok: false,
          error: authError.message || "No se pudo crear el usuario.",
        },
        { status: 400 }
      );
    }

    const userId = createdUser.user.id;

    const { error: updateClienteError } = await supabaseAdmin
      .from("clientes")
      .update({
        auth_user_id: userId,
        acceso_portal: true,
        email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cliente.id);

    if (updateClienteError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw updateClienteError;
    }

    const { error: perfilError } = await supabaseAdmin
      .from("perfiles_usuario")
      .insert({
        id: userId,
        rol: "cliente",
        cliente_id: cliente.id,
        empleado_id: null,
        activo: true,
      });

    if (perfilError) {
      await supabaseAdmin
        .from("clientes")
        .update({
          auth_user_id: null,
          acceso_portal: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cliente.id);

      await supabaseAdmin.auth.admin.deleteUser(userId);

      throw perfilError;
    }

    return NextResponse.json({
      ok: true,
      tipo: "existente",
      user_id: userId,
      cliente_id: cliente.id,
      message: "Acceso creado correctamente.",
    });
  } catch (error: any) {
    console.error("REGISTRO_ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error interno creando el registro.",
      },
      { status: 500 }
    );
  }
}