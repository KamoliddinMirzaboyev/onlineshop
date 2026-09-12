import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Render paytidagi xatoni ushlaydi — usiz bitta komponent yiqilsa butun
 * sahifa oq ekranga aylanardi va foydalanuvchi nima bo'lganini bilmasdi.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Brauzer konsoliga — qo'llab-quvvatlash so'raganda shu yerdan olinadi.
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div className="mb-3 text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold text-slate-900">
            Nimadir noto‘g‘ri ketdi
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sahifani qayta yuklang. Takrorlansa, quyidagi matnni
            qo‘llab-quvvatlashga yuboring.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-[11px] leading-relaxed text-slate-600">
            {error.message || String(error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 w-full rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white transition active:scale-[0.98]"
          >
            Qayta yuklash
          </button>
        </div>
      </div>
    );
  }
}
