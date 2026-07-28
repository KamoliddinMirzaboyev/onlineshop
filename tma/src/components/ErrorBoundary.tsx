import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Catches render-time throws so a crash shows a fallback instead of a blank screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full p-10 flex flex-col items-center justify-center text-center text-tg-hint">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="font-medium text-tg-text">Xatolik / Ошибка</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-brand mt-4 px-6"
          >
            Qayta urinish / Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
