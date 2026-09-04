"use client";

import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, storage } from "../../lib/firebase"; // Ajusta esta ruta según la ubicación exacta de tu archivo firebase.js
import { useRouter } from "next/navigation";

export default function UserLoginPage() {
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedCedula = cedula.trim();
    const trimmedEmail = email.trim().toLowerCase();

    try {
      // Buscamos al usuario en Firestore por su número de cédula (ID)
      const q = query(collection(db, "users"), where("id", "==", trimmedCedula));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Número de cédula no encontrado en el sistema. Consulta con el administrador.");
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const dbEmail = userData.email ? userData.email.trim().toLowerCase() : "";

      // Validamos si el usuario tiene correo registrado en la base de datos
      if (dbEmail) {
        if (!trimmedEmail) {
          setError("Este usuario tiene un correo registrado. Debes ingresarlo para continuar.");
          setLoading(false);
          return;
        }
        if (trimmedEmail !== dbEmail) {
          setError("El correo electrónico no coincide con el registrado para esta cédula.");
          setLoading(false);
          return;
        }
      } else {
        // Si no tiene correo en la base de datos, no exigimos que llene el campo
        if (trimmedEmail) {
          setError("Este usuario no tiene correo registrado. Deja el campo de correo vacío.");
          setLoading(false);
          return;
        }
      }

      // Guardamos la sesión temporalmente en el navegador del celular y redirigimos al perfil
      localStorage.setItem("userCedula", trimmedCedula);
      router.push("/perfil");

    } catch (err) {
      console.error(err);
      setError("Ocurrió un error al verificar los datos.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-sky-50 flex items-center justify-center px-4 py-8 text-slate-800">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-sky-200 relative overflow-hidden">
        
        {/* Franja superior institucional */}
        <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400" />

        {/* Encabezado e indicador institucional */}
        <div className="text-center my-6">
          {/* LOGO INSTITUCIONAL MÁS GRANDE */}
          <div className="flex justify-center mb-4">
            <img 
              src="/logo_sindicato.png" 
              alt="Logo Sindicato" 
              className="h-24 w-24 object-contain bg-sky-50 rounded-2xl p-2 border border-sky-200 shadow-sm" 
            />
          </div>
          <p className="text-[11px] font-extrabold tracking-widest text-sky-600 uppercase mb-1">
            Universidad Central del Ecuador
          </p>
          <h2 className="text-xs font-semibold text-slate-500 mb-3">
            Sindicato 14 de Noviembre
          </h2>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Portal de Participante
          </h1>
          <p className="text-xs text-slate-500 mt-1">Ingresa tu número de cédula para ver tu credencial digital.</p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Número de Cédula *</label>
            <input
              type="text"
              required
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono shadow-sm"
              placeholder="Ej. 1715035487"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Correo Electrónico <span className="text-slate-400 font-normal">(Si lo registraste)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
              placeholder="tu.correo@gmail.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition-all shadow-md disabled:opacity-50 text-sm"
          >
            {loading ? "Verificando..." : "Consultar mi Credencial"}
          </button>
        </form>

        {/* Pie de tarjeta con autor */}
        <div className="mt-8 pt-4 border-t border-sky-100 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Sistema Oficial de Control de Presencia • UCE
          </p>
          <p className="text-[9px] text-slate-400 tracking-tight mt-0.5">
            Desarrollado por MSc. Jonathan Morales
          </p>
        </div>

      </div>
    </main>
  );
}