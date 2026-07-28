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
  unit?: string;
  is_available: boolean;
}

export interface Subcategory {
  id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  sort_order: number;
  products: Product[];
}

export interface Category {
  id: number;
  group_id?: number | null;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  /** TMA kartochka foni — yumshoq pastel hex */
  bg_color?: string | null;
  sort_order: number;
  subcategories: Subcategory[];
}

// Title — bosh sahifada bir nechta kategoriyani sarlavha ostida guruhlaydi.
export interface CategoryGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  sort_order: number;
}

export interface Restaurant {
  id: number;
  name: string;
  description_uz?: string | null;
  description_ru?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  address?: string | null;
  owner_name?: string | null;
  phones?: string[];
  socials?: Record<string, string>;
  is_active: boolean;
  is_open: boolean;
  rating: number;
  delivery_fee: number;
  min_order: number;
  avg_delivery_minutes: number;
  lat?: number | null;
  lng?: number | null;
}

export interface RestaurantDetail extends Restaurant {
  categories: Category[];
  category_groups: CategoryGroup[];
}

export interface Address {
  id: number;
  label: string;
  address_line: string;
  lat?: number | null;
  lng?: number | null;
  entrance?: string | null;
  floor?: string | null;
  apartment?: string | null;
  comment?: string | null;
}

export type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready"
  | "accepted" | "delivering" | "delivered" | "cancelled";

export interface OrderItem {
  id: number;
  product_id: number;
  name_uz: string;
  name_ru: string;
  image_url?: string | null;
  price: number;
  quantity: number;
  unit?: string;
  note?: string | null;
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
  phone?: string | null;
  comment?: string | null;
  distance_km?: number | null;
  eta_minutes?: number | null;
  assigned_courier_id?: number | null;
  assigned_courier_name?: string | null;
  assigned_courier_phone?: string | null;
  courier_accepted_at?: string | null;
  delivering_started_at?: string | null;
  courier_delivered_at?: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface User {
  id: number;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  phone?: string | null;
  language: string;
  created_at: string;
}
