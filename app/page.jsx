import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Sindicato 14 de Noviembre UCE</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Registro de asistencia</h1>
        
        {/* Contenedor del botón único (ya sin la cuadrícula de dos columnas) */}
        <div className="mt-8">
          <Link className="block w-full rounded-lg bg-emerald-700 px-4 py-3 text-center font-semibold text-white hover:bg-emerald-800 transition-colors" href="/admin/scanner">
            Abrir escáner
          </Link>
        </div>
      </section>
    </main>
  );
}