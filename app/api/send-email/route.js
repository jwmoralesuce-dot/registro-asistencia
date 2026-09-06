import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { userName, userEmail, type, timestamp } = await request.json();

    if (!userName || !userEmail || !["ENTRADA", "SALIDA", "ENTRADA CON ATRASO", "FALTA A LA ASAMBLEA"].includes(type) || !timestamp) {
      return Response.json({ error: "Faltan datos válidos para enviar el correo." }, { status: 400 });
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return Response.json({ error: "La configuración de Gmail está incompleta en el servidor." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const formattedDate = new Intl.DateTimeFormat("es-CO", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: "America/Bogota",
    }).format(new Date(timestamp));

    let subject = "Asamblea sindicato 14 de noviembre - Registro de entrada confirmado";
    let mensajeTipo = "Tu registro de <strong>ENTRADA</strong> fue confirmado correctamente.";
    let colorEncabezado = "#047857"; // Verde institucional

    if (type === "ENTRADA CON ATRASO") {
      subject = "⚠️ Asamblea sindicato 14 de noviembre - Aviso de Atraso";
      mensajeTipo = "Tu registro se ha realizado con un <strong style='color: #d97706;'>ATRASO</strong> respecto a la hora límite establecida.";
      colorEncabezado = "#d97706"; // Ámbar / Alerta
    } else if (type === "SALIDA") {
      subject = "Asamblea sindicato 14 de noviembre - Registro de salida confirmado";
      mensajeTipo = "Tu registro de <strong>SALIDA</strong> fue confirmado correctamente.";
    } else if (type === "FALTA A LA ASAMBLEA") {
      subject = "❌ Asamblea sindicato 14 de noviembre - Aviso de Falta";
      mensajeTipo = "Se ha registrado tu <strong style='color: #dc2626;'>FALTA</strong> a la asamblea del día de hoy por no registrar asistencia.";
      colorEncabezado = "#dc2626"; // Rojo institucional de alerta
    }

    await transporter.sendMail({
      from: `"Sistema de Asistencia" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
          <h2 style="color: ${colorEncabezado}; margin-top: 0;">Asamblea sindicato 14 de noviembre</h2>
          <p>Hola, <strong>${escapeHtml(userName)}</strong>.</p>
          <p>${mensajeTipo}</p>
          <p>Fecha y hora: <strong>${escapeHtml(formattedDate)}</strong></p>
          <br/>
          <hr style="border: none; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #666; margin-bottom: 0;">Este es un mensaje automático del sistema de asistencia.</p>
        </div>
      `,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Gmail send error:", error);
    return Response.json({ error: "No se pudo enviar el correo mediante Gmail." }, { status: 500 });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}