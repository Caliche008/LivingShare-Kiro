"use client";

/**
 * global-error.tsx
 *
 * Boundary de error global para el root layout.
 * Debe definir sus propios <html> y <body> ya que reemplaza el layout raíz.
 * En Next.js 16 el prop de recuperación se llama `retry` (no `reset`).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          display:         "flex",
          flexDirection:   "column",
          alignItems:      "center",
          justifyContent:  "center",
          minHeight:       "100vh",
          fontFamily:      "system-ui, sans-serif",
          backgroundColor: "#f9fafb",
          color:           "#111827",
          gap:             "1rem",
          padding:         "2rem",
          textAlign:       "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Algo salió mal
        </h1>
        <p style={{ color: "#6b7280", maxWidth: "24rem" }}>
          Ocurrió un error inesperado. Puedes intentar recargar la página.
          {error.digest && (
            <span style={{ display: "block", marginTop: "0.5rem", fontSize: "0.75rem" }}>
              Código: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={retry}
          style={{
            padding:         "0.5rem 1.5rem",
            borderRadius:    "0.5rem",
            backgroundColor: "#4f46e5",
            color:           "#fff",
            border:          "none",
            cursor:          "pointer",
            fontSize:        "0.875rem",
            fontWeight:      500,
          }}
        >
          Intentar de nuevo
        </button>
      </body>
    </html>
  );
}
