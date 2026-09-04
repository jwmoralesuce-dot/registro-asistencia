"use client";

import { useEffect, useRef, useState } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function ScannerPage() {
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  
  const scanModeRef = useRef("ENTRADA"); 
  const [scanMode, setScanMode] = useState("ENTRADA");

  const [horaLimite, setHoraLimite] = useState("13");
  const [minutoLimite, setMinutoLimite] = useState("30");
  const [activarLimite, setActivarLimite] = useState(true);

  const horaLimiteRef = useRef(horaLimite);
  const minutoLimiteRef = useRef(minutoLimite);
  const activarLimiteRef = useRef(activarLimite);

  useEffect(() => {
    horaLimiteRef.current = horaLimite;
    minutoLimiteRef.current = minutoLimite;
    activarLimiteRef.current = activarLimite;
  }, [horaLimite, minutoLimite, activarLimite]);

  const [message, setMessage] = useState("Solicitando acceso a la cámara...");
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [lastAttendance, setLastAttendance] = useState(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

  const handleModeChange = (mode) => {
    setScanMode(mode);
    scanModeRef.current = mode;
  };

  async function registerAttendance(userId) {
    if (!userId) return;

    processingRef.current = true;
    setError("");
    setEmailStatus("");
    setMessage("Consultando usuario...");

    try {
      const userSnapshot = await getDocs(
        query(collection(db, "users"), where("id", "==", userId), limit(1))
      );

      if (userSnapshot.empty) {
        throw new Error(`No existe un usuario en Firebase con el ID: ${userId}`);
      }

      const userData = userSnapshot.docs[0].data();
      const nombreUsuarioActual = userData.name || "Sin Nombre";
      const correoUsuarioActual = userData.email || "";

      const eventDate = new Date();
      const currentMode = scanModeRef.current; 

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayHistorySnapshot = await getDocs(
        query(
          collection(db, "attendance"),
          where("userId", "==", userId)
        )
      );

      let hasEntryToday = false;
      let hasExitToday = false;

      todayHistorySnapshot.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
          const recordDate = data.timestamp.toDate();
          if (recordDate >= todayStart) {
            if (data.type === "ENTRADA") hasEntryToday = true;
            if (data.type === "SALIDA") hasExitToday = true;
          }
        }
      });

      if (currentMode === "ENTRADA") {
        if (hasEntryToday) {
          throw new Error("El usuario ya registró su entrada el día de hoy.");
        }

        if (activarLimiteRef.current) {
          const hLimiteNum = parseInt(horaLimiteRef.current || "0", 10);
          const mLimiteNum = parseInt(minutoLimiteRef.current || "0", 10);

          const horaActual = eventDate.getHours();
          const minutosActuales = eventDate.getMinutes();

          if (horaActual > hLimiteNum || (horaActual === hLimiteNum && minutosActuales > mLimiteNum)) {
            const hFormatted = String(hLimiteNum).padStart(2, '0');
            const mFormatted = String(mLimiteNum).padStart(2, '0');
            throw new Error(`Entrada fuera de tiempo. La hora límite era las ${hFormatted}:${mFormatted}.`);
          }
        }
      }

      if (currentMode === "SALIDA") {
        if (!hasEntryToday) {
          throw new Error("Primero registre la entrada.");
        }
        if (hasExitToday) {
          throw new Error("El usuario ya registró su salida el día de hoy.");
        }
      }

      await addDoc(collection(db, "attendance"), {
        userId,
        userName: nombreUsuarioActual,
        userEmail: correoUsuarioActual,
        type: currentMode,
        timestamp: serverTimestamp(),
      });

      if (correoUsuarioActual) {
        try {
          await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userName: nombreUsuarioActual,
              userEmail: correoUsuarioActual,
              type: currentMode,
              timestamp: eventDate.toISOString(),
            }),
          });
          setEmailStatus("✅ Correo de notificación enviado con éxito.");
        } catch (emailErr) {
          setEmailStatus("⚠️ Asistencia guardada, pero hubo un error al enviar el correo.");
        }
      }

      setLastAttendance({ userName: nombreUsuarioActual, type: currentMode, date: eventDate });
      setMessage(`¡${currentMode} registrada con éxito para ${nombreUsuarioActual}!`);
    } catch (attendanceError) {
      setError(attendanceError.message || "No se pudo registrar la asistencia.");
      setMessage("");
    } finally {
      window.setTimeout(() => {
        processingRef.current = false;
      }, 2500);
    }
  }

  async function handleEndMeeting() {
    const confirmEnd = window.confirm("¿Estás seguro de terminar la reunión y marcar faltas?");
    if (!confirmEnd) return;

    setIsEndingMeeting(true);
    setMessage("Buscando asistencias y usuarios registrados...");
    setError("");
    setEmailStatus("");

    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const allUsers = usersSnapshot.docs.map(doc => doc.data());

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      setMessage("Analizando quiénes asistieron hoy...");

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("timestamp", ">=", todayStart)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      const attendeesTodayIds = new Set();
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId && data.type === "ENTRADA") {
          attendeesTodayIds.add(String(data.userId).trim());
        }
      });

      const absentUsers = allUsers.filter(user => !attendeesTodayIds.has(String(user.id).trim()));

      if (absentUsers.length === 0) {
        setMessage("¡Reunión finalizada! Todos los usuarios asistieron.");
        return;
      }

      setMessage(`Registrando ${absentUsers.length} faltas...`);

      // Se usa new Date() para asegurar que el registro tenga fecha inmediata legible para el Excel
      const now = new Date();
      let countFaltas = 0;
      for (const user of absentUsers) {
        await addDoc(collection(db, "attendance"), {
          userId: user.id,
          userName: user.name || "Sin Nombre",
          userEmail: user.email || "",
          type: "FALTA A LA ASAMBLEA",
          timestamp: now, 
        });
        countFaltas++;
      }

      setMessage(`¡Reunión finalizada con éxito! Se registraron ${countFaltas} faltas.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Ocurrió un error al procesar las faltas.");
      setMessage("");
    } finally {
      setIsEndingMeeting(false);
    }
  }

  async function descargarExcel() {
    try {
      const querySnapshot = await getDocs(collection(db, "attendance"));
      const registrosPorUsuarioYFecha = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.timestamp) return;

        // Soporte tanto para Firestore Timestamps como para Objetos Date nativos
        const fechaObj = typeof data.timestamp.toDate === "function" 
          ? data.timestamp.toDate() 
          : new Date(data.timestamp);

        const fechaKey = fechaObj.toISOString().slice(0, 10);
        const userId = String(data.userId || "Sin ID");
        const compositeKey = `${fechaKey}_${userId}`;

        if (!registrosPorUsuarioYFecha[compositeKey]) {
          registrosPorUsuarioYFecha[compositeKey] = {
            "Fecha": fechaKey,
            "Cédula / ID": data.userId,
            "Nombre Completo": data.userName || "Sin Nombre",
            "Correo": data.userEmail || "Sin Correo",
            "Hora Entrada": "No registrada",
            "Hora Salida": "No registrada",
            "Estado / Novedad": "Pendiente de Salida"
          };
        }

        const registro = registrosPorUsuarioYFecha[compositeKey];
        const horaFormateada = fechaObj.toLocaleTimeString();

        if (data.type === "ENTRADA") {
          registro["Hora Entrada"] = horaFormateada;
        } else if (data.type === "SALIDA") {
          registro["Hora Salida"] = horaFormateada;
          registro["Estado / Novedad"] = "Asistió completo";
        } else if (data.type === "FALTA A LA ASAMBLEA") {
          registro["Hora Entrada"] = "Ausente";
          registro["Hora Salida"] = "Ausente";
          registro["Estado / Novedad"] = "FALTA A LA ASAMBLEA";
        }
      });

      const todosLosRegistros = Object.values(registrosPorUsuarioYFecha);
      if (todosLosRegistros.length === 0) {
        alert("No hay registros todavía para exportar.");
        return;
      }

      const registrosPorDia = {};
      todosLosRegistros.forEach(item => {
        if (!registrosPorDia[item.Fecha]) {
          registrosPorDia[item.Fecha] = [];
        }
        registrosPorDia[item.Fecha].push(item);
      });

      const libro = XLSX.utils.book_new();

      Object.keys(registrosPorDia).sort().forEach(fecha => {
        const datosDia = registrosPorDia[fecha];
        const datosLimpios = datosDia.map(({ Fecha, ...resto }) => resto);
        
        const hoja = XLSX.utils.json_to_sheet(datosLimpios);
        XLSX.utils.book_append_sheet(libro, hoja, fecha);
      });

      XLSX.writeFile(libro, `Asistencia_Por_Dias_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar el archivo de Excel.");
    }
  }

  useEffect(() => {
    let isMounted = true;
    let scanner = null;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        
        const readerElement = document.getElementById("qr-reader");
        if (readerElement) readerElement.innerHTML = "";

        scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (!processingRef.current) {
              await registerAttendance(decodedText.trim());
            }
          },
          () => {}
        );

        if (isMounted) setMessage("Apunta la cámara al código QR");
      } catch (scannerError) {
        if (isMounted) {
          setError("No se pudo acceder a la cámara. Asegúrate de dar permisos o usar HTTPS.");
          setMessage("");
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().then(() => {
            try {
              scannerRef.current.clear();
            } catch (e) {}
          }).catch(() => {});
        } else {
          try {
            scannerRef.current.clear();
          } catch (e) {}
        }
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-sky-50 px-4 py-8 flex items-center justify-center text-slate-800">
      <div className="w-full max-w-xl rounded-3xl bg-white border border-sky-200 p-6 sm:p-8 shadow-xl relative overflow-hidden">
        
        {/* Franja superior institucional */}
        <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400" />

        {/* Barra superior */}
        <div className="mb-6 grid grid-cols-2 gap-2 border-b border-sky-100 pb-4 pt-2">
          <Link href="/" className="flex items-center justify-center rounded-xl bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 border border-sky-200 shadow-sm transition">
            ← Atrás
          </Link>
          <button type="button" onClick={descargarExcel} className="flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm transition">
            📊 Descargar Excel
          </button>
          <button type="button" onClick={handleEndMeeting} disabled={isEndingMeeting} className="flex items-center justify-center rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 shadow-sm transition">
            {isEndingMeeting ? "Procesando..." : "🛑 Terminar Reunión"}
          </button>
          <Link href="/" className="flex items-center justify-center rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 border border-rose-200 shadow-sm transition">
            ✕ Salir
          </Link>
        </div>

        {/* Encabezado e indicador institucional */}
        <div className="text-center my-6">
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
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Escáner de Asistencia
          </h1>
        </div>

        {/* Configuración Hora Límite */}
        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <label className="text-sm font-bold text-sky-950 flex items-center justify-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activarLimite}
              onChange={(e) => setActivarLimite(e.target.checked)}
              className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            🕒 Programar Hora Límite de Entrada
          </label>
          {activarLimite && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={horaLimite}
                onChange={(e) => setHoraLimite(e.target.value)}
                className="w-16 rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-center font-bold text-slate-800 shadow-sm"
              />
              <span className="font-bold text-sky-700">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minutoLimite}
                onChange={(e) => setMinutoLimite(e.target.value)}
                className="w-16 rounded-xl border border-sky-200 bg-white px-2 py-1.5 text-center font-bold text-slate-800 shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Botones de Modo Entrada / Salida */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange("ENTRADA")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-center font-bold text-sm transition-all shadow-sm ${
              scanMode === "ENTRADA" 
                ? "bg-sky-600 text-white shadow-sky-200 ring-2 ring-sky-600 ring-offset-2" 
                : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
            }`}
          >
            📥 Modo ENTRADA
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("SALIDA")}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-4 text-center font-bold text-sm transition-all shadow-sm ${
              scanMode === "SALIDA" 
                ? "bg-amber-500 text-white shadow-amber-200 ring-2 ring-amber-500 ring-offset-2" 
                : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
            }`}
          >
            📤 Modo SALIDA
          </button>
        </div>

        {/* Lector QR */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-sky-200 bg-slate-950 p-2 shadow-inner">
          <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
        </div>
        
        {message && <p className="mt-4 text-center text-sm font-medium text-slate-700">{message}</p>}
        {emailStatus && (
          <p className={`mt-2 rounded-xl p-3 text-center text-xs font-semibold ${emailStatus.includes("✅") ? "bg-sky-50 text-sky-800 border border-sky-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
            {emailStatus}
          </p>
        )}
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700 border border-rose-200">{error}</p>}

        {lastAttendance && (
          <div className="mt-6 rounded-2xl p-4 text-center border bg-sky-50 border-sky-200 shadow-sm">
            <p className="font-semibold text-sky-900">{lastAttendance.userName}</p>
            <p className="mt-1 text-2xl font-bold text-sky-700">{lastAttendance.type}</p>
          </div>
        )}

        {/* Pie de tarjeta */}
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