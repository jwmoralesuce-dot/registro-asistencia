"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../../lib/firebase"; 
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";

export default function CarnetsPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Estados para el Modal de Agregar / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); 
  const [formData, setFormData] = useState({ id: "", name: "", cargo: "", email: "", foto: "" });
  const [saving, setSaving] = useState(false);

  // 1. Cargar los usuarios desde Firebase al montar el componente
  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList = querySnapshot.docs.map((docItem) => ({
        docId: docItem.id, 
        ...docItem.data(), 
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error al cargar los usuarios:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Filtrar usuarios en tiempo real según el término de búsqueda
  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.id?.toString().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 3. Función para imprimir
  const handlePrint = () => {
    window.print();
  };

  // 4. Funciones de Gestión (Guardar / Editar / Eliminar)
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({ id: "", name: "", cargo: "", email: "", foto: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    setFormData({ 
      id: user.id || "", 
      name: user.name || "", 
      cargo: user.cargo || "", 
      email: user.email || user.correo || "", 
      foto: user.foto || user.photo || user.imagen || user.avatar || "" 
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.id || !formData.name) {
      alert("La cédula (ID) y el nombre son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      const userData = {
        id: formData.id.trim(),
        name: formData.name.trim(),
        cargo: formData.cargo ? formData.cargo.trim() : "",
        email: formData.email ? formData.email.trim() : "",
        foto: formData.foto ? formData.foto.trim() : "",
      };

      if (editingUser) {
        const userRef = doc(db, "users", editingUser.docId);
        await updateDoc(userRef, userData);
      } else {
        await addDoc(collection(db, "users"), userData);
      }
      
      setIsModalOpen(false);
      fetchUsers(); 
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      alert("Hubo un error al guardar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (docId, userName) => {
    if (confirm(`¿Estás seguro de eliminar a ${userName}?`)) {
      try {
        await deleteDoc(doc(db, "users", docId));
        fetchUsers(); 
      } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar el registro.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-2 text-slate-600 font-medium">Cargando carnés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 print:p-0 print:bg-white">
      {/* --- BARRA SUPERIOR (SOLO EN PANTALLA, SE OCULTA AL IMPRIMIR) --- */}
      <div className="mx-auto max-w-7xl mb-8 flex flex-col lg:flex-row justify-between items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Carnés y Miembros</h1>
          <p className="text-sm text-slate-600">
            Total de registros: {users.length} usuarios
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Buscar por nombre, cédula o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            ➕ Nuevo Miembro
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            🖨️ Imprimir Carnés
          </button>
          <Link
            href="/admin/scanner"
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 transition-colors shadow-sm whitespace-nowrap"
          >
            Volver al Escáner
          </Link>
        </div>
      </div>

      {/* --- CUADRÍCULA DE CARNÉS --- */}
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1 print:gap-4 print:space-y-0">
        {filteredUsers.map((user) => {
          const fullName = user.name || "Sin Nombre";
          const userId = user.id; 
          const userEmail = user.email || user.correo;
          // Captura la foto sin importar cómo esté nombrada en la BD
          const userPhoto = user.foto || user.photo || user.imagen || user.avatar;

          return (
            <div
              key={user.docId}
              className="relative bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col justify-between print:shadow-none print:border print:border-slate-400 print:rounded-none print:h-[7.4cm] print:w-[10.5cm] print:break-inside-avoid group"
            >
              {/* Botones de Administrar en la tarjeta (Solo pantalla) */}
              <div className="absolute top-2 right-2 flex gap-1 bg-white/90 p-1 rounded-md shadow-sm opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-10">
                <button
                  onClick={() => handleOpenEditModal(user)}
                  className="p-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
                  title="Editar miembro"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => handleDeleteUser(user.docId, fullName)}
                  className="p-1.5 text-xs bg-rose-600 text-white rounded hover:bg-rose-700 font-medium"
                  title="Eliminar miembro"
                >
                  🗑️ Eliminar
                </button>
              </div>

              {/* --- ENCABEZADO DEL CARNÉ --- */}
              <div className="bg-gradient-to-r from-indigo-700 to-indigo-900 px-3 py-2 text-white flex items-center justify-between print:bg-indigo-800 print:py-1.5">
                <img 
                  src="/logo_sindicato.png" 
                  alt="Logo Sindicato" 
                  className="h-16 w-16 object-contain mr-3 bg-white/10 rounded-md p-1 flex-shrink-0" 
                />
                <div className="text-center flex-grow">
                  <p className="text-xs uppercase tracking-wider font-semibold text-indigo-200 print:text-[11px]">
                    Universidad Central del Ecuador
                  </p>
                  <h2 className="text-base font-bold leading-tight print:text-[14px]">
                    Sindicato 14 de Noviembre
                  </h2>
                </div>
              </div>

              {/* --- CUERPO DEL CARNÉ --- */}
              <div className="p-4 flex flex-col justify-between flex-grow print:p-4">
                
                {/* LÍNEA 1: NOMBRE COMPLETO */}
                <div className="text-center w-full mb-1 pr-14 sm:pr-0">
                  <h3 className="text-base font-black text-slate-900 leading-tight print:text-[15px] uppercase">
                    {fullName || "Sin Nombre"}
                  </h3>
                </div>

                {/* LÍNEA 2: FOTO, DATOS Y QR */}
                <div className="flex items-center justify-between gap-4">
                  {/* Foto o Avatar */}
                  <div className="w-20 h-20 rounded-lg bg-slate-200 border-2 border-slate-300 shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center text-slate-500 font-bold text-xl print:w-20 print:h-20">
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt={fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{fullName ? fullName.charAt(0) : "U"}</span>
                    )}
                  </div>

                  {/* Datos (Cédula, Cargo y Correo) */}
                  <div className="flex-grow min-w-0 text-left">
                    <p className="text-sm text-slate-700 font-medium print:text-[13px]">
                      Cédula: <span className="font-extrabold text-slate-900">{userId}</span>
                    </p>
                    <p className="text-xs text-indigo-700 font-bold leading-tight mt-0.5 print:text-[12px]">
                      {user.cargo || "Trabajador UCE"}
                    </p>
                    {userEmail && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 print:text-[10px]">
                        {userEmail}
                      </p>
                    )}
                  </div>

                  {/* Código QR */}
                  <div className="p-1.5 bg-white rounded border border-slate-200 shadow-sm flex-shrink-0 print:p-1">
                    <QRCodeSVG value={String(userId)} size={95} level="H" includeMargin={false} />
                  </div>
                </div>

              </div>

              {/* --- PIE DEL CARNÉ --- */}
              <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-100 text-center print:bg-slate-100 print:border-t print:py-1">
                <p className="text-[11px] text-slate-600 font-bold uppercase tracking-wide print:text-[10px]">
                  Credencial Oficial de Asistencia
                </p>
                <p className="text-[9px] text-slate-400 tracking-tight mt-0.5 print:text-[8px]">
                  Desarrollado por MSc. Jonathan Morales
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MENSAJE SI NO HAY RESULTADOS --- */}
      {filteredUsers.length === 0 && !loading && (
        <div className="text-center py-16 print:hidden">
          <p className="text-slate-500 text-sm">No se encontraron usuarios registrados con ese criterio.</p>
        </div>
      )}

      {/* --- MODAL PARA CREAR / EDITAR MIEMBRO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-900 px-6 py-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingUser ? "Editar Miembro" : "Agregar Nuevo Miembro"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-indigo-200 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Número de Cédula (ID del Carné y QR) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: 1712345678"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nombre Completo (Dos nombres y apellidos) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Carlos Pérez Morales"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cargo o Función
                </label>
                <input
                  type="text"
                  placeholder="Ej: Trabajador UCE / Directiva"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Correo Electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cadena Base64 de la Foto <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="data:image/jpeg;base64,..."
                  value={formData.foto}
                  onChange={(e) => setFormData({ ...formData, foto: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar Miembro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ESTILOS CSS ESPECÍFICOS PARA LA IMPRESIÓN --- */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          
          body {
            width: 210mm;
            background: white !important;
          }

          .grid {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 6mm !important;
          }

          .grid > div {
            width: 10.5cm !important;
            height: 7.4cm !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}