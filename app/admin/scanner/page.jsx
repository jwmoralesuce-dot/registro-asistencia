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

    console.log("========================================");
    console.log("🔍 CÓDIGO QR ESCANEADO (ID):", userId);

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

      console.log("✅ USUARIO ENCONTRADO:", nombreUsuarioActual, "| Correo:", correoUsuarioActual);

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

      console.log("💾 Asistencia guardada correctamente en Firestore.");

      if (!correoUsuarioActual) {
        console.warn("⚠️ El usuario no tiene un correo registrado en su perfil.");
        setEmailStatus("⚠️ Asistencia guardada, pero el usuario no tiene correo registrado.");
      } else {
        try {
          console.log("📧 Intentando enviar correo a:", correoUsuarioActual);
          const emailResponse = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userName: nombreUsuarioActual,
              userEmail: correoUsuarioActual,
              type: currentMode,
              timestamp: eventDate.toISOString(),
            }),
          });

          const emailResultText = await emailResponse.text();
          console.log("📬 Respuesta del servidor de correo:", emailResponse.status, emailResultText);

          if (emailResponse.ok) {
            setEmailStatus("✅ Correo de notificación enviado con éxito.");
          } else {
            setEmailStatus(`⚠️ Asistencia guardada, pero falló el envío de correo (Error ${emailResponse.status}).`);
          }
        } catch (emailErr) {
          console.error("❌ Error de red al intentar conectar con /api/send-email:", emailErr);
          setEmailStatus("⚠️ Asistencia guardada, pero hubo un error de red al enviar el correo.");
        }
      }

      setLastAttendance({ userName: nombreUsuarioActual, type: currentMode, date: eventDate });
      setMessage(`¡${currentMode} registrada con éxito para ${nombreUsuarioActual}!`);
    } catch (attendanceError) {
      console.error("❌ Error general:", attendanceError);
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
    setMessage("Procesando faltas de la asamblea...");
    setError("");
    setEmailStatus("");

    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const allUsers = usersSnapshot.docs.map(doc => doc.data());

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const attendanceSnapshot = await getDocs(collection(db, "attendance"));
      const attendeesTodayIds = new Set();

      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.timestamp && data.type === "ENTRADA") {
          if (data.timestamp.toDate() >= todayStart) {
            attendeesTodayIds.add(String(data.userId));
          }
        }
      });

      const absentUsers = allUsers.filter(user => !attendeesTodayIds.has(String(user.id)));

      let countFaltas = 0;
      for (const user of absentUsers) {
        await addDoc(collection(db, "attendance"), {
          userId: user.id,
          userName: user.name || "Sin Nombre",
          userEmail: user.email || "",
          type: "FALTA A LA ASAMBLEA",
          timestamp: serverTimestamp(),
        });
        countFaltas++;
      }

      setMessage(`¡Reunión finalizada! Se registraron ${countFaltas} faltas.`);
    } catch (err) {
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

        const fechaObj = data.timestamp.toDate();
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
          registro["Estado / Novedad"] = "FALTA A LA ASAMBLEA";
        }
      });

      Object.values(registrosPorUsuarioYFecha).forEach(registro => {
        if (registro["Hora Entrada"] !== "No registrada" && registro["Hora Salida"] === "No registrada" && registro["Estado / Novedad"] !== "FALTA A LA ASAMBLEA") {
          registro["Estado / Novedad"] = "Solo registró entrada";
        }
      });

      const datosParaExcel = Object.values(registrosPorUsuarioYFecha);
      if (datosParaExcel.length === 0) {
        alert("No hay registros todavía para exportar.");
        return;
      }

      datosParaExcel.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

      const hoja = XLSX.utils.json_to_sheet(datosParaExcel);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Consolidado Asistencia");
      XLSX.writeFile(libro, `Consolidado_Asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error("Error al exportar:", error);
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
          setError("No se pudo acceder a la cámara.");
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
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <Link href="/" className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300">
            ← Atrás
          </Link>
          <button type="button" onClick={descargarExcel} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
            📊 Descargar Excel
          </button>
          <button type="button" onClick={handleEndMeeting} disabled={isEndingMeeting} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            {isEndingMeeting ? "Procesando..." : "🛑 Terminar Reunión"}
          </button>
          <Link href="/" className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200">
            ✕ Salir
          </Link>
        </div>

        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Administración</p>
        <h1 className="mt-2 text-3xl font-bold">Escáner de asistencia</h1>

        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <label className="text-sm font-bold text-indigo-950 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activarLimite}
              onChange={(e) => setActivarLimite(e.target.checked)}
              className="h-4 w-4 rounded border-indigo-300 text-indigo-600"
            />
            🕒 Programar Hora Límite de Entrada
          </label>
          {activarLimite && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="23"
                value={horaLimite}
                onChange={(e) => setHoraLimite(e.target.value)}
                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-800"
              />
              <span>:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={minutoLimite}
                onChange={(e) => setMinutoLimite(e.target.value)}
                className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center font-bold text-slate-800"
              />
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleModeChange("ENTRADA")}
            className={`rounded-xl py-3 text-center font-bold transition-all ${
              scanMode === "ENTRADA" ? "bg-emerald-600 text-white shadow-md" : "bg-slate-100 text-slate-600"
            }`}
          >
            📥 Modo ENTRADA
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("SALIDA")}
            className={`rounded-xl py-3 text-center font-bold transition-all ${
              scanMode === "SALIDA" ? "bg-amber-600 text-white shadow-md" : "bg-slate-100 text-slate-600"
            }`}
          >
            📤 Modo SALIDA
          </button>
        </div>

        <div id="qr-reader" className="mx-auto mt-6 max-w-sm overflow-hidden rounded-xl border border-slate-200" />
        
        {message && <p className="mt-4 text-center text-sm font-medium text-slate-700">{message}</p>}
        {emailStatus && (
          <p className={`mt-2 rounded-lg p-3 text-center text-xs font-semibold ${emailStatus.includes("✅") ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
            {emailStatus}
          </p>
        )}
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}

        {lastAttendance && (
          <div className="mt-6 rounded-xl p-4 text-center border bg-emerald-50 border-emerald-200">
            <p className="font-semibold text-emerald-900">{lastAttendance.userName}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{lastAttendance.type}</p>
          </div>
        )}
      </section>
    </main>
  );
}