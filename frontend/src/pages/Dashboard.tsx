import { Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import {
  useBatchesQuery, useCertificatesQuery, useMinersQuery, useDeliveriesQuery,
  useTransfersQuery, useReceiptsQuery, useLicensesQuery, useRevenueOverviewQuery,
  useSecurityOverviewQuery, useHotspotsGeoQuery,
} from "../services/api";

// Each role maps to one operating cluster; every cluster has its own dashboard.
const CLUSTER: Record<string, string> = {
  super_admin: "admin", ceo: "regulator", goldbod_officer: "regulator",
  ministry_official: "regulator", bog_officer: "finance",
  customs_officer: "enforcement", security_agency: "enforcement",
  miner: "producer", mining_company: "producer",
  buying_agent: "buyer", tier1_buyer: "buyer", tier2_buyer: "buyer", aggregator: "buyer",
  assayer: "assay", refinery_operator: "assay",
  exporter: "export", international_buyer: "export",
  env_officer: "environment", rider: "courier", driver: "courier",
};

const MANDATE: Record<string, string> = {
  admin: "Full oversight and administration of every gram in the system.",
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
  const role = user?.role ?? "";
  const c = CLUSTER[role] ?? "producer";

  const isReg = c === "regulator" || c === "admin";
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

      {(isReg) && (
        <>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Registered miners" value={miners.data?.count ?? "—"} />
            <Stat label="Gold batches" value={batches.data?.count ?? "—"} />
            <Stat label="Export certificates" value={certs.data?.count ?? "—"} />
            <Stat label="In circulation" value={inCirculation} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Risk intelligence" hint="AML & batch risk →" to="/intelligence" />
            <Quick label="Revenue" hint="Exports & royalties →" to="/revenue" />
            <Quick label="Licensing" hint="Issue & verify licences →" to="/licensing" />
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
            <Stat label="Deliveries" value={deliveries.data?.count ?? "—"} />
          </Box>
          <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Quick label="Security" hint="Incidents & recovery →" to="/security" />
            <Quick label="Verify passport" hint="Scan at the border →" to="/verify" />
            <Quick label="Track gold" hint="Follow the chain →" to="/track" />
            <Quick label="Deliveries" hint="Bonded transport →" to="/deliveries" />
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
            <Quick label="Transfers" hint="Sell to a buyer →" to="/transfers" />
            <Quick label="Licensing" hint="Renew your licence →" to="/licensing" />
            <Quick label="Track gold" hint="Follow your gold →" to="/track" />
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
            <Quick label="Gold batches" hint="Find & register gold →" to="/batches" />
            <Quick label="Transfers" hint="Buy & sell on →" to="/transfers" />
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
            <Quick label="Track gold" hint="Custody chain →" to="/track" />
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
            <Quick label="Gold batches" hint="Your export gold →" to="/batches" />
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
            <Quick label="National map" hint="Hotspots & concessions →" to="/map" />
            <Quick label="Track gold" hint="Trace origin →" to="/track" />
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
