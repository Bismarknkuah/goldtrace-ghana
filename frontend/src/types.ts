export type Role =
  | "super_admin" | "ceo" | "goldbod_officer" | "miner" | "buying_agent"
  | "assayer" | "refinery_operator" | "exporter" | "customs_officer"
  | "security_agency" | "bog_officer" | "ministry_official"
  | "env_officer" | "international_buyer" | "rider" | "driver"
  | "tier1_buyer" | "tier2_buyer" | "aggregator";

export interface User {
  id: string; username: string; email: string;
  first_name: string; last_name: string;
  role: Role; role_display: string;
  organization: string; phone: string;
  ghana_card_number: string; is_verified: boolean; mfa_enabled: boolean;
  avatar?: string; company?: string | null; company_name?: string | null;
  region?: string; district?: string; latitude?: number | null; longitude?: number | null;
}

export interface AdminUser {
  id: string; username: string; email: string; first_name: string; last_name: string;
  role: Role; role_display: string; phone: string; organization: string;
  is_active: boolean; is_verified: boolean; date_joined: string;
  region?: string; district?: string; latitude?: number | null; longitude?: number | null;
}

export interface Miner {
  id: string; license_number: string; license_status: string;
  region: string; district: string; license_expiry: string | null;
  user_detail?: User;
}

export interface CustodyEvent {
  id: string; batch: string; event_type: string; event_type_display: string;
  from_party: string; to_party: string;
  event_hash: string; previous_hash: string; anchored_tx: string;
  created_at: string;
}

export interface GoldBatch {
  id: string; batch_code: string; miner: string; concession: string | null;
  gross_weight_g: string; fine_weight_g: string | null; fineness: number | null;
  status: string; status_display: string;
  qr_image: string | null; passport_hash: string; anchored_tx: string;
  current_owner: string | null; custody_events: CustodyEvent[];
  listed_for_sale?: boolean; asking_price_ghs?: string | null; seal_number?: string;
  created_at: string;
}

export interface Passport {
  batch_code: string; status: string; miner_license: string;
  gross_weight_g: string; fine_weight_g: string | null; fineness: number | null;
  passport_hash: string; chain_valid: boolean; anchored: boolean;
  custody_chain: CustodyEvent[];
}

export interface OwnershipTransfer {
  id: string; batch: string; batch_code?: string;
  seller: string; seller_name?: string; buyer: string; buyer_name?: string;
  price: string | null; currency: string;
  status: string; status_display: string; stage?: string; irregular?: boolean; completed_at: string | null;
  created_at: string;
}

export interface ExportCertificate {
  id: string; batch: string; exporter: string; certificate_number: string;
  destination_country: string; fine_weight_g: string; fineness: number | null;
  status: string; status_display: string;
  certificate_hash: string; qr_image: string | null; issued_at: string | null;
  created_at: string;
}

export interface CertVerify {
  certificate_number: string; status: string; batch_code: string;
  destination_country: string; fine_weight_g: string;
  certificate_hash: string; chain_valid: boolean; valid: boolean;
}

export interface Paginated<T> {
  count: number; next: string | null; previous: string | null; results: T[];
}

export interface Courier {
  id: string; username: string; courier_type: string; courier_type_display: string;
  status: string; status_display: string; plate_number: string; phone: string;
  max_weight_kg: number; current_lat: number | null; current_lng: number | null;
  rating: number; last_seen: string | null;
  is_bonded: boolean; company: string; registration_no: string;
}
export interface Delivery {
  id: string; batch: string; batch_code: string;
  requested_by: string; seller: string; seller_name: string;
  buyer: string; buyer_name: string;
  courier_type: string; parcel_weight_kg: number; parcel_note: string;
  seal_number: string; escort_required: boolean; escort_ref: string;
  pickup_lat: number; pickup_lng: number; pickup_address: string;
  dropoff_lat: number; dropoff_lng: number; dropoff_address: string;
  distance_km: number; price_ghs: string; eta_minutes: number;
  status: string; status_display: string;
  courier: string | null; courier_name: string | null; courier_phone: string; courier_company: string;
  courier_lat: number | null; courier_lng: number | null; courier_updated_at: string | null;
  handed_over: boolean; handed_over_at: string | null;
  received_by_buyer: boolean; received_at: string | null; created_at: string;
}
export interface Candidate {
  courier_id: string; username: string; company: string; courier_type: string; plate_number: string;
  phone: string; rating: number; distance_km: number; eta_minutes: number; price_ghs: string;
}
export interface Receipt {
  id: string; reference: string; transfer: string; batch_code: string;
  payer: string; payer_name: string; payee: string; payee_name: string;
  amount: string; currency: string; created_at: string;
}
export interface TrackPayload {
  status: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  courier: { lat: number | null; lng: number | null; updated_at: string | null };
}

export interface RiskFlag { code: string; severity: string; message: string }
export interface RiskBatch {
  batch_id: string; batch_code: string; miner: string; region: string;
  score: number; level: string; flags: RiskFlag[];
}
export interface RiskOverview {
  summary: { clear: number; watch: number; elevated: number; critical: number; total: number };
  batches: RiskBatch[];
}

export interface RevenueOverview {
  assumptions: { gold_price_ghs_per_g: number; royalty_rate: number };
  summary: {
    export_count: number; total_fine_weight_g: string;
    total_export_value_ghs: string; total_royalty_ghs: string;
  };
  by_destination: { destination: string; value_ghs: string; royalty_ghs: string; count: number }[];
  certificates: {
    certificate_number: string; batch_code: string; destination: string;
    fine_weight_g: string; value_ghs: string; royalty_ghs: string; issued_at: string | null;
  }[];
}

export interface TrackGold {
  batch_id: string; batch_code: string; status: string; security_status: string;
  miner_license: string; current_owner: string | null;
  gross_weight_g: string; fine_weight_g: string | null; fineness: number | null;
  passport_hash: string; chain_valid: boolean;
  chain_broken_at: number | null; chain_length: number | null;
  seal_number: string | null; compromised: boolean;
  tamper: {
    security_status: string; chain_intact: boolean; chain_broken_at: number | null;
    broken_link: { event: string; actor: string | null; at: string } | null;
    recorded_seal: string | null; message: string; open_incident_count: number;
  } | null;
  last_location: { lat: number; lng: number; status: string; seal: string } | null;
  incidents: TrackIncident[];
  open_incidents: TrackIncident[];
  custody_chain: CustodyEvent[];
}
export interface TrackIncident {
  type: string; type_code: string; status: string; note: string;
  reported_by: string | null; reported_at: string;
  last_seen: { lat: number; lng: number } | null; resolved_at: string | null;
}
export interface SecurityIncident {
  id: string; batch: string; batch_code: string; incident_type: string;
  type_display: string; status: string; status_display: string; note: string;
  reported_by: string | null; resolved_at: string | null; created_at: string;
}
export interface SecurityOverview {
  status_counts: Record<string, number>;
  at_risk: { batch_code: string; batch_id: string; last_event: string; silent_since: string; status: string }[];
  open_incidents: SecurityIncident[];
}
export interface MiningCompany {
  id: string; name: string; registration_no: string; region: string;
  contact_email: string; contact_phone: string; is_active: boolean;
  miner_count: number; created_at: string;
}

export interface License {
  id: string; holder: string; holder_name: string; license_type: string;
  type_display: string; license_number: string; status: string; status_display: string;
  is_valid: boolean; region: string; operating_areas: string;
  working_capital_ghs: string; trade_capital_ghs: string;
  expires_at: string | null; issued_by: string | null; created_at: string; renewal_requested?: boolean;
}
export interface RegistryResult {
  found: boolean; number?: string; license_number?: string; type_display?: string;
  holder_name?: string; region?: string; status?: string; is_valid?: boolean; expires_at?: string | null;
}
export interface KycScreening {
  id: string; subject_name: string; subject_user: string | null; country: string;
  purpose: string; sanctions_hit: boolean; pep: boolean; risk_rating: string;
  status: string; status_display: string; note: string; screened_by: string | null; created_at: string;
}
export interface DueDiligence {
  id: string; batch: string; batch_code: string; origin_verified: boolean;
  conflict_free: boolean; oecd_conformant: boolean; oecd_step: number;
  statement: string; responsible: boolean; attested_by: string | null; created_at: string;
}
export interface ComplianceOverview {
  screening_counts: Record<string, number>;
  due_diligence: { attested: number; responsible: number; total_batches: number; coverage_pct: number };
  flagged_parties: KycScreening[];
}
export interface ParticipantRisk {
  summary: { clear: number; watch: number; elevated: number; critical: number; total: number };
  participants: { username: string; role: string; role_display: string; level: string;
    score: number; flags: { code: string; severity: string; message: string }[] }[];
}
export interface CurrentRate { rate_ghs_per_g: string; source: string }

export interface OperatorLocation {
  username: string; role: string; role_display: string;
  region: string; district: string; latitude: number; longitude: number;
}

export interface Transparency {
  reference_rate_ghs_per_g: number;
  production: { total_batches: number; gross_weight_g: string; fine_weight_g: string;
    average_fineness: number; exported_batches: number };
  exports: { export_count: number; fine_weight_g: string; total_value_ghs: string;
    total_royalty_ghs: string; fx_generated_usd: string };
  by_region: { region: string; batches: number; gross_weight_g: string }[];
  by_destination: { destination: string; value_ghs: string; count: number }[];
  licensing: { active: number; suspended: number; revoked: number };
}

export interface MarketListing {
  id: string; batch_code: string; gross_weight_g: string; fine_weight_g: string | null;
  fineness: number | null; asking_price_ghs: string; seller: string; seller_role: string;
  security_status: string;
}

export interface Anomaly {
  kind: string; severity: "critical" | "high" | "medium" | "low";
  title: string; detail: string; entities: string[];
}
export interface AnomalyFeed {
  summary: { critical: number; high: number; medium: number; low: number; total: number };
  anomalies: Anomaly[];
}
