import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Estado del sistema — LivingShare",
};

async function getHealthData() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function HealthPage() {
  const health = await getHealthData();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-4 text-xl font-bold text-gray-800">
          Estado del sistema
        </h1>

        {health ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Estado</dt>
              <dd className="font-medium text-green-600">✅ {health.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Entorno</dt>
              <dd className="font-medium text-gray-800">{health.environment}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Firebase Project</dt>
              <dd className="font-medium text-gray-800">
                {health.firebase?.projectId}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Timestamp</dt>
              <dd className="font-mono text-xs text-gray-600">
                {health.timestamp}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-red-600">
            ⚠️ No se pudo obtener el estado del sistema.
          </p>
        )}
      </div>
    </main>
  );
}
