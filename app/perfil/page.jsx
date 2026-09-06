"use client";

import { useEffect, useState } from "react";
import { db } from "../../lib/firebase";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
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
        // Obtenemos los datos y aseguramos que si existe 'foto' antigua, la mapeemos o prioricemos 'photo'
        const data = docSnap.data();
        setUserData({ 
          id: docSnap.id, 
          ...data, 
          photo: data.photo || data.foto || "" 
        });
      } else {
        setUserData(null);
      }
    } catch (err) {
      console.error("Error al obtener datos:", err);
    } finally {
      setLoading(false);
    }
  }

  // Función para comprimir, redimensionar y actualizar la imagen
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !userData) return;

    setUploading(true);
    setStatusMessage("Procesando y optimizando fotografía...");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const base64Image = canvas.toDataURL("image/jpeg", 0.8);

        try {
          const userRef = doc(db, "users", userData.id);
          
          // Guardamos en ambos campos ('photo' y 'foto') por seguridad para evitar conflictos con otras pantallas
          await updateDoc(userRef, { 
            photo: base64Image,
            foto: base64Image 
          });

          // Forzamos la recarga completa desde Firestore para asegurar que se refresque
          await fetchUserData(userData.id);

          setStatusMessage("✅ ¡Foto actualizada con éxito!");
        } catch (err) {
          console.error(err);
          setStatusMessage("❌ Error al guardar la foto en la base de datos.");
        } finally {
          setUploading(false);
        }
      };

      img.onerror = () => {
        setUploading(false);
        setStatusMessage("❌ Error al procesar la imagen.");
      };
    };

    reader.onerror = () => {
      setUploading(false);
      setStatusMessage("❌ Error al leer el archivo.");
    };
  };

  // Función para eliminar la foto actual del perfil
  const handleDeletePhoto = async () => {
    if (!userData || !userData.photo) return;
    if (!confirm("¿Estás seguro de que deseas eliminar tu foto de perfil?")) return;

    setUploading(true);
    setStatusMessage("Eliminando fotografía...");

    try {
      const userRef = doc(db, "users", userData.id);
      
      // Eliminamos ambos campos de Firestore para limpiar la base de datos por completo
      await updateDoc(userRef, { 
        photo: deleteField(),
        foto: deleteField()
      });

      // Recargamos los datos desde Firestore
      await fetchUserData(userData.id);

      setStatusMessage("🗑️ Foto eliminada correctamente.");
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ Error al eliminar la foto.");
    } finally {
      setUploading(false);
    }
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
            {/* ENCABEZADO CON LOGO Y TÍTULOS */}
            <div className="bg-indigo-900 text-white p-4 flex items-center justify-between">
              <img 
                src="/logo_sindicato.png" 
                alt="Logo Sindicato" 
                className="h-16 w-16 object-contain mr-3 bg-white/10 rounded-md p-1 flex-shrink-0" 
              />
              <div className="text-center flex-grow">
                <p className="text-[10px] tracking-widest uppercase font-semibold text-indigo-200">Universidad Central del Ecuador</p>
                <h2 className="text-sm font-bold tracking-wide mt-0.5">Sindicato 14 de Noviembre</h2>
              </div>
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

                  {/* CONTROLES DE FOTO: CAMBIAR / ELIMINAR */}
                  <div className="flex items-center gap-2 mt-3">
                    <label className="bg-indigo-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-700 transition-all shadow">
                      {uploading ? "Procesando..." : userData.photo ? "🔄 Cambiar Foto" : "📷 Subir Foto"}
                      <input type="file" accept="image/*" capture="user" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                    </label>

                    {userData.photo && (
                      <button 
                        onClick={handleDeletePhoto}
                        disabled={uploading}
                        className="bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-red-200 transition-all shadow-sm"
                        title="Eliminar foto actual"
                      >
                        🗑️ Borrar
                      </button>
                    )}
                  </div>

                  {statusMessage && <p className="mt-1 text-[10px] font-semibold text-center text-slate-600 max-w-[150px]">{statusMessage}</p>}
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

            {/* PIE DE PÁGINA CON CREDENCIAL Y AUTOR */}
            <div className="bg-slate-50 border-t border-slate-100 py-2.5 px-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Credencial Oficial de Asistencia
              </p>
              <p className="text-[9px] text-slate-400 tracking-tight mt-0.5">
                Desarrollado por MSc. Jonathan Morales
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