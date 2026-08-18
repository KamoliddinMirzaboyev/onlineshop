// Tadbirkor (business) hisobi — bir nechta do'konga egalik qiladi.
export interface Business {
  id: number;
  name: string;
  phone?: string | null;
  username: string;
  is_active: boolean;
  created_at: string;
}

// Do'kon (RestaurantOut ni aks ettiradi).
export interface Store {
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
  lat?: number | null;
  lng?: number | null;
  is_active: boolean;
  is_open: boolean;
  rating: number;
  delivery_fee: number;
  min_order: number;
  avg_delivery_minutes: number;
}

// POST/PUT /business/stores tanasi (StoreCreateIn) — business_id tokendan olinadi.
export interface StoreInput {
  name: string;
  description_uz?: string | null;
  description_ru?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  owner_name?: string | null;
  phones: string[];
  socials: Record<string, string>;
  lat?: number | null;
  lng?: number | null;
  delivery_fee: number;
  min_order: number;
  avg_delivery_minutes: number;
  is_active: boolean;
  is_open: boolean;
}

// POST /business/stores tanasi — do'kon + uni yurituvchi xodim birga yaratiladi.
export interface StoreWithStaffInput {
  name: string;
  staff_name: string;
  staff_phone: string | null;
  staff_username: string;
  staff_password: string;
}

// ── Katalog ──────────────────────────────────────────────────────
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

// ── Buyurtmalar ──────────────────────────────────────────────────
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
  route_sequence?: number | null;
  created_at: string;
  items: OrderItem[];
}

// ── Ombor ────────────────────────────────────────────────────────
export interface SupplyRecord {
  id: number;
  product_id: number;
  product_name: string;
  restaurant_id: number;
  supplier_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  total_cost: number;
  supply_date: string;
  notes?: string | null;
  created_at: string;
}

// ── Mijozlar (do'kondan buyurtma bergan bot foydalanuvchilari) ───
export interface Customer {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  is_blocked: boolean;
  created_at: string;
}

// ── Xodimlar (do'kon manager/kuryer akkauntlari) ─────────────────
export interface StaffUser {
  id: number;
  username: string;
  name?: string | null;
  phone?: string | null;
  role: "superadmin" | "manager" | "courier";
  restaurant_id: number;
  is_active: boolean;
  created_at: string;
}

// Bitta do'kon bo'yicha statistika qatori.
export interface StoreBreakdown {
  restaurant_id: number;
  name: string;
  orders: number;
  revenue: number;
  cost: number;
  profit: number;
  product_count: number;
  top_product_name?: string | null;
}

// Tadbirkorning barcha do'konlari bo'yicha umumiy statistika.
export interface BusinessStats {
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  stores: StoreBreakdown[];
}

// Vaqt qatoridagi bitta nuqta (kun/hafta/oy).
export interface PeriodPoint {
  period: string;   // ISO sana
  orders: number;
  revenue: number;
  profit: number;
}

// Eng ko'p sotilgan mahsulot qatori.
export interface TopProduct {
  product_id: number;
  name_uz: string;
  image_url: string | null;
  quantity: number;
  revenue: number;
  profit: number;
}

// GET /business/reports — chart'lar uchun.
export interface BusinessReports {
  totals: {
    orders: number;
    revenue: number;
    profit: number;
  };
  series: PeriodPoint[];
  top_products: TopProduct[];
  stores: StoreBreakdown[];   // so'nggi 30 kun, do'kon kesimi
}
