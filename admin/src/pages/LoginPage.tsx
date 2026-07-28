import { LogIn } from "lucide-react";
import PasswordInput from "../components/PasswordInput";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
      nav("/");
    } catch {
      setError("Login yoki parol xato");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="card p-8 w-full max-w-sm space-y-5">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Barakali Bozor" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Barakali Bozor Admin</h1>
            <p className="text-sm text-slate-500">Boshqaruv paneliga kirish</p>
          </div>
        </div>
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <PasswordInput
            className="input"
            placeholder="Parol"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="btn w-full" disabled={loading}>
          <LogIn size={18} /> {loading ? "…" : "Kirish"}
        </button>
      </form>
    </div>
  );
}
