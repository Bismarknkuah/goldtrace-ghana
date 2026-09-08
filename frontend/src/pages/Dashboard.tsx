import { Box, Button, Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import {
  useBatchesQuery, useCertificatesQuery, useMinersQuery, useDeliveriesQuery,
  useTransfersQuery, useReceiptsQuery, useLicensesQuery, useRevenueOverviewQuery,
  useSecurityOverviewQuery, useHotspotsGeoQuery, useAnomaliesQuery, useIllegalMiningAlertsQuery,
  usePublicReportsQuery,
} from "../services/api";

// Each role maps to one operating cluster; every cluster has its own dashboard.
const CLUSTER: Record<string, string> = {
  super_admin: "admin", ceo: "executive", goldbod_officer: "officer",
  ministry_official: "regulator", bog_officer: "finance",
  customs_officer: "enforcement", security_agency: "enforcement",
  miner: "producer", mining_company: "producer",
  buying_agent: "buyer", tier1_buyer: "buyer", tier2_buyer: "buyer", aggregator: "buyer",
  assayer: "assay", refinery_operator: "assay",
  exporter: "export", international_buyer: "export",
  env_officer: "environment", rider: "courier", driver: "courier",
  independent_auditor: "regulator",
};

const MANDATE: Record<string, string> = {
  admin: "Full oversight and administration of every gram in the system.",
  executive: "National gold intelligence: production, exports, revenue, risk and AI recommendations.",
  officer: "Operational control: verify, approve, license and investigate.",
  regulator: "The national position across production, exports, revenue and risk.",
  finance: "Export value, royalties and payment reconciliation for the Bank of Ghana.",
  enforcement: "Detect, verify and recover at-risk or irregularly-moving gold.",
  producer: "Register your gold at source and move it securely to licensed buyers.",
  buyer: "Find gold available to buy, record purchases and issue receipts.",
  assay: "Assay and process batches in your custody and pass them onward.",
  export: "Certify exports, verify provenance and dispatch secure transport.",
  environment: "Concession boundaries and illegal-mining hotspots.",
  courier: "Accept and run secure bonded delivery jobs.",
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card><CardContent>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 38, fontWeight: 600, lineHeight: 1.15 }}>
        {value}
      </Typography>
      {sub && <Typography variant="body2" color="text.secondary">{sub}</Typography>}
    </CardContent></Card>
  );
}

function Quick({ label, hint, to }: { label: string; hint: string; to: string }) {
  const navigate = useNavigate();
  return (
    <Card><CardActionArea onClick={() => navigate(to)} sx={{ p: 2.5, height: "100%" }}>
      <Typography fontWeight={600} sx={{ fontFamily: "Fraunces, serif", fontSize: 18 }}>{label}</Typography>
      <Typography variant="body2" color="text.secondary">{hint}</Typography>
    </CardActionArea></Card>
  );
}

const TRADEABLE = ["created", "assayed", "in_transit"];

export default function Dashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const role = user?.role ?? "";
  const c = CLUSTER[role] ?? "producer";

  const isExec = c === "executive";
  const isOff = c === "officer";
  const isReg = c === "regulator" || c === "admin" || isExec || isOff;
  const isFin = c === "finance";
  const isEnf = c === "enforcement";
  const isProd = c === "producer";
  const isBuy = c === "buyer";
  const isAssay = c === "assay";
  const isExp = c === "export";
  const isEnv = c === "environment";
  const isCour = c === "courier";
  const holdsLicence = isProd || isBuy;

  const batches = useBatchesQuery();
  const miners = useMinersQuery(undefined, { skip: !isReg });
  const certs = useCertificatesQuery(undefined, { skip: !(isReg || isExp) });
  const transfers = useTransfersQuery(undefined, { skip: !(isProd || isBuy || isAssay) });
  const receipts = useReceiptsQuery(undefined, { skip: !(isBuy || isFin) });
  const licenses = useLicensesQuery(undefined, { skip: !holdsLicence });
  const deliveries = useDeliveriesQuery(undefined, { skip: !(isCour || isProd || isExp || isEnf) });
  const revenue = useRevenueOverviewQuery(undefined, { skip: !(isReg || isFin) });
  const security = useSecurityOverviewQuery(undefined, { skip: !(isEnf || isReg) });
  const hotspots = useHotspotsGeoQuery(undefined, { skip: !isEnv });
  const anomalies = useAnomaliesQuery(undefined, { skip: !(isEnf || isReg) });
  const complianceRole = isReg || isEnf || isEnv;
  const illegal = useIllegalMiningAlertsQuery(undefined, { skip: !complianceRole });
  const reportsRole = isExec || isOff || c === "admin" || isEnv || isEnf;
  const pubReports = usePublicReportsQuery(undefined, { skip: !reportsRole });
  const newReports = (pubReports.data?.results ?? []).filter((r) => r.status === "new").length;

  const rows = batches.data?.results ?? [];
  const available = rows.filter((b) => TRADEABLE.includes(b.status)).length;
  const myHoldings = rows.filter((b) => b.current_owner === user?.id).length;
  const inCirculation = rows.filter((b) => b.status !== "exported").length;
  const myLicence = (licenses.data?.results ?? []).find((l) => l.holder === user?.id);
  const revValue = revenue.data
    ? `GHS ${Number(revenue.data.summary?.total_export_value_ghs ?? 0).toLocaleString()}` : "—";

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Welcome, {user?.first_name || user?.role_display || "there"}</Typography>
        <Typography color="text.secondary">{MANDATE[c]}</Typography>
      </Box>

      {reportsRole && pubReports.data && (pubReports.data.results?.length ?? 0) > 0 && (
        <Card sx={{ borderLeft: "4px solid #C9A227" }}><CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">Public reports · {pubReports.data.results.length} received</Typography>
              <Typography variant="body2" color="text.secondary">
                {newReports} new and unassigned · citizen reports of illegal mining feed the map and alerts
              </Typography>
            </Box>
            <Button size="small" variant="contained" onClick={() => navigate("/reports")}
              sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Review & assign</Button>
          </Stack>
        </CardContent></Card>
      )}

      {complianceRole && illegal.data && illegal.data.summary.total > 0 && (
        <Card sx={{ border: "1px solid #E0B4AE", bgcolor: "#FBF3F1" }}><CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" color="error">
              🛰 Illegal-mining alerts · {illegal.data.summary.total} location{illegal.data.summary.total === 1 ? "" : "s"}
            </Typography>
            <Chip color="error" size="small"
              label={`${illegal.data.summary.critical} critical · ${illegal.data.summary.high} high`} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Predicted by the detection model from satellite/field signals and concession geometry. Exact coordinates below.
          </Typography>
          <Stack spacing={0.75}>
            {illegal.data.alerts.slice(0, 5).map((al: import("../types").IllegalAlert, i: number) => (
              <Stack key={i} direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <Chip size="small" label={`${Math.round(al.probability * 100)}%`}
                  color={al.band === "critical" ? "error" : "warning"} sx={{ minWidth: 56 }} />
                <Typography className="mono" sx={{ fontSize: 13 }}>{al.latitude.toFixed(5)}, {al.longitude.toFixed(5)}</Typography>
                <Typography variant="body2" color="text.secondary">{al.region}</Typography>
                <a href={al.maps_link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#7A6A2E" }}>Open location ↗</a>
              </Stack>
            ))}
          </Stack>
          <Button size="small" sx={{ mt: 1.5 }} onClick={() => navigate("/sites")}>View all on Mining sites →</Button>
        </CardContent></Card>
      )}

      {(isReg) && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Registered miners" value={miners.data?.count ?? "—"} />
            <Stat label="Gold batches" value={batches.data?.count ?? "—"} />
            <Stat label="Export certificates" value={certs.data?.count ?? "—"} />
            <Stat label="AI anomalies" value={anomalies.data?.summary.total ?? "—"}
              sub={anomalies.data ? `${anomalies.data.summary.critical} critical` : undefined} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {isExec ? (<>
              <Quick label="AI recommendations" hint="Executive intelligence →" to="/intelligence" />
              <Quick label="National transparency" hint="Production, exports, FX →" to="/transparency" />
              <Quick label="Compliance map" hint="Who's violating, where →" to="/map" />
            </>) : isOff ? (<>
              <Quick label="Purchase requests" hint="Approve or review trades →" to="/requests" />
              <Quick label="Licensing" hint="Issue, renew, suspend →" to="/licensing" />
              <Quick label="Security" hint="Incidents & clearance →" to="/security" />
            </>) : (<>
              <Quick label="Risk intelligence" hint="AI anomalies & AML →" to="/intelligence" />
              <Quick label="Revenue" hint="Exports & royalties →" to="/revenue" />
              <Quick label="Licensing" hint="Issue & verify licences →" to="/licensing" />
            </>)}
            {c === "admin"
              ? <Quick label="User management" hint="Add & assign roles →" to="/users" />
              : <Quick label="Compliance" hint="KYC & due diligence →" to="/compliance" />}
          </Box>
        </>
      )}

      {isFin && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Export value" value={revValue} />
            <Stat label="Payment receipts" value={receipts.data?.count ?? "—"} />
            <Stat label="Gold batches" value={batches.data?.count ?? "—"} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Quick label="Revenue" hint="Value, royalties & BoG rate →" to="/revenue" />
            <Quick label="Receipts" hint="Reconcile payments →" to="/receipts" />
            <Quick label="Track gold" hint="Trace any batch →" to="/track" />
          </Box>
        </>
      )}

      {isEnf && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Open incidents" value={security.data?.open_incidents?.length ?? "—"} />
            <Stat label="At-risk custody" value={security.data?.at_risk?.length ?? "—"} />
            <Stat label="Batches in play" value={inCirculation} />
            <Stat label="AI anomalies" value={anomalies.data?.summary.total ?? "—"}
              sub={anomalies.data ? `${anomalies.data.summary.critical} critical` : undefined} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Mining sites (satellite)" hint="Illegal-mining locations →" to="/sites" />
            <Quick label="Security" hint="Incidents & recovery →" to="/security" />
            <Quick label="Anomaly detection" hint="AI-flagged patterns →" to="/intelligence" />
            <Quick label="Verify passport" hint="Scan at the border →" to="/verify" />
          </Box>
        </>
      )}

      {isProd && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Your gold batches" value={batches.data?.count ?? "—"} />
            <Stat label="Transfers" value={transfers.data?.count ?? "—"} />
            <Stat label="Your licence"
              value={myLicence ? (myLicence.is_valid ? "Active" : "Attention") : "—"}
              sub={myLicence?.license_number} />
            <Stat label="Deliveries" value={deliveries.data?.count ?? "—"} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Register a batch" hint="Log new gold →" to="/batches" />
            <Quick label="Marketplace" hint="List gold for sale →" to="/marketplace" />
            <Quick label="Purchase requests" hint="Approve buyers →" to="/requests" />
            <Quick label="Licensing" hint="Renew your licence →" to="/licensing" />
          </Box>
        </>
      )}

      {isBuy && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Available to buy" value={available} sub="in the supply chain" />
            <Stat label="Your holdings" value={myHoldings} />
            <Stat label="Receipts issued" value={receipts.data?.count ?? "—"} />
            <Stat label="Your licence"
              value={myLicence ? (myLicence.is_valid ? "Active" : "Attention") : "—"}
              sub={myLicence?.license_number} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Marketplace" hint="Buy available gold →" to="/marketplace" />
            <Quick label="Purchase requests" hint="Track your buys →" to="/requests" />
            <Quick label="Receipts" hint="Print for customers →" to="/receipts" />
            <Quick label="Licensing" hint="Renew your licence →" to="/licensing" />
          </Box>
        </>
      )}

      {isAssay && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Batches in custody" value={batches.data?.count ?? "—"} />
            <Stat label="Transfers" value={transfers.data?.count ?? "—"} />
            <Stat label="In circulation" value={inCirculation} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Quick label="Gold batches" hint="Assay & record fineness →" to="/batches" />
            <Quick label="Track gold" hint="Custody chain & seal check →" to="/track" />
            <Quick label="Transfers" hint="Batches in your custody →" to="/transfers" />
          </Box>
        </>
      )}

      {isExp && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Export certificates" value={certs.data?.count ?? "—"} />
            <Stat label="Gold batches" value={batches.data?.count ?? "—"} />
            <Stat label="Deliveries" value={deliveries.data?.count ?? "—"} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Certificates" hint="Certify exports →" to="/certificates" />
            <Quick label="Marketplace" hint="Source export gold →" to="/marketplace" />
            <Quick label="Verify passport" hint="Confirm provenance →" to="/verify" />
            <Quick label="Deliveries" hint="Dispatch transport →" to="/deliveries" />
          </Box>
        </>
      )}

      {isEnv && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-2 gap-4">
            <Stat label="Illegal-mining hotspots" value={hotspots.data?.features?.length ?? "—"} />
            <Stat label="Batches in circulation" value={inCirculation} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Quick label="Mining sites (satellite)" hint="Detect & confirm illegal sites →" to="/sites" />
            <Quick label="National map" hint="Hotspots & concessions →" to="/map" />
            <Quick label="Environmental risk" hint="Regional register →" to="/revenue" />
          </Box>
        </>
      )}

      {isCour && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Stat label="Your delivery jobs" value={deliveries.data?.count ?? 0} />
            <Chip sx={{ alignSelf: "center" }} label="Bonded transport" color="secondary" />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Quick label="Carrier operations" hint="Go online & accept jobs →" to="/courier" />
            <Quick label="Deliveries" hint="Your active runs →" to="/deliveries" />
            <Quick label="Track a parcel" hint="Live tracking →" to="/track" />
          </Box>
        </>
      )}
    </Stack>
  );
}
