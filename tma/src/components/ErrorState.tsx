type Props = { onRetry: () => void; className?: string };

// Bilingual (uz / ru) error + retry UI used across data-fetching pages.
export default function ErrorState({ onRetry, className = "" }: Props) {
  return (
    <div className={`p-10 flex flex-col items-center text-center text-tg-hint ${className}`}>
      <div className="text-4xl mb-3">⚠️</div>
      <p className="font-medium text-tg-text">Xatolik / Ошибка</p>
      <button onClick={onRetry} className="btn-brand mt-4 px-6">
        Qayta urinish / Повторить
      </button>
    </div>
  );
}
