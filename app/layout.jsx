import "./globals.css";

export const metadata = {
  title: "Registro de asistencia",
  description: "Control de entradas y salidas mediante códigos QR",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
        <main className="flex-grow">
          {children}
        </main>
        <footer className="w-full py-4 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto bg-white">
          © {new Date().getFullYear()} Sindicato 14 de Noviembre - Universidad Central del Ecuador. Desarrollado por MSc. Jonathan Morales.
        </footer>
      </body>
    </html>
  );
}