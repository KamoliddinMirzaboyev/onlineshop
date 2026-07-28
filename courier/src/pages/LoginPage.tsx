import { Bike, Lock, User } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { enablePush } from "../push";
import { useAuth } from "../store";

export default function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      // Kuryerga biriktirilgan buyurtmalar uchun bildirishnomani so'raymiz
      // (login bosishi — user gesture). Xato bo'lsa ham kirishga to'sqinlik qilmaydi.
      enablePush().catch(() => {});
      nav("/");
    } catch (err) {
      // Don't leak raw backend error text to the user.
      const raw = String(err);
      if (raw.includes("Faqat kuryer")) {
        // Account exists but isn't a courier — keep this specific message.
        setError("Faqat kuryer hisobi ruxsat etilgan / Доступ только для курьеров");
      } else {
        setError("Login yoki parol xato / Неверный логин или пароль");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30 mb-3">
            <Bike size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Barakali Bozor</h1>
          <p className="text-slate-500 text-sm mt-1">Kuryer paneli</p>
        </div>

        <form onSubmit={submit} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Login</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="kuryer_login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parol</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <PasswordInput
                className="w-full pl-9 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          <button type="submit" className="btn w-full justify-center" disabled={loading}>
            {loading ? "Kirish…" : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
