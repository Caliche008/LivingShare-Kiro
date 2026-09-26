import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Verifica que el servidor de Next.js está operativo.
 * Útil para monitoreo y CI/CD.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
      environment: process.env.NODE_ENV,
      firebase: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "not_configured",
      },
    },
    { status: 200 }
  );
}
