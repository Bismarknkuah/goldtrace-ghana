import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { RootState } from "../app/store";
import type { FeatureCollection } from "geojson";
import type {
  MarketListing, AnomalyFeed,
  Candidate, Courier, Delivery, Receipt, TrackPayload, RiskOverview, RevenueOverview,
  TrackGold, SecurityOverview, SecurityIncident, MiningCompany,
  License, RegistryResult, KycScreening, DueDiligence, ComplianceOverview,
  ParticipantRisk, CurrentRate, AdminUser, OperatorLocation, Transparency,
  CertVerify, ExportCertificate, GoldBatch, Miner,
  OwnershipTransfer, Paginated, Passport, User,
} from "../types";

// Priority: an explicit VITE_API_URL (set in Vercel) wins; otherwise a production
// build points at the Railway backend, and local dev falls back to localhost.
export const API_BASE =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? "https://goldtrace-ghana-production.up.railway.app/api/v1"
    : "http://localhost:8000/api/v1");
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.access;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Batch", "Miner", "Transfer", "Certificate", "Delivery", "Courier", "Receipt", "Security", "Company", "License", "Compliance", "Rate", "AdminUser", "Market"],
  endpoints: (b) => ({
    login: b.mutation<{ access: string; refresh: string }, { username: string; password: string }>({
      query: (body) => ({ url: "/auth/token/", method: "POST", body }),
    }),
    me: b.query<User, void>({ query: () => "/auth/me/" }),
    updateProfile: b.mutation<User, Partial<User>>({
      query: (body) => ({ url: "/auth/me/", method: "PATCH", body }),
    }),
    changePassword: b.mutation<{ detail: string }, { old_password: string; new_password: string }>({
      query: (body) => ({ url: "/auth/change-password/", method: "POST", body }),
    }),
    adminUsers: b.query<Paginated<AdminUser>, void>({
      query: () => "/auth/admin/users/", providesTags: ["AdminUser"],
    }),
    createAdminUser: b.mutation<AdminUser, { username: string; password: string; role: string;
      email?: string; first_name?: string; last_name?: string; phone?: string; organization?: string;
      region?: string; district?: string; latitude?: number | null; longitude?: number | null }>({
      query: (body) => ({ url: "/auth/admin/users/", method: "POST", body }),
      invalidatesTags: ["AdminUser"],
    }),
    updateAdminUser: b.mutation<AdminUser, { id: string; body: Partial<AdminUser> }>({
      query: ({ id, body }) => ({ url: `/auth/admin/users/${id}/`, method: "PATCH", body }),
      invalidatesTags: ["AdminUser"],
    }),

    miners: b.query<Paginated<Miner>, void>({
      query: () => "/miners/", providesTags: ["Miner"],
    }),

    batches: b.query<Paginated<GoldBatch>, void>({
      query: () => "/production/batches/", providesTags: ["Batch"],
    }),
    batch: b.query<GoldBatch, string>({
      query: (id) => `/production/batches/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Batch", id }],
    }),
    createBatch: b.mutation<GoldBatch, Partial<GoldBatch>>({
      query: (body) => ({ url: "/production/batches/", method: "POST", body }),
      invalidatesTags: ["Batch"],
    }),
    verifyBatch: b.query<Passport, string>({
      query: (code) => `/production/batches/verify/?code=${encodeURIComponent(code)}`,
    }),

    transfers: b.query<Paginated<OwnershipTransfer>, void>({
      query: () => "/trading/transfers/", providesTags: ["Transfer"],
    }),
    declineTransfer: b.mutation<OwnershipTransfer, string>({
      query: (id) => ({ url: `/trading/transfers/${id}/decline/`, method: "POST" }),
      invalidatesTags: ["Transfer", "Batch", "Market"],
    }),
    confirmTransfer: b.mutation<OwnershipTransfer, string>({
      query: (id) => ({ url: `/trading/transfers/${id}/confirm/`, method: "POST" }),
      invalidatesTags: ["Transfer", "Batch"],
    }),

    certificates: b.query<Paginated<ExportCertificate>, void>({
      query: () => "/exports/certificates/", providesTags: ["Certificate"],
    }),
    issueCertificate: b.mutation<ExportCertificate, string>({
      query: (id) => ({ url: `/exports/certificates/${id}/issue/`, method: "POST" }),
      invalidatesTags: ["Certificate", "Batch"],
    }),
    verifyCertificate: b.query<CertVerify, string>({
      query: (n) => `/exports/certificates/verify/?number=${encodeURIComponent(n)}`,
    }),

    concessionsGeo: b.query<FeatureCollection, void>({ query: () => "/gis/concessions.geojson" }),
    hotspotsGeo: b.query<FeatureCollection, void>({ query: () => "/gis/hotspots.geojson" }),

    // ---- Logistics / delivery ----
    courierMe: b.query<Courier, void>({ query: () => "/logistics/couriers/me/", providesTags: ["Courier"] }),
    registerCourier: b.mutation<Courier, Partial<Courier>>({
      query: (body) => ({ url: "/logistics/couriers/", method: "POST", body }),
      invalidatesTags: ["Courier"],
    }),
    goOnline: b.mutation<Courier, { status: string; lat?: number; lng?: number }>({
      query: (body) => ({ url: "/logistics/couriers/go_online/", method: "POST", body }),
      invalidatesTags: ["Courier"],
    }),
    updateCourierLocation: b.mutation<Courier, { lat: number; lng: number }>({
      query: (body) => ({ url: "/logistics/couriers/location/", method: "POST", body }),
    }),

    deliveries: b.query<Paginated<Delivery>, void>({
      query: () => "/logistics/deliveries/", providesTags: ["Delivery"],
    }),
    delivery: b.query<Delivery, string>({
      query: (id) => `/logistics/deliveries/${id}/`,
      providesTags: (_r, _e, id) => [{ type: "Delivery", id }],
    }),
    createDelivery: b.mutation<Delivery, Partial<Delivery>>({
      query: (body) => ({ url: "/logistics/deliveries/", method: "POST", body }),
      invalidatesTags: ["Delivery"],
    }),
    candidates: b.query<Candidate[], string>({
      query: (id) => `/logistics/deliveries/${id}/candidates/`,
    }),
    assignCourier: b.mutation<Delivery, { id: string; courier_id: string }>({
      query: ({ id, courier_id }) => ({ url: `/logistics/deliveries/${id}/assign/`, method: "POST", body: { courier_id } }),
      invalidatesTags: ["Delivery"],
    }),
    deliveryAction: b.mutation<Delivery, { id: string; action: "accept" | "reject" | "handover" | "confirm-receipt" }>({
      query: ({ id, action }) => ({ url: `/logistics/deliveries/${id}/${action}/`, method: "POST" }),
      invalidatesTags: ["Delivery"],
    }),
    trackDelivery: b.query<TrackPayload, string>({
      query: (id) => `/logistics/deliveries/${id}/track/`,
    }),
    postCourierPing: b.mutation<TrackPayload, { id: string; lat: number; lng: number }>({
      query: ({ id, lat, lng }) => ({ url: `/logistics/deliveries/${id}/track/`, method: "POST", body: { lat, lng } }),
      invalidatesTags: ["Delivery"],
    }),

    receipts: b.query<Paginated<Receipt>, void>({
      query: () => "/trading/receipts/", providesTags: ["Receipt"],
    }),

    handoverDelivery: b.mutation<Delivery, { id: string; seal_number: string; escort_required: boolean }>({
      query: ({ id, seal_number, escort_required }) => ({
        url: `/logistics/deliveries/${id}/handover/`, method: "POST",
        body: { seal_number, escort_required } }),
      invalidatesTags: ["Delivery"],
    }),
    riskOverview: b.query<RiskOverview, void>({ query: () => "/intelligence/risk/" }),
    anomalies: b.query<AnomalyFeed, void>({ query: () => "/intelligence/anomalies/" }),
    revenueOverview: b.query<RevenueOverview, void>({ query: () => "/revenue/overview/" }),

    trackGold: b.query<TrackGold, string>({
      query: (code) => `/production/batches/track/?code=${encodeURIComponent(code)}`,
    }),
    securityOverview: b.query<SecurityOverview, void>({
      query: () => "/security/overview/", providesTags: ["Security"],
    }),
    reportIncident: b.mutation<SecurityIncident, { batch: string; incident_type: string; note: string }>({
      query: (body) => ({ url: "/security/incidents/", method: "POST", body }),
      invalidatesTags: ["Security", "Batch"],
    }),
    resolveIncident: b.mutation<SecurityIncident, string>({
      query: (id) => ({ url: `/security/incidents/${id}/resolve/`, method: "POST" }),
      invalidatesTags: ["Security", "Batch"],
    }),
    companies: b.query<Paginated<MiningCompany>, void>({
      query: () => "/miners/companies/", providesTags: ["Company"],
    }),

    // ---- Licensing ----
    licenses: b.query<Paginated<License>, void>({
      query: () => "/licensing/licenses/", providesTags: ["License"],
    }),
    createLicense: b.mutation<License, Partial<License>>({
      query: (body) => ({ url: "/licensing/licenses/", method: "POST", body }),
      invalidatesTags: ["License"],
    }),
    licenseAction: b.mutation<License, { id: string; action: "suspend" | "revoke" | "reinstate" }>({
      query: ({ id, action }) => ({ url: `/licensing/licenses/${id}/${action}/`, method: "POST" }),
      invalidatesTags: ["License"],
    }),
    requestRenewal: b.mutation<License, { id: string; renewal_document?: string }>({
      query: ({ id, renewal_document }) => ({
        url: `/licensing/licenses/${id}/request_renewal/`, method: "POST",
        body: { renewal_document } }),
      invalidatesTags: ["License"],
    }),
    registryLookup: b.query<RegistryResult, string>({
      query: (number) => `/licensing/registry/?number=${encodeURIComponent(number)}`,
    }),

    // ---- Compliance ----
    kycScreenings: b.query<Paginated<KycScreening>, void>({
      query: () => "/compliance/kyc/", providesTags: ["Compliance"],
    }),
    createKyc: b.mutation<KycScreening, { subject_name: string; country: string; note?: string }>({
      query: (body) => ({ url: "/compliance/kyc/", method: "POST", body }),
      invalidatesTags: ["Compliance"],
    }),
    dueDiligence: b.query<Paginated<DueDiligence>, void>({
      query: () => "/compliance/due-diligence/", providesTags: ["Compliance"],
    }),
    complianceOverview: b.query<ComplianceOverview, void>({
      query: () => "/compliance/overview/", providesTags: ["Compliance"],
    }),

    // ---- Pricing + participant risk ----
    currentRate: b.query<CurrentRate, void>({ query: () => "/pricing/current/", providesTags: ["Rate"] }),
    createRate: b.mutation<unknown, { rate_ghs_per_g: string }>({
      query: (body) => ({ url: "/pricing/rates/", method: "POST", body }),
      invalidatesTags: ["Rate"],
    }),
    participantRisk: b.query<ParticipantRisk, void>({ query: () => "/intelligence/participants/" }),
    operators: b.query<OperatorLocation[], void>({ query: () => "/auth/operators/" }),
    transparency: b.query<Transparency, void>({ query: () => "/revenue/transparency/" }),
    marketplace: b.query<{ listings: MarketListing[] }, void>({
      query: () => "/production/batches/marketplace/", providesTags: ["Market"],
    }),
    listForSale: b.mutation<unknown, { id: string; asking_price_ghs: string; seal_number?: string }>({
      query: ({ id, ...body }) => ({ url: `/production/batches/${id}/list_for_sale/`, method: "POST", body }),
      invalidatesTags: ["Market", "Batch"],
    }),
    unlistBatch: b.mutation<unknown, string>({
      query: (id) => ({ url: `/production/batches/${id}/unlist/`, method: "POST" }),
      invalidatesTags: ["Market", "Batch"],
    }),
    buyBatch: b.mutation<{ detail: string; batch_code: string }, string>({
      query: (id) => ({ url: `/production/batches/${id}/buy/`, method: "POST" }),
      invalidatesTags: ["Market", "Batch", "Receipt", "Transfer"],
    }),
    clearSecurity: b.mutation<{ detail: string; security_status: string }, { id: string; note?: string }>({
      query: ({ id, note }) => ({ url: `/production/batches/${id}/clear_security/`, method: "POST", body: { note } }),
      invalidatesTags: ["Batch"],
    }),
    scanSeal: b.mutation<{ match: boolean; tamper?: boolean; note: string }, { id: string; seal_number: string }>({
      query: ({ id, seal_number }) => ({ url: `/production/batches/${id}/scan_seal/`, method: "POST", body: { seal_number } }),
      invalidatesTags: ["Batch"],
    }),
  }),
});

export const {
  useLoginMutation, useMeQuery, useUpdateProfileMutation,
  useAdminUsersQuery, useCreateAdminUserMutation, useUpdateAdminUserMutation,
  useChangePasswordMutation,
  useMinersQuery,
  useBatchesQuery, useBatchQuery, useCreateBatchMutation, useVerifyBatchQuery,
  useTransfersQuery, useConfirmTransferMutation, useDeclineTransferMutation,
  useCertificatesQuery, useIssueCertificateMutation, useVerifyCertificateQuery,
  useConcessionsGeoQuery, useHotspotsGeoQuery,
  useCourierMeQuery, useRegisterCourierMutation, useGoOnlineMutation, useUpdateCourierLocationMutation,
  useDeliveriesQuery, useDeliveryQuery, useCreateDeliveryMutation, useCandidatesQuery,
  useAssignCourierMutation, useDeliveryActionMutation, useTrackDeliveryQuery,
  usePostCourierPingMutation, useReceiptsQuery,
  useHandoverDeliveryMutation, useRiskOverviewQuery, useAnomaliesQuery, useRevenueOverviewQuery,
  useTrackGoldQuery, useSecurityOverviewQuery, useReportIncidentMutation,
  useResolveIncidentMutation, useCompaniesQuery,
  useLicensesQuery, useCreateLicenseMutation, useLicenseActionMutation, useRegistryLookupQuery,
  useRequestRenewalMutation,
  useKycScreeningsQuery, useCreateKycMutation, useDueDiligenceQuery, useComplianceOverviewQuery,
  useCurrentRateQuery, useCreateRateMutation, useParticipantRiskQuery, useOperatorsQuery, useTransparencyQuery, useMarketplaceQuery, useListForSaleMutation,
  useUnlistBatchMutation, useBuyBatchMutation, useScanSealMutation, useClearSecurityMutation,
} = api;
