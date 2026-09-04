"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menuItems = [
    { name: "Inicio de sesión (Login)", href: "/login", icon: "🔑" },
    { name: "Perfil de usuario", href: "/perfil", icon: "👤" },
    { name: "Gestión de Carnés", href: "/admin/carnets", icon: "🪪" },
    { name: "Importar datos", href: "/admin/importar", icon: "📥" },
    { name: "Escáner QR", href: "/admin/scanner", icon: "📷" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/50 to-slate-100 flex items-center justify-center p-4 sm:p-6 text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-sky-950/5 border border-sky-100 overflow-hidden transition-all">
        
        {/* Franja superior institucional tricolor/degradada */}
        <div className="h-2 w-full bg-gradient-to-r from-sky-500 via-amber-400 to-emerald-500" />

        {/* Cabecera / Barra Superior Interna */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-sky-700 uppercase block">
              Universidad Central del Ecuador
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Sindicato 14 de Noviembre
            </span>
          </div>

          {/* Menú Desplegable Profesional */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-xl bg-white hover:bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 border border-sky-200/80 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>Navegación</span>
              <svg className={`w-3 h-3 text-sky-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-sky-100 py-2 z-50">
                <div className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-50 mb-1">
                  Panel de Navegación
                </div>
                <div className="space-y-0.5 px-1.5">
                  {menuItems.map((item, index) => (
                    <Link
                      key={index}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                    >
                      <span className="text-base p-1 bg-sky-50/80 rounded-lg">{item.icon}</span>
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contenido Central */}
        <div className="px-6 py-8 text-center">
          {/* Logo Institucional Centrado */}
          <div className="flex justify-center mb-5">
            <div className="p-3 bg-gradient-to-b from-sky-50 to-white rounded-3xl border border-sky-100 shadow-sm inline-block">
              <img 
                src="/logo_sindicato.png" 
                alt="Logo Sindicato" 
                className="h-24 w-24 object-contain mx-auto" 
              />
            </div>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Registro de Asistencia
          </h1>
          <p className="mt-2 text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Sistema optimizado para el control seguro de asambleas y eventos oficiales.
          </p>

          {/* Botón de Acción Principal */}
          <div className="mt-8">
            <Link
              href="/admin/scanner"
              className="group relative flex items-center justify-center gap-3 w-full rounded-2xl bg-sky-600 hover:bg-sky-700 p-4 text-center font-bold text-white shadow-lg shadow-sky-600/25 transition-all duration-200 transform active:scale-[0.98]"
            >
              <span className="text-xl p-1 bg-white/10 rounded-xl">📷</span>
              <span className="tracking-wide text-sm">Abrir Escáner de Asistencia</span>
            </Link>
          </div>
        </div>

        {/* Pie de Página Profesional */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 text-center space-y-0.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Sistema Oficial de Control de Presencia • UCE
          </p>
          <p className="text-[10px] text-slate-400 font-medium">
            Desarrollado por MSc. Jonathan Morales
          </p>
        </div>

      </div>
    </main>
  );
}