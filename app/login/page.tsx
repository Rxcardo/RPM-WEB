export default function LoginPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <h1 className="text-3xl font-bold">RPM</h1>
        <p className="mt-2 text-sm text-white/60">
          Panel de acceso del sistema
        </p>

        <form className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/80">Correo</label>
            <input
              type="email"
              placeholder="correo@rpm.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/80">Contraseña</label>
            <input
              type="password"
              placeholder="********"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-500 transition"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  )
}