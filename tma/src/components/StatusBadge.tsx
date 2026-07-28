import { useI18n } from "../i18n";
import type { OrderStatus } from "../api/types";

const colors: Record<OrderStatus, string> = {
  pending: "bg-brand-light/70 text-brand-dark",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready: "bg-cyan-100 text-cyan-700",
  accepted: "bg-teal-100 text-teal-700",
  delivering: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${colors[status]}`}>
      {t.status[status]}
    </span>
  );
}
