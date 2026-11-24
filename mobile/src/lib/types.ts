export type Role = 'client' | 'admin';

export type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  created_at: string;
};

export type Level = 'free' | 'limited' | 'full';

export type ParkingInfo = {
  name: string;
  open_hour: number;
  close_hour: number;
  base_price: number;
  total_spots: number;
};

export type AvailabilityNow = {
  total_spots: number;
  free_spots: number;
  level: Level;
  price_per_hour: number;
  base_price: number;
  promo_applied: boolean;
  is_open: boolean;
  subscription_covered: boolean;
};

export type Quote = {
  total_spots: number;
  free_spots: number;
  level: Level;
  hours: number;
  total_price: number;
  price_per_hour: number;
  base_price: number;
  promo_applied: boolean;
  subscription_covered: boolean;
};

export type DaySlot = {
  start: string;
  end: string;
  free_spots: number;
  level: Level;
  price_per_hour: number;
  promo_applied: boolean;
  past: boolean;
};

export type Reservation = {
  id: number;
  user_id: number;
  user_name: string | null;
  spot_id: number | null;
  spot_number: string | null;
  zone: string | null;
  start_time: string;
  end_time: string;
  status: 'active' | 'cancelled';
  state: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  price_per_hour: number;
  total_price: number;
  promo_applied: boolean;
  paid_with_subscription: boolean;
  payment_status: 'paid' | 'refunded' | null;
};

export type Payment = {
  id: number;
  label: string;
  amount: number;
  method: 'card' | 'cash';
  card_last4: string;
  status: 'paid' | 'refunded';
  created_at: string;
};

export type Plan = {
  id: number;
  code: 'monthly' | 'quarterly' | 'annual';
  name: string;
  duration_days: number;
  price: number;
};

export type Subscription = {
  id: number;
  user_id: number;
  user_name: string | null;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  price: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled';
  state: 'active' | 'expired' | 'cancelled';
};

export type Promotion = {
  id: number;
  start: string;
  end: string;
  price_per_hour: number;
  base_price: number;
  discount_percent: number;
  reason: string;
};

export type Spot = {
  id: number;
  number: string;
  zone: string;
  status: 'available' | 'out_of_service';
};

export type ClientRow = User & { reservations_count: number; has_subscription: boolean };

export type Pricing = { base_price: number; min_price: number; max_price: number };

export type Dashboard = {
  today: { revenue: number; occupancy: number; active_reservations: number; active_subscribers: number };
  period: { days: number; revenue: number; occupancy: number };
  series: { date: string; revenue: number; occupancy: number }[];
};

export type Recommendation = {
  slot_start: string;
  slot_end: string;
  predicted_occupancy: number;
  current_price: number;
  recommended_price: number;
  kind: 'increase' | 'promotion' | 'base';
  reason: string;
  status: 'pending' | 'applied' | 'ignored';
};

export type ModelMetrics = {
  best_model: string;
  models: Record<string, { mae: number; rmse: number }>;
  dataset: 'real' | 'synthetic';
  rows: number;
  car_parks: number;
  date_from: string;
  date_to: string;
  trained_at: string;
};

export type RecommendationsResponse = {
  recommendations: Recommendation[];
  pricing: Pricing;
  prediction_source: 'model' | 'fallback';
  metrics: ModelMetrics | null;
};
