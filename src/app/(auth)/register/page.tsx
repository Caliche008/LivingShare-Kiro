"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/ui/Logo";
import { registerUser } from "@/lib/firebase/auth";
import { registerSchema, type RegisterInput } from "@/lib/validation/schemas";

type FormState = Omit<RegisterInput, never>;
type FormErrors = Partial<Record<keyof RegisterInput, string>>;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setServerError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = registerSchema.safeParse(form);

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RegisterInput;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        email: result.data.email,
        password: result.data.password,
        displayName: result.data.displayName,
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use") {
        setServerError("Ya existe una cuenta con ese correo.");
      } else if (code === "auth/weak-password") {
        setServerError("La contraseña es demasiado débil.");
      } else {
        setServerError("Error inesperado. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  const fields: {
    id: keyof FormState;
    label: string;
    type: string;
    autoComplete: string;
  }[] = [
    { id: "displayName", label: "Nombre completo", type: "text", autoComplete: "name" },
    { id: "email", label: "Correo electrónico", type: "email", autoComplete: "email" },
    { id: "password", label: "Contraseña", type: "password", autoComplete: "new-password" },
    {
      id: "confirmPassword",
      label: "Confirmar contraseña",
      type: "password",
      autoComplete: "new-password",
    },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-xl ring-1 ring-gray-800">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={180} priority className="p-3" />
          <p className="mt-4 text-sm text-gray-400">Crea tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {fields.map(({ id, label, type, autoComplete }) => (
            <div key={id}>
              <label
                htmlFor={id}
                className="block text-sm font-medium text-gray-300"
              >
                {label}
              </label>
              <input
                id={id}
                name={id}
                type={type}
                autoComplete={autoComplete}
                value={form[id]}
                onChange={handleChange}
                aria-describedby={errors[id] ? `${id}-error` : undefined}
                aria-invalid={!!errors[id]}
                className="mt-1 block w-full rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm shadow-sm
                           focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                           aria-[invalid=true]:border-red-400"
              />
              {errors[id] && (
                <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
                  {errors[id]}
                </p>
              )}
            </div>
          ))}

          {serverError && (
            <p role="alert" className="text-sm text-red-600">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white
                       hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500
                       disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link href="/login" className="text-indigo-400 hover:underline">
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
