import { Alert, Box, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import { useAppSelector } from "../app/hooks";
import { useTradingRulesQuery } from "../services/api";
import ComplianceChecklist from "../components/ComplianceChecklist";

// GoldBod trading rules in plain language: who may sell to whom, what licence each tier needs.
export default function TradingRules() {
  const { data, isLoading } = useTradingRulesQuery();
  const user = useAppSelector((s) => s.auth.user);
  if (isLoading || !data) return <LinearProgress />;
  const me = data.me;
  const trading = data.roles.some((r) => r.role === me.role);
  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <GavelIcon sx={{ color: "#C9A227" }} />
          <Typography variant="h4">Trading rules</Typography>
        </Stack>
        <Typography color="text.secondary">
          Who may sell gold and who may buy it under the Ghana Gold Board Act, 2025 (Act 1140). The system
          enforces these rules on every sale. A trade outside them is refused, with the reason shown.
        </Typography>
      </Box>

      {trading && (
        <Box className="grid lg:grid-cols-2 gap-3">
          <Card sx={{ bgcolor: "#FFF9E6", border: "1px solid #E9D48A" }}><CardContent>
            <Typography variant="overline" color="text.secondary">You — {me.label}{user?.username ? ` (${user.username})` : ""}</Typography>
            <Typography sx={{ mt: 1 }}><b>You may sell to:</b> {me.sells_to.length ? me.sells_to.join(", ") : "No one. You hold gold only as its final buyer."}</Typography>
            <Typography sx={{ mt: 0.5 }}><b>You may buy from:</b> {me.buys_from.length ? me.buys_from.join(", ") : "No one. You only sell."}</Typography>
            <Alert severity={me.licence.ok ? "success" : "error"} sx={{ mt: 1.5 }}>
              <b>{me.licence.label}.</b> {me.licence.detail}
            </Alert>
          </CardContent></Card>
          <ComplianceChecklist compact />
        </Box>
      )}

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>The gold chain</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {["Licensed miner", "Tier 1 buyer", "Tier 2 buyer", "Aggregator", "GoldBod", "Refinery / Exporter", "Off-taker"].map((s, i, a) => (
            <Stack key={s} direction="row" spacing={0.5} alignItems="center">
              <Chip label={s} sx={{ bgcolor: s === "GoldBod" ? "#0C1813" : "#F4EEDC", color: s === "GoldBod" ? "#E9D48A" : "inherit", fontWeight: 600 }} />
              {i < a.length - 1 && <Typography sx={{ color: "#C9A227", fontSize: 20 }}>→</Typography>}
            </Stack>
          ))}
        </Stack>
        <Stack component="ul" spacing={0.75} sx={{ mt: 2, pl: 2.5 }}>
          {data.principles.map((p) => <Typography component="li" variant="body2" key={p}>{p}</Typography>)}
        </Stack>
      </CardContent></Card>

      <Box className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {data.roles.map((r) => (
          <Card key={r.role} sx={{ border: r.role === me.role ? "2px solid #C9A227" : undefined }}><CardContent>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{r.label}</Typography>
            <Typography variant="caption" color="text.secondary">Must hold: {r.licence}</Typography>
            <Typography variant="overline" display="block" sx={{ mt: 1, color: "#2E7D32" }}>May sell to</Typography>
            {r.sells_to.length === 0 && <Typography variant="body2" color="text.secondary">No one (final buyer)</Typography>}
            {r.sells_to.map((s) => (
              <Typography key={s.role} variant="body2" sx={{ mb: 0.5 }}>
                <b>{s.label}</b> <span style={{ color: "#666" }}>· {s.basis}</span>
              </Typography>
            ))}
            <Typography variant="overline" display="block" sx={{ mt: 1, color: "#1565C0" }}>May buy from</Typography>
            <Typography variant="body2">{r.buys_from.length ? r.buys_from.map((b) => b.label).join(", ") : "No one (producer)"}</Typography>
          </CardContent></Card>
        ))}
      </Box>
    </Stack>
  );
}
