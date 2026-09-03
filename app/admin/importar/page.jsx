"use client";

import { useState } from "react";
import { collection, doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase"; // Ajusta tu ruta a firebase si es necesario
import Link from "next/link";
import * as XLSX from "xlsx";

export default function ImportUsersPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setMessage("Leyendo archivo Excel...");

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        
        // Convierte el Excel a un array de objetos JSON
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          throw new Error("El archivo Excel está vacío.");
        }

        setMessage(`Procesando ${data.length} usuarios para subir a Firebase...`);

        let countSuccess = 0;

        for (const row of data) {
          // Asegúrate de que las columnas en tu Excel se llamen exactamente id, name y email
          // O adáptalo si tus columnas tienen tildes (ej: row["Cédula"])
          const userId = String(row.id || row["Cédula"] || row["ID"] || "").trim();
          const userName = String(row.name || row["Nombre"] || row["Nombre Completo"] || "").trim();
          const userEmail = String(row.email || row["Correo"] || "").trim();

          if (userId) {
            // Usamos setDoc con el ID como clave de documento para evitar duplicados si subes el archivo dos veces
            await setDoc(doc(db, "users", userId), {
              id: userId,
              name: userName,
              email: userEmail,
              createdAt: new Date(),
            });
            countSuccess++;
          }
        }

        setStats({ total: data.length, success: countSuccess });
        setMessage("¡Importación completada con éxito!");
      } catch (err) {
        console.error(err);
        setMessage("Error al procesar el archivo: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow-lg">
        <Link
          href="/admin/scanner"
          className="mb-4 inline-block rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
        >
          ← Volver al Escáner
        </Link>

        <h1 className="text-2xl font-bold">Importar Usuarios masivamente</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sube tu archivo Excel (`.xlsx` o `.xls`). Debe contener las columnas: <code className="bg-slate-100 px-1 py-0.5 font-bold text-indigo-600">id</code> (o Cédula), <code className="bg-slate-100 px-1 py-0.5 font-bold text-indigo-600">name</code> y <code className="bg-slate-100 px-1 py-0.5 font-bold text-indigo-600">email</code>.
        </p>

        <div className="mt-6">
          <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 cursor-pointer hover:border-indigo-500 bg-slate-50 transition-colors">
            <span className="text-sm font-semibold text-slate-700">
              {loading ? "Subiendo datos a Firebase..." : "Haz clic aquí para seleccionar tu Excel"}
            </span>
            <span className="mt-1 text-xs text-slate-500">Archivos Excel soportados (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>

        {message && (
          <div className="mt-6 rounded-xl bg-indigo-50 p-4 text-center text-sm font-medium text-indigo-900 border border-indigo-100">
            {message}
          </div>
        )}

        {stats && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-900 border border-emerald-200">
            <p className="font-bold">¡Resumen de importación!</p>
            <p className="mt-1">Usuarios leídos: {stats.total}</p>
            <p>Usuarios guardados en Firebase: {stats.success}</p>
          </div>
        )}
      </section>
    </main>
  );
}