"use client";
import { QRCodeCanvas } from "qrcode.react";

export default async function UserCredentialPage({ params }) {
  const { id } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Credencial digital</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Código de acceso</h1>
        <div className="mx-auto mt-8 w-fit rounded-xl border border-slate-200 bg-white p-4">
          <QRCodeCanvas value={id} size={240} includeMargin />
        </div>
        <p className="mt-6 text-sm text-slate-500">ID de usuario</p>
        <p className="mt-1 break-all text-xl font-semibold text-slate-900">{id}</p>
      </section>
    </main>
  );
}
