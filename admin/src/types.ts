export interface Restaurant {
  id: number;
  name: string;
  description_uz?: string | null;
  description_ru?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  owner_name?: string | null;
  phones: string[];
  socials: Record<string, string>;
  is_active: boolean;
  is_open: boolean;
  rating: number;
  delivery_fee: number;
  min_order: number;
  avg_delivery_minutes: number;
}

export interface Category {
  id: number;
  parent_id?: number | null;
  group_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  bg_color?: string | null;
  is_active?: boolean;
  sort_order: number;
}

// Title — bosh sahifada bir nechta kategoriyani sarlavha ostida guruhlaydi.
export interface CategoryGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  /** Shu title ostidagi barcha kategoriya kartochkalari fon rangi */
  bg_color?: string | null;
  sort_order: number;
}

export interface Product {
  id: number;
  restaurant_id: number;
  category_id: number;
  name_uz: string;
  name_ru: string;
  description_uz?: string | null;
  description_ru?: string | null;
  image_url?: string | null;
  price: number;
  cost: number;
  stock: number;
  unit: string;
  low_stock_threshold: number;
  is_available: boolean;
  sort_order: number;
}

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
}

export interface Order {
  id: number;
  number: string;
  restaurant_id: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  items_total: number;
  delivery_fee: number;
  total: number;
  address_line: string;
  lat?: number | null;
  lng?: number | null;
  customer_name?: string | null;
  phone?: string | null;
  comment?: string | null;
  assigned_courier_id?: number | null;
  assigned_courier_name?: string | null;
  assigned_courier_phone?: string | null;
  courier_delivered_at?: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface DeliveryZone {
  id?: number;
  name: string;
  fee: number;
  min_order: number;
  is_active: boolean;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_km?: number | null;
}

export interface TopProduct {
  product_id: number;
  name_uz: string;
  image_url?: string | null;
  quantity: number;
  revenue: number;
  profit: number;
}

export interface DashboardStats {
  orders_today: number;
  revenue_today: number;
  profit_today: number;
  orders_week: number;
  revenue_week: number;
  profit_week: number;
  orders_month: number;
  revenue_month: number;
  profit_month: number;
  orders_total: number;
  revenue_total: number;
  profit_total: number;
  pending_orders: number;
  users_total: number;
  products_total: number;
  low_stock_count: number;
  top_products: TopProduct[];
}

export interface PeriodPoint {
  period: string;
  orders: number;
  revenue: number;
  profit: number;
}

export interface ReportTotals {
  orders: number;
  revenue: number;
  profit: number;
}

export interface ReportsOut {
  totals: ReportTotals;
  series: PeriodPoint[];
  top_products: TopProduct[];
}

export interface AdminUser {
  id: number;
  username: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  is_active: boolean;
}

export interface SupplyRecord {
  id: number;
  product_id: number;
  product_name: string;
  supplier_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  total_cost: number;
  supply_date: string;
  notes?: string | null;
  created_at: string;
}

export interface Courier {
  id: number;
  name: string;
  phone?: string | null;
  telegram_id?: number | null;
  is_active: boolean;
  is_busy: boolean;
}

export interface NotificationEvent {
  type: "new" | "accepted" | "delivered";
  order_id: number;
  order_number: string;
  total: number;
  address_line: string;
  at: string;
}

export interface Announcement {
  id: number;
  text: string;
  image_url?: string | null;
  button_text: string;
  status: "pending" | "sending" | "sent";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string | null;
}
