import { Alert, Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import GppBadIcon from "@mui/icons-material/GppBad";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { Provenance } from "../types";
import TrailMap from "./TrailMap";

const VERDICT = {
  trusted: { color: "#2E7D32", bg: "#EDF6EE", icon: <VerifiedUserIcon />, label: "TRUSTED" },
  caution: { color: "#B26A00", bg: "#FFF6E5", icon: <WarningAmberIcon />, label: "CAUTION" },
  compromised: { color: "#B23A2E", bg: "#FBEDEB", icon: <GppBadIcon />, label: "COMPROMISED" },
} as const;

const STEP_COLOR: Record<string, string> = {
  origin: "#C9A227", assay: "#2E7D32", sale: "#1565C0", offer: "#5C6BC0", transport: "#6A1B9A",
  refine: "#D9822B", export: "#0C1813", aggregate: "#8D6E63", incident: "#B23A2E",
};

const when = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

// The interpretable trace: verdict → direct answers → owners → journey → map.
export default function ProvenanceStory({ p, code }: { p: Provenance; code: string }) {
  const v = VERDICT[p.verdict.level];
  return (
    <Stack spacing={3}>
      {/* 1. Verdict — one line anyone can act on */}
      <Card sx={{ bgcolor: v.bg, border: `1px solid ${v.color}` }}><CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: v.color }}>
          {v.icon}
          <Typography sx={{ fontWeight: 800, letterSpacing: 1 }}>{v.label}</Typography>
          <Typography sx={{ color: "text.primary", fontWeight: 600 }}>{p.verdict.headline}</Typography>
        </Stack>
        <Box className="grid sm:grid-cols-2 gap-x-6 gap-y-1" sx={{ mt: 1.5 }}>
          {p.verdict.problems.map((r) => (
            <Stack key={r} direction="row" spacing={1} alignItems="flex-start">
              <ErrorOutlineIcon sx={{ fontSize: 18, color: "#B23A2E", mt: "2px" }} />
              <Typography variant="body2">{r}</Typography>
            </Stack>))}
          {p.verdict.warnings.map((r) => (
            <Stack key={r} direction="row" spacing={1} alignItems="flex-start">
              <WarningAmberIcon sx={{ fontSize: 18, color: "#B26A00", mt: "2px" }} />
              <Typography variant="body2">{r}</Typography>
            </Stack>))}
          {p.verdict.assurances.map((r) => (
            <Stack key={r} direction="row" spacing={1} alignItems="flex-start">
              <CheckCircleIcon sx={{ fontSize: 18, color: "#2E7D32", mt: "2px" }} />
              <Typography variant="body2">{r}</Typography>
            </Stack>))}
        </Box>
      </CardContent></Card>

      {/* 2. Plain answers to the questions people actually ask */}
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Everything about {code} at a glance</Typography>
        <Box className="grid sm:grid-cols-2 gap-3">
          {p.answers.map((a) => (
            <Box key={a.q} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "#FBF9F3", border: "1px solid #EEE7D6" }}>
              <Typography variant="caption" sx={{ color: "#7A6A2E", fontWeight: 700, letterSpacing: 0.3 }}>
                {a.q.toUpperCase()}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>{a.a}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent></Card>

      {/* 3. Source + current owner + assay — the three anchors */}
      <Box className="grid lg:grid-cols-3 gap-3">
        <Card><CardContent>
          <Typography variant="overline" color="text.secondary">Source</Typography>
          <Typography sx={{ fontWeight: 700 }}>{p.source.producer?.name ?? "Unknown producer"}</Typography>
          <Typography variant="body2" color="text.secondary">
            Licence {p.source.licence_number} · {p.source.licence_status}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {p.source.concession ? `${p.source.concession.name} (${p.source.concession.code})` : "No concession linked"}
            <br />{p.source.district ? `${p.source.district}, ` : ""}{p.source.region} Region
          </Typography>
          {p.source.origin && (
            <Typography variant="caption" color="text.secondary" className="mono">
              {p.source.origin.lat.toFixed(5)}, {p.source.origin.lng.toFixed(5)} · {p.source.origin.basis}
            </Typography>
          )}
          {p.source.aggregated_from.length > 0 && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Combined from: <span className="mono">{p.source.aggregated_from.join(", ")}</span>
            </Typography>
          )}
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="overline" color="text.secondary">Current owner</Typography>
          {p.current_owner ? (<>
            <Typography sx={{ fontWeight: 700 }}>{p.current_owner.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {p.current_owner.role}{p.current_owner.region ? ` · ${p.current_owner.region}` : ""}
            </Typography>
            {p.current_owner.since && <Typography variant="body2" sx={{ mt: 1 }}>Owner since {when(p.current_owner.since)}</Typography>}
          </>) : <Typography color="text.secondary">No owner recorded</Typography>}
          {p.pending_offers.length > 0 && (
            <Alert severity="info" sx={{ mt: 1.5, py: 0 }}>
              {p.pending_offers.length} pending offer{p.pending_offers.length > 1 ? "s" : ""}:{" "}
              {p.pending_offers.map((o) => `${o.buyer}${o.offer ? ` (${o.offer})` : ""}`).join(", ")}
            </Alert>
          )}
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="overline" color="text.secondary">Assay & value</Typography>
          {p.assay ? (<>
            <Typography sx={{ fontWeight: 700 }}>{p.assay.purity_pct}% pure · {p.assay.fine_weight_g} g fine</Typography>
            <Typography variant="body2" color="text.secondary">
              {p.assay.method} by {p.assay.assayer?.name ?? "assayer"} · {p.assay.certificate_no}
            </Typography>
          </>) : <Typography sx={{ fontWeight: 700, color: "#B26A00" }}>Not yet assayed</Typography>}
          <Typography variant="body2" sx={{ mt: 1 }}>
            Reference value: <b>{p.value.reference_value ?? "—"}</b>
          </Typography>
          <Typography variant="caption" color="text.secondary">{p.value.basis}{p.value.reference_rate ? ` (${p.value.reference_rate}/g)` : ""}</Typography>
        </CardContent></Card>
      </Box>

      {/* 4. Chain of ownership — every hand, in order */}
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Chain of ownership</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={0} alignItems={{ md: "stretch" }}>
          {p.owners.map((o, i) => (
            <Stack key={i} direction={{ xs: "column", md: "row" }} alignItems="center" sx={{ flex: 1 }}>
              <Box sx={{ flex: 1, width: "100%", p: 1.5, borderRadius: 1.5,
                border: `2px solid ${o.current ? "#C9A227" : o.irregular ? "#D9822B" : "#E6E0D0"}`,
                bgcolor: o.current ? "#FFF9E6" : "background.paper" }}>
                <Typography variant="caption" color="text.secondary">
                  {i === 0 ? "PRODUCER" : `OWNER ${i + 1}`}{o.current ? " · CURRENT" : ""}
                </Typography>
                <Typography sx={{ fontWeight: 700 }}>{o.holder?.name ?? "Unknown"}</Typography>
                <Typography variant="body2" color="text.secondary">{o.holder?.role}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{o.how}{o.price ? ` · ${o.price}` : ""}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {when(o.acquired_at)}{o.until ? ` → ${when(o.until)}` : " → now"}
                </Typography>
                {o.receipt && <Typography variant="caption" display="block" className="mono">Receipt {o.receipt}</Typography>}
                {o.irregular && <Chip size="small" color="warning" label="Out-of-order sale" sx={{ mt: 0.5 }} />}
              </Box>
              {i < p.owners.length - 1 && (
                <Typography sx={{ px: 1, py: 0.5, color: "#C9A227", fontSize: 22,
                  transform: { xs: "rotate(90deg)", md: "none" } }}>→</Typography>
              )}
            </Stack>
          ))}
        </Stack>
      </CardContent></Card>

      {/* 5. The journey, in sentences, plus where it physically went */}
      <Box className="grid lg:grid-cols-2 gap-3">
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>The gold's journey</Typography>
          <Stack spacing={0}>
            {p.journey.map((s, i) => {
              const c = s.ok ? (STEP_COLOR[s.kind] ?? "#555") : "#B23A2E";
              return (
                <Stack key={i} direction="row" spacing={1.5}>
                  <Stack alignItems="center">
                    <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: c, mt: 0.5 }} />
                    {i < p.journey.length - 1 && <Box sx={{ width: 2, flex: 1, bgcolor: "#E6E0D0" }} />}
                  </Stack>
                  <Box sx={{ pb: 2 }}>
                    <Typography variant="caption" color="text.secondary">{when(s.at)}</Typography>
                    <Typography sx={{ fontWeight: 700, color: s.ok ? "text.primary" : "#B23A2E" }}>{s.title}</Typography>
                    <Typography variant="body2">{s.sentence}</Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </CardContent></Card>
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Where it has been</Typography>
          <TrailMap trail={p.trail} position={p.position} />
          {p.position && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <b>Now:</b> {p.position.label} ({p.position.lat.toFixed(5)}, {p.position.lng.toFixed(5)})
            </Typography>
          )}
        </CardContent></Card>
      </Box>
    </Stack>
  );
}
