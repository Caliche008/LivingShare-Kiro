"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { loginUser } from "@/lib/firebase/auth";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<LoginInput>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = loginSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors: Partial<LoginInput> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof LoginInput;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await loginUser(result.data);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setServerError("Correo o contraseña incorrectos.");
      } else if (code === "auth/too-many-requests") {
        setServerError("Demasiados intentos. Intenta de nuevo más tarde.");
      } else {
        setServerError("Error inesperado. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-xl ring-1 ring-gray-800">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={180} priority className="p-3" />
          <p className="mt-4 text-sm text-gray-400">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm shadow-sm
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                         aria-[invalid=true]:border-red-400"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
              className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm shadow-sm
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                         aria-[invalid=true]:border-red-400"
            />
            {errors.password && (
              <p id="password-error" className="mt-1 text-xs text-red-600">
                {errors.password}
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
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        {/* Links */}
        <div className="mt-4 flex flex-col gap-1 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-gray-400 hover:text-indigo-400 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Link
            href="/register"
            className="text-indigo-400 hover:underline"
          >
            ¿No tienes cuenta? Regístrate
          </Link>
        </div>
      </div>
    </main>
  );
}
