"use client";

import { useEffect, useRef, useState } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where, limit, updateDoc, doc } from "firebase/firestore";
import { db, storage } from "../../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const [showCardModal, setShowCardModal] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  
  const [migrating, setMigrating] = useState(false);

  const playFeedbackAudio = (tipo, textoAudio) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (tipo === "success") {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      console.error("AudioContext error:", e);
    }

    if ("speechSynthesis" in window && textoAudio) {
      window.speechSynthesis.cancel(); 
      const utterance = new SpeechSynthesisUtterance(textoAudio);
      utterance.lang = "es-ES";
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleModeChange = (mode) => {
    setScanMode(mode);
    scanModeRef.current = mode;
  };

  const migrarFotosAStorage = async () => {
    if (!confirm("¿Estás seguro de iniciar la migración de las fotos de Firestore a Storage para todos los usuarios?")) return;
    
    setMigrating(true);
    let count = 0;

    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      
      for (const docItem of querySnapshot.docs) {
        const userData = docItem.data();
        const rawPhoto = userData.photo || userData.foto;

        if (rawPhoto && rawPhoto.startsWith("data:image")) {
          try {
            const response = await fetch(rawPhoto);
            const blob = await response.blob();
            
            const userId = userData.id || docItem.id;
            const storageRef = ref(storage, `users_photos/${userId}_migrated.jpg`);
            
            const snapshot = await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            
            const userRef = doc(db, "users", docItem.id);
            await updateDoc(userRef, {
              photo: downloadUrl,
              foto: downloadUrl
            });

            count++;
          } catch (err) {
            console.error(`Error al migrar el usuario ${userData.id}:`, err);
          }
        }
      }

      alert(`¡Migración completada con éxito! Se migraron ${count} fotos a Storage.`);
    } catch (error) {
      console.error("Error general en la migración:", error);
      alert("Hubo un error durante el proceso de migración.");
    } finally {
      setMigrating(false);
    }
  };

  async function registerAttendance(userId) {
    if (!userId || processingRef.current) return;

    processingRef.current = true;
    setError("");
    setEmailStatus("");
    setMessage("Consultando usuario...");

    try {
      const userSnapshot = await getDocs(
        query(collection(db, "users"), where("id", "==", userId), limit(1))
      );

      if (userSnapshot.empty) {
        throw new Error(`No existe un usuario registrado con el ID: ${userId}`);
      }

      const userData = userSnapshot.docs[0].data();
      const nombreUsuarioActual = userData.name || "Sin Nombre";
      const correoUsuarioActual = userData.email || "";
      
      const fotoUsuarioActual = 
        userData.photo || 
        userData.foto || 
        userData.photoUrl || 
        userData.image || 
        userData.imageUrl || 
        userData.avatar || 
        "";

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

      todayHistorySnapshot.forEach((docItem) => {
        const data = docItem.data();
        if (data.timestamp) {
          const recordDate = typeof data.timestamp.toDate === "function" 
            ? data.timestamp.toDate() 
            : new Date(data.timestamp);

          if (recordDate >= todayStart) {
            if (data.type === "ENTRADA" || data.type === "ENTRADA CON ATRASO") hasEntryToday = true;
            if (data.type === "SALIDA") hasExitToday = true;
          }
        }
      });

      let finalRecordType = currentMode;

      if (currentMode === "ENTRADA") {
        if (hasEntryToday) {
          throw new Error(`${nombreUsuarioActual} ya registró su entrada el día de hoy.`);
        }

        if (activarLimiteRef.current) {
          const hLimiteNum = parseInt(horaLimiteRef.current || "0", 10);
          const mLimiteNum = parseInt(minutoLimiteRef.current || "0", 10);

          const horaActual = eventDate.getHours();
          const minutosActuales = eventDate.getMinutes();

          if (horaActual > hLimiteNum || (horaActual === hLimiteNum && minutosActuales > mLimiteNum)) {
            finalRecordType = "ENTRADA CON ATRASO";
          }
        }
      }

      if (currentMode === "SALIDA") {
        if (!hasEntryToday) {
          throw new Error(`Primero debe registrar la entrada para ${nombreUsuarioActual}.`);
        }
        if (hasExitToday) {
          throw new Error(`${nombreUsuarioActual} ya registró su salida el día de hoy.`);
        }
      }

      await addDoc(collection(db, "attendance"), {
        userId,
        userName: nombreUsuarioActual,
        userEmail: correoUsuarioActual,
        type: finalRecordType,
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
              type: finalRecordType,
              timestamp: eventDate.toISOString(),
            }),
          });
          setEmailStatus("✅ Correo de notificación enviado con éxito.");
        } catch (emailErr) {
          setEmailStatus("⚠️ Asistencia guardada, pero hubo un error al enviar el correo.");
        }
      }

      setLastAttendance({ 
        id: userId,
        userName: nombreUsuarioActual, 
        userEmail: correoUsuarioActual,
        userPhoto: fotoUsuarioActual,
        type: finalRecordType, 
        date: eventDate 
      });
      
      setShowCardModal(true);
      setMessage(`¡${finalRecordType} registrada con éxito para ${nombreUsuarioActual}!`);

      const mensajeVoz = finalRecordType === "ENTRADA CON ATRASO" 
        ? `${nombreUsuarioActual}, entrada con atraso registrada con éxito.` 
        : `${nombreUsuarioActual}, ${finalRecordType.toLowerCase()} registrada con éxito.`;
      
      playFeedbackAudio("success", mensajeVoz);

      window.setTimeout(() => {
        setShowCardModal(false);
        setEmailStatus("");
        setMessage("Apunta la cámara al código QR");
      }, 3500);

    } catch (attendanceError) {
      const errorMsg = attendanceError.message || "No se pudo registrar la asistencia.";
      setError(errorMsg);
      setMessage("");

      playFeedbackAudio("error", errorMsg);
      
      window.setTimeout(() => {
        setError("");
        setMessage("Apunta la cámara al código QR");
      }, 3000);
    } finally {
      window.setTimeout(() => {
        processingRef.current = false;
      }, 1500);
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
      const allUsers = usersSnapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      setMessage("Analizando quiénes asistieron hoy...");

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("timestamp", ">=", todayStart)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      
      const attendeesTodayIds = new Set();
      attendanceSnapshot.forEach(docItem => {
        const data = docItem.data();
        if (data.userId && (data.type === "ENTRADA" || data.type === "ENTRADA CON ATRASO")) {
          attendeesTodayIds.add(String(data.userId).trim());
        }
      });

      const absentUsers = allUsers.filter(user => !attendeesTodayIds.has(String(user.id).trim()));

      if (absentUsers.length === 0) {
        setMessage("¡Reunión finalizada! Todos los usuarios asistieron.");
        return;
      }

      setMessage(`Registrando y notificando ${absentUsers.length} faltas...`);

      const now = new Date();
      let countFaltas = 0;
      let countCorreosEnviados = 0;

      for (const user of absentUsers) {
        const userId = user.id;
        const userName = user.name || "Sin Nombre";
        const userEmail = user.email || "";

        await addDoc(collection(db, "attendance"), {
          userId: userId,
          userName: userName,
          userEmail: userEmail,
          type: "FALTA A LA ASAMBLEA",
          timestamp: now, 
        });
        countFaltas++;

        if (userEmail) {
          try {
            await fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userName: userName,
                userEmail: userEmail,
                type: "FALTA A LA ASAMBLEA",
                timestamp: now.toISOString(),
              }),
            });
            countCorreosEnviados++;
          } catch (emailErr) {
            console.error(`Error enviando correo de falta a ${userEmail}:`, emailErr);
          }
        }
      }

      setMessage(`¡Reunión finalizada! Se registraron ${countFaltas} faltas y se enviaron ${countCorreosEnviados} correos.`);
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

      querySnapshot.forEach((docItem) => {
        const data = docItem.data();
        if (!data.timestamp) return;

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
            "Fecha Registro": fechaKey,
            "Hora Entrada": "No registrada",
            "Hora Salida": "No registrada",
            "Estado / Novedad": "Pendiente de Salida"
          };
        }

        const registro = registrosPorUsuarioYFecha[compositeKey];
        const horaFormateada = fechaObj.toLocaleTimeString();

        if (data.type === "ENTRADA") {
          registro["Hora Entrada"] = horaFormateada;
          if (registro["Estado / Novedad"] === "Pendiente de Salida") {
            registro["Estado / Novedad"] = "Asistió a tiempo";
          }
        } else if (data.type === "ENTRADA CON ATRASO") {
          registro["Hora Entrada"] = `${horaFormateada} (ATRASO)`;
          registro["Estado / Novedad"] = "Con Atraso";
        } else if (data.type === "SALIDA") {
          registro["Hora Salida"] = horaFormateada;
          if (registro["Estado / Novedad"] === "Con Atraso") {
            registro["Estado / Novedad"] = "Asistió con Atraso (Completado)";
          } else {
            registro["Estado / Novedad"] = "Asistió completo";
          }
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
      todosLosRegistros.forEach((item) => {
        if (!registrosPorDia[item.Fecha]) {
          registrosPorDia[item.Fecha] = [];
        }
        registrosPorDia[item.Fecha].push(item);
      });

      const libro = XLSX.utils.book_new();

      Object.keys(registrosPorDia).sort().forEach(fecha => {
        const datosDia = registrosPorDia[fecha];
        
        datosDia.sort((a, b) => 
          String(a["Nombre Completo"]).localeCompare(String(b["Nombre Completo"]), "es", { sensitivity: "base" })
        );

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
        
        <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-sky-400 via-amber-300 to-emerald-400" />

        {showCardModal && lastAttendance && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-6 transition-all animate-fadeIn">
            <div className={`w-full max-w-sm rounded-3xl border-2 ${lastAttendance.type.includes("ATRASO") ? "border-amber-400" : "border-emerald-400"} bg-white p-6 shadow-2xl text-center relative overflow-hidden`}>
              
              <div className={`absolute top-0 left-0 right-0 h-2 ${lastAttendance.type.includes("ATRASO") ? "bg-amber-500" : "bg-emerald-500"}`} />
              
              <span className={`inline-block px-3 py-1 ${lastAttendance.type.includes("ATRASO") ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"} font-bold text-xs rounded-full uppercase tracking-wider mb-3`}>
                ⚠️ ¡{lastAttendance.type} Registrada!
              </span>

              <div className="flex justify-center mb-3">
                {lastAttendance.userPhoto && lastAttendance.userPhoto.length > 10 ? (
                  <img 
                    src={lastAttendance.userPhoto} 
                    alt={lastAttendance.userName}
                    className="h-24 w-24 object-cover rounded-2xl border-2 border-sky-200 shadow-md"
                  />
                ) : (
                  <div className="h-24 w-24 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-700 font-black text-3xl border-2 border-sky-200 shadow-inner">
                    {lastAttendance.userName.charAt(0)}
                  </div>
                )}
              </div>

              <h3 className="text-lg font-black text-slate-900 mb-1">
                {lastAttendance.userName}
              </h3>
              
              <p className="text-xs font-semibold text-slate-500 mb-1">
                Cédula / ID: <span className="text-slate-700 font-bold">{lastAttendance.id}</span>
              </p>
              
              <p className="text-xs text-slate-400 mb-3 truncate px-4">
                {lastAttendance.userEmail || "Sin correo registrado"}
              </p>

              {emailStatus && (
                <p className={`mb-3 rounded-xl p-2 text-center text-[11px] font-semibold ${emailStatus.includes("✅") ? "bg-sky-50 text-sky-800 border border-sky-200" : "bg-amber-50 text-amber-800 border border-amber-200"}`}>
                  {emailStatus}
                </p>
              )}

              <div className={`border-t border-slate-100 pt-3 text-[11px] font-bold ${lastAttendance.type.includes("ATRASO") ? "text-amber-600" : "text-emerald-600"}`}>
                ✔ Listo para el siguiente escaneo...
              </div>

            </div>
          </div>
        )}

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

        <div className="mb-4">
          <button
            type="button"
            onClick={migrarFotosAStorage}
            disabled={migrating}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition"
          >
            {migrating ? "⏳ Migrando fotos a Storage..." : "🔄 Migrar fotos de Firestore a Storage"}
          </button>
        </div>

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

        <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <label className="text-sm font-bold text-sky-950 flex items-center justify-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={activarLimite}
              onChange={(e) => setActivarLimite(e.target.checked)}
              className="h-4 w-4 rounded border-sky-300 text-sky-600 focus:ring-sky-500"
            />
            🕒 Programar Hora Límite de Entrada (con control de atrasos)
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-sky-200 bg-slate-950 p-2 shadow-inner">
          <div id="qr-reader" className="w-full overflow-hidden rounded-xl" />
        </div>
        
        {message && <p className="mt-4 text-center text-sm font-medium text-slate-700">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-center text-sm font-semibold text-rose-700 border border-rose-200">{error}</p>}

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