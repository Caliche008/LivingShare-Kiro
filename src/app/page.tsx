import { redirect } from "next/navigation";

/**
 * La raíz de la app redirige al login.
 * Cuando el usuario esté autenticado, el dashboard maneja la redirección
 * desde el AuthContext.
 */
export default function HomePage() {
  redirect("/login");
}
