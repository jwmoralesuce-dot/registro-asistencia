import "./globals.css";

export const metadata = {
  title: "Registro de asistencia",
  description: "Control de entradas y salidas mediante códigos QR",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
