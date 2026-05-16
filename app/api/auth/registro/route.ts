import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type RegistroExistentePayload = {
  tipo: "existente";
  identificador: string; // cédula, teléfono o correo
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
}

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
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeCedula(value: string) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "")
    .trim();
}

function cedulaVariantes(value: string) {
  const raw = normalizeCedula(value);
  const sinPrefijo = raw.replace(/^[VEJPG]-?/i, "");

  return Array.from(
    new Set([
      raw,
      sinPrefijo,
      `V${sinPrefijo}`,
      `V-${sinPrefijo}`,
      `E${sinPrefijo}`,
      `E-${sinPrefijo}`,
      `J${sinPrefijo}`,
      `J-${sinPrefijo}`,
      `P${sinPrefijo}`,
      `P-${sinPrefijo}`,
      `G${sinPrefijo}`,
      `G-${sinPrefijo}`,
    ].filter(Boolean))
  );
}

function phoneMatches(dbPhone: string, inputPhone: string) {
  const a = normalizePhone(dbPhone);
  const b = normalizePhone(inputPhone);

  if (!a || !b) return false;

  return a === b || a.endsWith(b) || b.endsWith(a);
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

      const { data: solicitudExistente, error: solicitudError } =
        await supabaseAdmin
          .from("solicitudes_registro")
          .select("id, estado")
          .eq("email", email)
          .in("estado", ["pendiente", "aprobada"])
          .maybeSingle();

      if (solicitudError) throw solicitudError;

      if (solicitudExistente) {
        return NextResponse.json(
          {
            ok: false,
            error:
              solicitudExistente.estado === "pendiente"
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
        message: "Solicitud enviada correctamente. Recepción revisará tus datos.",
      });
    }

    const identificador = clean(body.identificador);
    const password = clean(body.password);

    if (!identificador || !password) {
      return NextResponse.json(
        { ok: false, error: "Identificador y contraseña son obligatorios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "La contraseña debe tener mínimo 6 caracteres." },
        { status: 400 }
      );
    }

    let cliente: { id: string; nombre: string; telefono: string | null; email: string | null; cedula: string | null; estado: string; auth_user_id: string | null; acceso_portal: boolean } | null = null;

    if (isEmail(identificador)) {
      const emailNorm = identificador.toLowerCase();
      const { data, error: clienteError } = await supabaseAdmin
        .from("clientes")
        .select("id, nombre, telefono, email, cedula, estado, auth_user_id, acceso_portal")
        .eq("email", emailNorm)
        .maybeSingle();
      if (clienteError) throw clienteError;
      cliente = data;
    } else if (/^\+?[\d\s\-\(\)]+$/.test(identificador) && normalizePhone(identificador).length >= 7) {
      const telefonoNorm = normalizePhone(identificador);
      const lastDigits = telefonoNorm.slice(-8);
      const { data: candidatos, error: clienteError } = await supabaseAdmin
        .from("clientes")
        .select("id, nombre, telefono, email, cedula, estado, auth_user_id, acceso_portal")
        .ilike("telefono", `%${lastDigits}`)
        .limit(50);
      if (clienteError) throw clienteError;
      const matches = (candidatos ?? []).filter((c) => phoneMatches(c.telefono || "", telefonoNorm));
      if (matches.length > 1) {
        return NextResponse.json(
          { ok: false, error: "No pudimos identificarte de forma única. Por favor pasa por recepción." },
          { status: 404 }
        );
      }
      cliente = matches[0] ?? null;
    } else {
      const variantes = cedulaVariantes(normalizeCedula(identificador));
      const { data: clientes, error: clienteError } = await supabaseAdmin
        .from("clientes")
        .select("id, nombre, telefono, email, cedula, estado, auth_user_id, acceso_portal")
        .in("cedula", variantes)
        .limit(20);
      if (clienteError) throw clienteError;
      if ((clientes?.length ?? 0) > 1) {
        return NextResponse.json(
          { ok: false, error: "No pudimos identificarte de forma única. Por favor pasa por recepción." },
          { status: 404 }
        );
      }
      cliente = clientes?.[0] ?? null;
    }

    if (!cliente) {
      return NextResponse.json(
        { ok: false, error: "No encontramos tu registro en el sistema. Por favor pasa por recepción." },
        { status: 404 }
      );
    }

    const email = (isEmail(identificador) ? identificador.toLowerCase() : cliente.email?.toLowerCase() ?? "");

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Tu cuenta no tiene correo registrado. Por favor pasa por recepción para completar tus datos." },
        { status: 400 }
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
          error: "Este cliente ya tiene acceso al portal. Inicia sesión.",
        },
        { status: 409 }
      );
    }

    const { data: usuarioExistente } =
      await supabaseAdmin.auth.admin.listUsers();

    const yaExisteAuth = usuarioExistente?.users?.find(
      (u) => u.email?.toLowerCase() === email
    );

    if (yaExisteAuth) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ya existe una cuenta con este correo. Usa otro correo o inicia sesión.",
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

    if (authError || !createdUser.user) {
      return NextResponse.json(
        {
          ok: false,
          error: authError?.message || "No se pudo crear el usuario.",
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
      email,
      message: "Acceso creado correctamente. Ya puedes iniciar sesión.",
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