export type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready"
  | "accepted" | "delivering" | "delivered" | "cancelled";

export interface OrderItem {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  price: number;
  quantity: number;
  unit?: string;
  note?: string | null;
}

export type PaymentMethod = "cash" | "payme" | "click" | "uzum";
export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface Order {
  id: number;
  number: string;
  status: OrderStatus;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  items_total: number;
  delivery_fee: number;
  total: number;
  address_line: string;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  comment?: string | null;
  distance_km?: number | null;
  eta_minutes?: number | null;
  assigned_courier_id?: number | null;
  courier_accepted_at?: string | null;
  delivering_started_at?: string | null;
  courier_delivered_at?: string | null;
  route_group_id?: string | null;
  route_sequence?: number | null;
  route_leg_km?: number | null;
  created_at: string;
  items: OrderItem[];
}

export interface StatBucket {
  delivered: number;
  earnings: number;
  cancelled: number;
}

export interface DaySeries {
  date: string;
  delivered: number;
  earnings: number;
}

export interface CourierStats {
  today: StatBucket;
  week: StatBucket;
  month: StatBucket;
  active: number;
  series: DaySeries[];
}

export interface EarningsDay {
  date: string;
  delivered: number;
  earnings: number;
}

export interface EarningsOut {
  days: number;
  total_delivered: number;
  total_earnings: number;
  series: EarningsDay[];
}
