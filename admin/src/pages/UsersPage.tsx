import { Search, SearchX, SortAsc, SortDesc, Ban, Phone } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { get } from "../api";
import { ErrorRetry, TableSkeleton } from "../components/Skeleton";
import { useInfiniteList } from "../hooks/useInfiniteList";

interface UserRow {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  is_blocked: boolean;
  created_at: string;
  order_count: number;
  total_spent: number;
}

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-rose-500", 
  "bg-amber-500", "bg-cyan-500", "bg-fuchsia-500", "bg-indigo-500"
];

function getAvatarColor(id: number) {
  return COLORS[id % COLORS.length];
}

const money = (n?: number | null) => (n || 0).toLocaleString("ru-RU").replace(/,/g, " ");

type SortField = "date" | "orders" | "spent";
type OrderFilter = "all" | "ordered" | "not_ordered";

const FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "ordered", label: "Buyurtma bergan" },
  { value: "not_ordered", label: "Buyurtma bermagan" },
];

export default function UsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDesc, setSortDesc] = useState(true);
  const [filter, setFilter] = useState<OrderFilter>("all");

  const load = (f: OrderFilter) => {
    setErr(false);
    setLoading(true);
    get<UserRow[]>(`/admin/users?filter=${f}`)
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => { setErr(true); setLoading(false); });
  };

  useEffect(() => { load(filter); }, [filter]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const filtered = useMemo(() => {
    let res = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(u => 
        (u.first_name && u.first_name.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q))
      );
    }
    res.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortBy === "orders") cmp = a.order_count - b.order_count;
      else if (sortBy === "spent") cmp = a.total_spent - b.total_spent;
      return sortDesc ? -cmp : cmp;
    });
    return res;
  }, [items, search, sortBy, sortDesc]);
  const { visible: visibleUsers, sentinelRef: usersEndRef, hasMore: hasMoreUsers } =
    useInfiniteList(filtered, `${search}|${filter}`);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <SortDesc className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" size={14} />;
    return sortDesc ? <SortDesc className="text-brand" size={14} /> : <SortAsc className="text-brand" size={14} />;
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Foydalanuvchilar</h1>
          <p className="text-slate-500">Mijozlar bazasi va ularning faolligi</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex rounded-xl border border-slate-200 p-1 bg-slate-50">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === f.value ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Ism yoki telefon..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full md:w-64 rounded-xl border-slate-200 focus:border-brand focus:ring-brand text-sm"
            />
          </div>
        </div>
      </div>

      {err ? <ErrorRetry onRetry={() => load(filter)} /> : loading ? <TableSkeleton cols={6} /> : (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Mijoz</th>
                <th className="th cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => toggleSort("date")}>
                  <div className="flex items-center gap-1.5">Ro'yxatdan o'tgan <SortIcon field="date" /></div>
                </th>
                <th className="th cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => toggleSort("orders")}>
                  <div className="flex items-center gap-1.5">Buyurtmalar <SortIcon field="orders" /></div>
                </th>
                <th className="th cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => toggleSort("spent")}>
                  <div className="flex items-center gap-1.5">Sarflagan summa <SortIcon field="spent" /></div>
                </th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => {
                const initial = u.first_name ? u.first_name.charAt(0).toUpperCase() : (u.username ? u.username.charAt(0).toUpperCase() : "?");
                return (
                  <tr key={u.id} className={`hover:bg-slate-50/60 transition-colors ${u.is_blocked ? "opacity-70" : ""}`}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${getAvatarColor(u.id)}`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                            {u.first_name || "Mijoz"} 
                            {u.username && <span className="text-xs font-normal text-slate-400">@{u.username}</span>}
                          </div>
                          <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                            <Phone size={12} /> {u.phone || "Kiritilmagan"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600 font-medium">{new Date(u.created_at).toLocaleDateString("ru-RU")}</td>
                    <td className="td font-semibold text-slate-700">{u.order_count ?? 0} ta</td>
                    <td className="td">
                      <span className="font-bold text-slate-900">{money(u.total_spent)}</span>
                      <span className="text-xs text-slate-500 ml-1">so'm</span>
                    </td>
                    <td className="td">
                      {u.is_blocked ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100">
                          <Ban size={14} /> Bloklangan
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Faol
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="td py-16 text-center">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-slate-50 mb-4">
                      <SearchX size={28} className="text-slate-400" />
                    </div>
                    <div className="text-slate-500 font-medium">Mijoz topilmadi</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMoreUsers && <div ref={usersEndRef} className="h-1" />}
      </div>
      )}
    </div>
  );
}
