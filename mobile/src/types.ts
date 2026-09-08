export interface User {
  id: string; username: string; role: string; role_display: string;
  is_verified: boolean;
}
export interface CustodyEvent {
  id: string; event_type: string; event_type_display: string;
  from_party: string; to_party: string; event_hash: string; anchored_tx: string;
  created_at: string;
}
export interface GoldBatch {
  id: string; batch_code: string; gross_weight_g: string;
  fine_weight_g: string | null; fineness: number | null;
  status: string; status_display: string; passport_hash: string;
  qr_image: string | null; custody_events: CustodyEvent[];
}
export interface Passport {
  batch_code: string; status: string; miner_license: string;
  gross_weight_g: string; fineness: number | null;
  passport_hash: string; chain_valid: boolean; anchored: boolean;
  custody_chain: CustodyEvent[];
}
export interface Paginated<T> {
  count: number; next: string | null; previous: string | null; results: T[];
}
