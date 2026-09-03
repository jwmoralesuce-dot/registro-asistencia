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
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="text-center mb-6">
          <p className="text-[10px] tracking-widest uppercase font-semibold text-indigo-700">Universidad Central del Ecuador</p>
          <h1 className="text-xl font-bold text-slate-800 mt-1">Portal de Participante</h1>
          <p className="text-xs text-slate-500 mt-1">Ingresa tu número de cédula para ver tu credencial digital.</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-semibold text-center">
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Ej. 1715369664"
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
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="tu.correo@gmail.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-900 text-white font-bold py-3 rounded-xl hover:bg-indigo-800 transition-all shadow-md disabled:opacity-50 text-sm"
          >
            {loading ? "Verificando..." : "Consultar mi Credencial"}
          </button>
        </form>
      </div>
    </main>
  );
}