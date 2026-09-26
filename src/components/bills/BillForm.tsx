"use client";

import { useState } from "react";
import { billSchema, type BillInput } from "@/lib/validation/schemas";
import { toCents, formatCents } from "@/lib/domain/billSplit";

interface BillFormProps {
  propertyId: string;
  onSubmit: (data: BillInput, attachmentFile?: File) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<BillInput>;
  isLoading?: boolean;
}

const SERVICE_TYPES = [
  "Electricidad",
  "Agua",
  "Gas",
  "Internet",
  "Renta",
  "Mantenimiento",
  "Limpieza",
  "Seguridad",
  "Otro",
];

export default function BillForm({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
}: BillFormProps) {
  const [serviceType, setServiceType] = useState(initialData?.serviceType ?? "");
  const [customService, setCustomService] = useState("");
  const [provider, setProvider] = useState(initialData?.provider ?? "");
  const [periodStart, setPeriodStart] = useState(initialData?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(initialData?.periodEnd ?? "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate ?? "");
  const [amountStr, setAmountStr] = useState(
    initialData?.totalAmountCents ? String(initialData.totalAmountCents / 100) : ""
  );
  const [attachmentFile, setAttachmentFile] = useState<File | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const resolvedServiceType = serviceType === "Otro" ? customService : serviceType;

  function validate(): BillInput | null {
    setErrors({});

    const raw = {
      serviceType: resolvedServiceType,
      provider: provider || undefined,
      periodStart,
      periodEnd,
      dueDate,
      totalAmountCents: toCents(parseFloat(amountStr) || 0),
    };

    const result = billSchema.safeParse(raw);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return null;
    }
    return result.data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = validate();
    if (!data) return;

    setSubmitting(true);
    try {
      await onSubmit(data, attachmentFile);
    } catch (err) {
      setErrors({ _form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  const previewCents = toCents(parseFloat(amountStr) || 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Tipo de servicio */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Tipo de servicio <span className="text-red-500">*</span>
        </label>
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-required="true"
        >
          <option value="">Selecciona el servicio</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errors.serviceType && (
          <p className="mt-1 text-xs text-red-600" role="alert">{errors.serviceType}</p>
        )}
      </div>

      {/* Nombre personalizado si es "Otro" */}
      {serviceType === "Otro" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nombre del servicio <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={customService}
            onChange={(e) => setCustomService(e.target.value)}
            placeholder="Ej: Jardinería"
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      {/* Proveedor */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Proveedor</label>
        <input
          type="text"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="Ej: CFE, Telmex"
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Período */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Inicio del período <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            aria-required="true"
          />
          {errors.periodStart && (
            <p className="mt-1 text-xs text-red-600" role="alert">{errors.periodStart}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Fin del período <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            min={periodStart}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            aria-required="true"
          />
          {errors.periodEnd && (
            <p className="mt-1 text-xs text-red-600" role="alert">{errors.periodEnd}</p>
          )}
        </div>
      </div>

      {/* Fecha de vencimiento */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Fecha de vencimiento <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          min={periodStart}
          className="mt-1 w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm
                     focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-required="true"
        />
        {errors.dueDate && (
          <p className="mt-1 text-xs text-red-600" role="alert">{errors.dueDate}</p>
        )}
      </div>

      {/* Monto total */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Monto total (MXN) <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-gray-500">$</span>
          <input
            type="number"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="0.00"
            className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            aria-required="true"
          />
          {previewCents > 0 && (
            <span className="text-sm text-gray-500">
              = {formatCents(previewCents)}
            </span>
          )}
        </div>
        {errors.totalAmountCents && (
          <p className="mt-1 text-xs text-red-600" role="alert">{errors.totalAmountCents}</p>
        )}
      </div>

      {/* Adjunto */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Comprobante (opcional)
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setAttachmentFile(e.target.files?.[0])}
          className="mt-1 block text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0
                     file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium
                     file:text-indigo-600 hover:file:bg-indigo-100"
        />
        <p className="mt-1 text-xs text-gray-400">PDF o imagen, máx. 5 MB</p>
      </div>

      {/* Error de formulario */}
      {errors._form && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errors._form}
        </p>
      )}

      {/* Acciones */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium
                       text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || isLoading}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold
                     text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting || isLoading ? "Guardando…" : "Guardar factura"}
        </button>
      </div>
    </form>
  );
}
