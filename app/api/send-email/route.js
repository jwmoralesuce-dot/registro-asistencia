import nodemailer from "nodemailer";

export async function POST(request) {
  try {
    const { userName, userEmail, type, timestamp } = await request.json();

    if (!userName || !userEmail || !["ENTRADA", "SALIDA"].includes(type) || !timestamp) {
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

    await transporter.sendMail({
      from: `"Sistema de Asistencia" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: `Asamblea sindicato 14 de noviembre - Registro de ${type.toLowerCase()} confirmado`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #047857;">Asamblea sindicato 14 de noviembre</h2>
          <p>Hola, <strong>${escapeHtml(userName)}</strong>.</p>
          <p>Tu registro de <strong>${type}</strong> fue confirmado correctamente.</p>
          <p>Fecha y hora: <strong>${escapeHtml(formattedDate)}</strong></p>
          <br/>
          <p style="font-size: 12px; color: #666;">Este es un mensaje automático del sistema de asistencia.</p>
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