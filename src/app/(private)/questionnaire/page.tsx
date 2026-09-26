"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ui/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/lib/firebase/AuthContext";
import { getQuestionnaire, saveQuestionnaire, submitQuestionnaire } from "@/lib/firebase/questionnaireService";
import type { QuestionnaireAnswers } from "@/types";

const STEPS = ["Horarios", "Convivencia", "Hábitos", "Presupuesto"];
const REQUIRED: (keyof QuestionnaireAnswers)[] = ["sleepSchedule", "cleanlinessLevel", "noiseLevel", "hasPets", "smokes"];

function RadioGroup({
  label, name, value, options, onChange, required,
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors
              ${value === opt.value
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
          >
            <input
              type="radio" name={name} value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function QuestionnairePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const q = await getQuestionnaire(user.uid);
      if (q?.answers) setAnswers(q.answers);
    } catch { /* silenciar */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setValidationErrors([]);
  }

  async function goNext() {
    if (!user) return;
    setSaving(true);
    try { await saveQuestionnaire(user.uid, answers); } catch { /* silenciar */ }
    finally { setSaving(false); }
    setStep((s) => s + 1);
  }

  async function handleSubmit() {
    if (!user) return;
    // Validar obligatorios
    const missing = REQUIRED.filter((f) => answers[f] === undefined);
    if (missing.length > 0) {
      setValidationErrors(missing);
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      await submitQuestionnaire(user.uid, answers);
      router.push("/matches");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: keyof QuestionnaireAnswers) => validationErrors.includes(field as string);

  if (loading) {
    return <ProtectedRoute><div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" /></div></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4 py-4">
            <a href="/dashboard" className="text-sm text-indigo-600 hover:underline">← Dashboard</a>
            <h1 className="text-xl font-bold text-gray-900">Cuestionario de convivencia</h1>
          </div>
          {/* Barra de progreso */}
          <div className="border-t border-gray-100">
            <div className="mx-auto max-w-2xl flex px-4">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 flex-col items-center py-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors
                    ${i < step ? "bg-indigo-600 text-white" : i === step ? "border-2 border-indigo-600 text-indigo-600" : "border-2 border-gray-300 text-gray-400"}`}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className={`mt-1 text-xs ${i === step ? "text-indigo-600 font-medium" : "text-gray-400"}`}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="rounded-2xl bg-white p-6 shadow-sm space-y-6">

            {/* ── PASO 1: Horarios ── */}
            {step === 0 && (
              <>
                <RadioGroup
                  label="Horario de descanso" name="sleep" required
                  value={answers.sleepSchedule}
                  options={[{ value: "early", label: "Madrugador 🌅" }, { value: "flexible", label: "Flexible 🙂" }, { value: "night_owl", label: "Nocturno 🌙" }]}
                  onChange={(v) => set("sleepSchedule", v as QuestionnaireAnswers["sleepSchedule"])}
                />
                {fieldError("sleepSchedule") && <p className="text-xs text-red-600">⚠ Campo obligatorio</p>}

                <div className="flex items-center gap-3">
                  <input id="wfh" type="checkbox" checked={answers.workFromHome ?? false}
                    onChange={(e) => set("workFromHome", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="wfh" className="text-sm text-gray-700">Trabajo desde casa</label>
                </div>

                <div>
                  <label htmlFor="workHours" className="block text-sm font-medium text-gray-700">Turno principal de trabajo</label>
                  <select id="workHours" value={answers.workHours ?? ""}
                    onChange={(e) => set("workHours", e.target.value as QuestionnaireAnswers["workHours"])}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Sin preferencia</option>
                    <option value="morning">Mañana</option>
                    <option value="afternoon">Tarde</option>
                    <option value="night">Noche</option>
                    <option value="variable">Variable</option>
                  </select>
                </div>
              </>
            )}

            {/* ── PASO 2: Convivencia ── */}
            {step === 1 && (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Nivel de limpieza <span className="text-red-500">*</span>
                    {fieldError("cleanlinessLevel") && <span className="ml-2 text-xs text-red-600">⚠ Obligatorio</span>}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">1 = Muy relajado · 5 = Muy estricto</p>
                  <div className="mt-3 flex items-center gap-3">
                    {([1, 2, 3, 4, 5] as const).map((n) => (
                      <button key={n} type="button"
                        onClick={() => set("cleanlinessLevel", n)}
                        className={`h-10 w-10 rounded-full border-2 text-sm font-bold transition-colors
                          ${answers.cleanlinessLevel === n ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 text-gray-600 hover:border-indigo-400"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <RadioGroup
                  label="Nivel de ruido" name="noise" required
                  value={answers.noiseLevel}
                  options={[{ value: "silent", label: "Silencioso 🤫" }, { value: "moderate", label: "Moderado 🎵" }, { value: "lively", label: "Animado 🎉" }]}
                  onChange={(v) => set("noiseLevel", v as QuestionnaireAnswers["noiseLevel"])}
                />
                {fieldError("noiseLevel") && <p className="text-xs text-red-600">⚠ Campo obligatorio</p>}

                <div>
                  <label htmlFor="guests" className="block text-sm font-medium text-gray-700">Frecuencia de visitas</label>
                  <select id="guests" value={answers.guestsFrequency ?? ""}
                    onChange={(e) => set("guestsFrequency", e.target.value as QuestionnaireAnswers["guestsFrequency"])}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Sin preferencia</option>
                    <option value="never">Nunca</option>
                    <option value="rarely">Raramente</option>
                    <option value="sometimes">A veces</option>
                    <option value="often">Frecuentemente</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input id="overnight" type="checkbox" checked={answers.overnightGuests ?? false}
                    onChange={(e) => set("overnightGuests", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="overnight" className="text-sm text-gray-700">Acepto visitas que se queden a dormir</label>
                </div>
              </>
            )}

            {/* ── PASO 3: Hábitos ── */}
            {step === 2 && (
              <>
                <RadioGroup
                  label="¿Tienes mascotas?" name="hasPets" required
                  value={answers.hasPets === undefined ? undefined : answers.hasPets ? "yes" : "no"}
                  options={[{ value: "yes", label: "Sí 🐾" }, { value: "no", label: "No" }]}
                  onChange={(v) => set("hasPets", v === "yes")}
                />
                {fieldError("hasPets") && <p className="text-xs text-red-600">⚠ Campo obligatorio</p>}

                <RadioGroup
                  label="¿Aceptas mascotas de otros residentes?" name="acceptsPets"
                  value={answers.acceptsPets === undefined ? undefined : answers.acceptsPets ? "yes" : "no"}
                  options={[{ value: "yes", label: "Sí" }, { value: "no", label: "No" }]}
                  onChange={(v) => set("acceptsPets", v === "yes")}
                />

                <RadioGroup
                  label="¿Fumas?" name="smokes" required
                  value={answers.smokes === undefined ? undefined : answers.smokes ? "yes" : "no"}
                  options={[{ value: "yes", label: "Sí 🚬" }, { value: "no", label: "No" }]}
                  onChange={(v) => set("smokes", v === "yes")}
                />
                {fieldError("smokes") && <p className="text-xs text-red-600">⚠ Campo obligatorio</p>}

                <RadioGroup
                  label="¿Aceptas que otros fumen?" name="acceptsSmoking"
                  value={answers.acceptsSmoking === undefined ? undefined : answers.acceptsSmoking ? "yes" : "no"}
                  options={[{ value: "yes", label: "Sí" }, { value: "no", label: "No" }]}
                  onChange={(v) => set("acceptsSmoking", v === "yes")}
                />

                <div className="flex items-center gap-3">
                  <input id="alcohol" type="checkbox" checked={answers.drinksAlcohol ?? false}
                    onChange={(e) => set("drinksAlcohol", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <label htmlFor="alcohol" className="text-sm text-gray-700">Consumo alcohol ocasionalmente</label>
                </div>
              </>
            )}

            {/* ── PASO 4: Presupuesto ── */}
            {step === 3 && (
              <>
                <div>
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700">Presupuesto máximo mensual (MXN)</label>
                  <input
                    id="budget" type="number" min={0} step={100}
                    value={answers.maxBudgetCents ? answers.maxBudgetCents / 100 : ""}
                    onChange={(e) => set("maxBudgetCents", e.target.value ? parseFloat(e.target.value) * 100 : undefined)}
                    placeholder="Ej: 8000"
                    className="mt-1 w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="moveIn" className="block text-sm font-medium text-gray-700">Fecha de mudanza deseada</label>
                  <input
                    id="moveIn" type="date"
                    value={answers.moveInDate ?? ""}
                    onChange={(e) => set("moveInDate", e.target.value || undefined)}
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm
                               focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <RadioGroup
                  label="Duración de estancia" name="stay"
                  value={answers.stayDuration}
                  options={[
                    { value: "short", label: "Corta (<3 meses)" },
                    { value: "medium", label: "Media (3-12 meses)" },
                    { value: "long", label: "Larga (>12 meses)" },
                  ]}
                  onChange={(v) => set("stayDuration", v as QuestionnaireAnswers["stayDuration"])}
                />

                {submitError && (
                  <p role="alert" className="text-sm text-red-600">{submitError}</p>
                )}
              </>
            )}

            {/* Navegación */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Anterior
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Guardando…" : "Siguiente →"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? "Enviando…" : "Enviar cuestionario ✓"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
