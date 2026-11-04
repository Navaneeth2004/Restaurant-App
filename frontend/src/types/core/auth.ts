import type { Role } from 'config/constants';

export interface AuthUser { id: number; name: string; role: Role }
export interface StaffLoginResponse extends AuthUser { sessionToken: string }
export interface Staff { id: number; name: string; role: Role; active: number }

export interface RestaurantBrief { name: string; brand_color?: string; logo_url?: string }
export interface DeviceStatus {
  linked: boolean;
  suspended?: boolean;
  registration_open?: boolean;
  restaurant?: RestaurantBrief;
  device?: { id: string; name: string; role_lock: string | null };
}
export type OwnerLoginResponse =
  | { needs_restaurant: true; restaurants: { id: string; name: string }[] }
  | { linked: true; restaurant: RestaurantBrief; needs_restaurant?: undefined };

export interface Device {
  id: string; name: string; role_lock: string | null; created_via: string | null;
  created_at: string; last_seen_at: string | null; last_ip: string | null; is_current: boolean;
}
export interface PairingCode { code: string; expires_at: string; pair_url: string; role_lock: string | null }
export interface RegisterInput {
  restaurant_name: string; admin_name: string; phone: string; password: string; admin_pin: string; device_name?: string;
}
