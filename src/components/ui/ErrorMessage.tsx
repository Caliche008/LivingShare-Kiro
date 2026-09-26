interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <span className="text-3xl" aria-hidden="true">⚠️</span>
      <p className="mt-2 text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700
                     hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
