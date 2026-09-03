"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export default function UserPerfilPage() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const storedCedula = localStorage.getItem("userCedula");
    if (!storedCedula) {
      router.push("/login");
    } else {
      fetchUserData(storedCedula);
    }
  }, [router]);

  async function fetchUserData(cedulaId) {
    try {
      const docRef = doc(db, "users", cedulaId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setUserData({ id: docSnap.id, ...docSnap.data() });
      } else {
        setUserData(null);
      }
    } catch (err) {
      console.error("Error al obtener datos:", err);
    } finally {
      setLoading(false);
    }
  }

  // Convierte la imagen a Base64 para guardarla directamente en Firestore sin usar Storage
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !userData) return;

    // Validar que no sea muy pesada (máx 1MB para que entre sin problemas en Firestore)
    if (file.size > 1024 * 1024) {
      setStatusMessage("❌ La imagen es muy pesada. Máximo 1MB.");
      return;
    }

    setUploading(true);
    setStatusMessage("Procesando fotografía...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Image = reader.result;

        // Actualizamos el campo 'photo' en Firestore con el texto Base64
        const userRef = doc(db, "users", userData.id);
        await updateDoc(userRef, { photo: base64Image });

        setUserData({ ...userData, photo: base64Image });
        setStatusMessage("✅ ¡Foto actualizada con éxito!");
      } catch (err) {
        console.error(err);
        setStatusMessage("❌ Error al guardar la foto.");
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setUploading(false);
      setStatusMessage("❌ Error al leer el archivo.");
    };
  };

  const handleLogout = () => {
    localStorage.removeItem("userCedula");
    router.push("/login");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-slate-600">Cargando credencial...</div>;
  }

  return (
    <main className="w-full px-4 py-8 flex flex-col items-center justify-start text-slate-900 my-auto">
      <div className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mi Credencial Digital</span>
          <button onClick={handleLogout} className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-200 shadow-sm">
            Salir
          </button>
        </div>

        {userData ? (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-indigo-900 text-white p-4 text-center">
              <p className="text-[10px] tracking-widest uppercase font-semibold text-indigo-200">Universidad Central del Ecuador</p>
              <h2 className="text-sm font-bold tracking-wide mt-0.5">Sindicato 14 de Noviembre</h2>
            </div>

            <div className="p-6">
              <h3 className="text-center font-extrabold text-slate-800 text-base md:text-lg tracking-tight mb-6">
                {userData.name || "NOMBRE DEL USUARIO"}
              </h3>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-28 h-28 rounded-xl overflow-hidden border-2 border-slate-200 shadow bg-slate-100 flex items-center justify-center">
                    {userData.photo ? (
                      <img src={userData.photo} alt="Foto carnet" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-slate-400">
                        {userData.name ? userData.name.charAt(0) : "U"}
                      </span>
                    )}
                  </div>

                  <label className="mt-3 bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-700 transition-all shadow">
                    {uploading ? "Guardando..." : "📷 Tomar o Subir Foto"}
                    <input type="file" accept="image/*" capture="user" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                  </label>
                  {statusMessage && <p className="mt-1 text-[10px] font-semibold text-center text-slate-600 max-w-[140px]">{statusMessage}</p>}
                </div>

                <div className="flex-1 space-y-1.5 text-xs text-slate-700 text-center sm:text-left">
                  <p><strong>Cédula:</strong> <span className="font-mono font-bold">{userData.id}</span></p>
                  <p className="text-indigo-700 font-semibold">{userData.cargo || "Trabajador UCE"}</p>
                  {userData.email && <p className="text-slate-500 text-[11px] break-all">{userData.email}</p>}
                </div>

                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                  <QRCodeSVG value={String(userData.id)} size={90} level="M" />
                  <span className="text-[9px] text-slate-400 mt-1">Código QR</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-100 py-2.5 px-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Credencial Oficial de Asistencia
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 text-center shadow">
            <p className="text-sm text-red-600">No se encontró información asociada a esta sesión.</p>
          </div>
        )}
      </div>
    </main>
  );
}