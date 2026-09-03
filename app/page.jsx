"use client";

import { useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { name: "Inicio de sesión (Login)", href: "/login", icon: "🔑" },
    { name: "Perfil de usuario", href: "/perfil", icon: "👤" },
    { name: "Gestión de Carnés", href: "/admin/carnets", icon: "🪪" },
    { name: "Importar datos", href: "/admin/importar", icon: "📥" },
    { name: "Escáner QR", href: "/admin/scanner", icon: "📷" },
  ];

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 flex items-center justify-center text-slate-800">
      <div className="w-full max-w-md rounded-3xl bg-white border border-sky-200 p-6 sm:p-8 shadow-xl relative overflow-hidden">
        
        {/* Franja superior institucional con los colores claros y limpios del sello */}
        <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400" />

        {/* Encabezado e indicador institucional */}
        <div className="flex items-center justify-between mb-6 pt-2">
          <div>
            <p className="text-[11px] font-extrabold tracking-widest text-sky-600 uppercase">
              Universidad Central del Ecuador
            </p>
            <h2 className="text-xs font-semibold text-slate-500">
              Sindicato 14 de Noviembre
            </h2>
          </div>

          {/* Menú desplegable profesional con diseño claro y elegante */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-xl bg-sky-50 hover:bg-sky-100 px-3.5 py-2 text-xs font-bold text-sky-700 border border-sky-200 shadow-sm transition-all"
            >
              <span>Navegación</span>
              <span className="text-sky-600">▾</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-sky-200 py-2 z-50 divide-y divide-sky-50">
                <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-sky-600/80">
                  Menú de Opciones
                </div>
                <div className="py-1">
                  {menuItems.map((item, index) => (
                    <Link
                      key={index}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Título Principal */}
        <div className="text-center my-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-sky-100 border border-sky-300 flex items-center justify-center text-3xl mb-4 shadow-sm text-sky-600">
            🛡️
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Registro de Asistencia
          </h1>
          <p className="mt-2 text-xs text-slate-500 max-w-xs mx-auto">
            Control institucional rápido y seguro para asambleas y eventos oficiales.
          </p>
        </div>

        {/* Botón Principal (Abrir Escáner) con los tonos claros y vivos del sello */}
        <div className="mt-8 space-y-3">
          <Link
            href="/admin/scanner"
            className="group relative flex items-center justify-center gap-3 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 p-4 text-center font-bold text-white shadow-md shadow-sky-200 hover:from-sky-600 hover:to-sky-700 border border-amber-300/50 transition-all transform active:scale-[0.98]"
          >
            <span className="text-xl">📷</span>
            <span className="tracking-wide text-sm sm:text-base">Abrir Escáner de Asistencia</span>
          </Link>
        </div>

        {/* Pie de tarjeta sutil */}
        <div className="mt-8 pt-4 border-t border-sky-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Sistema Oficial de Control de Presencia • UCE
          </p>
        </div>

      </div>
    </main>
  );
}