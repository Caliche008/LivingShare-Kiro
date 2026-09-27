"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/lib/firebase/auth";
import { resetPasswordSchema } from "@/lib/validation/schemas";

type PageState = "idle" | "loading" | "success";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [emailError, setEmailError] = useState("");
  const [serverError, setServerError] = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setEmailError("");
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validación con Zod
    const result = resetPasswordSchema.safeParse({ email });
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? "Correo inválido");
      return;
    }

    setPageState("loading");
    try {
      await resetPassword(result.data.email);
      setPageState("success");
    } catch (err: unknown) {
      setPageState("idle");
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        // Por seguridad mostramos el mismo mensaje aunque el email no exista,
        // para no revelar qué correos están registrados.
        setPageState("success");
      } else if (code === "auth/too-many-requests") {
        setServerError("Demasiados intentos. Intenta de nuevo más tarde.");
      } else {
        setServerError("Error inesperado. Intenta de nuevo.");
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
        {/* Logo / título */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-600">LivingShare</h1>
          <p className="mt-1 text-sm text-gray-500">Recupera tu contraseña</p>
        </div>

        {pageState === "success" ? (
          /* ── Estado de éxito ── */
          <div className="space-y-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full
                         bg-green-100 mx-auto text-3xl"
              aria-hidden="true"
            >
              ✉️
            </div>
            <h2 className="text-base font-semibold text-gray-800">
              Revisa tu correo
            </h2>
            <p className="text-sm text-gray-500">
              Si existe una cuenta con{" "}
              <span className="font-medium text-gray-700">{email}</span>,
              recibirás un enlace para restablecer tu contraseña en los próximos
              minutos.
            </p>
            <p className="text-xs text-gray-400">
              ¿No lo encuentras? Revisa tu carpeta de spam.
            </p>
            <Link
              href="/login"
              className="mt-2 inline-block text-sm text-indigo-600 hover:underline
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-indigo-500 rounded"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          /* ── Formulario ── */
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <p className="text-sm text-gray-600">
              Ingresa el correo asociado a tu cuenta y te enviaremos un enlace
              para restablecer tu contraseña.
            </p>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleChange}
                aria-describedby={emailError ? "email-error" : undefined}
                aria-invalid={!!emailError}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                           shadow-sm focus:border-indigo-500 focus:outline-none
                           focus:ring-1 focus:ring-indigo-500
                           aria-[invalid=true]:border-red-400"
              />
              {emailError && (
                <p id="email-error" className="mt-1 text-xs text-red-600">
                  {emailError}
                </p>
              )}
            </div>

            {/* Error del servidor */}
            {serverError && (
              <p role="alert" className="text-sm text-red-600">
                {serverError}
              </p>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={pageState === "loading"}
              className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold
                         text-white hover:bg-indigo-700 focus:outline-none
                         focus:ring-2 focus:ring-indigo-500
                         disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pageState === "loading" ? "Enviando…" : "Enviar enlace"}
            </button>

            {/* Links */}
            <div className="text-center text-sm">
              <Link
                href="/login"
                className="text-indigo-600 hover:underline focus-visible:outline-none
                           focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
