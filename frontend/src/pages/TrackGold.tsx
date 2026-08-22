import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import GppGoodIcon from "@mui/icons-material/GppGood";
import ReportIcon from "@mui/icons-material/ReportProblem";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useTrackGoldQuery, useReportIncidentMutation, useScanSealMutation,
  useClearSecurityMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";
import ChainTimeline from "../components/ChainTimeline";

const SEC: Record<string, { color: string; label: string }> = {
  normal: { color: "#2E7D52", label: "Accounted for" },
  flagged: { color: "#D9822B", label: "Flagged" },
  missing: { color: "#B23A2E", label: "Reported missing" },
  stolen: { color: "#B23A2E", label: "Reported stolen" },
  recovered: { color: "#2E7D52", label: "Recovered" },
};
const CAN_REPORT = ["super_admin", "goldbod_officer", "ceo", "security_agency", "customs_officer"];
const CAN_CLEAR = ["super_admin", "goldbod_officer", "ceo", "security_agency"];

export default function TrackGold() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const { data, isFetching, isError } = useTrackGoldQuery(code, { skip: !code });
  const [report, { isLoading }] = useReportIncidentMutation();
  const [scanSeal] = useScanSealMutation();
  const [clearSecurity, { isLoading: clearing }] = useClearSecurityMutation();
  const [sealInput, setSealInput] = useState("");
  const [sealResult, setSealResult] = useState<{ ok: boolean; note: string } | null>(null);
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const canReport = CAN_REPORT.includes(role);
  const canClear = CAN_CLEAR.includes(role);

  const flag = (incident_type: string) => {
    if (!data) return;
    report({ batch: data.batch_id, incident_type, note: `Reported ${incident_type} via tracking` });
  };

  const doScan = async () => {
    if (!data || !sealInput.trim()) return;
    try {
      const r = await scanSeal({ id: data.batch_id, seal_number: sealInput.trim() }).unwrap();
      setSealResult({ ok: r.match, note: r.note });
    } catch {
      setSealResult({ ok: false, note: "Could not verify the seal." });
    }
  };

  const sec = data ? SEC[data.security_status] ?? SEC.normal : null;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Track gold</Typography>
        <Typography color="text.secondary">Trace any single batch end to end — origin, custody, location and security.</Typography>
      </Box>
      <Stack direction="row" spacing={1.5}>
        <TextField fullWidth placeholder="GH-XXXXXXXXXX" value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && setCode(input.trim())} />
        <Button variant="contained" onClick={() => setCode(input.trim())} disabled={!input}>Track</Button>
      </Stack>

      {isError && code && <Typography color="error">No gold found for {code}.</Typography>}
      {isFetching && <Typography color="text.secondary">Locating…</Typography>}

      {data && sec && (
        <>
          <Card sx={{ borderLeft: `5px solid ${sec.color}` }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Box>
                  <Typography variant="h5" className="mono">{data.batch_code}</Typography>
                  <Typography color="text.secondary">
                    {data.miner_license} · {data.gross_weight_g} g · {data.status}
                    {data.current_owner ? ` · held by ${data.current_owner}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip label={sec.label} sx={{ bgcolor: sec.color, color: "#fff", height: 34 }} />
                  <Chip icon={<GppGoodIcon />} color={data.chain_valid ? "success" : "error"}
                    label={data.chain_valid ? "Chain verified" : "Chain tampered"} sx={{ height: 34 }} />
                </Stack>
              </Stack>

              {(data.security_status === "stolen" || data.security_status === "missing") && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  This gold is {sec.label.toLowerCase()}. Enforcement has been notified.
                </Alert>
              )}
              {data.last_location && (
                <Typography variant="body2" sx={{ mt: 2 }}>
                  Last known position: {data.last_location.lat.toFixed(4)}, {data.last_location.lng.toFixed(4)}
                  {data.last_location.seal ? ` · seal ${data.last_location.seal}` : ""} ({data.last_location.status})
                </Typography>
              )}

              {canReport && data.security_status === "normal" && (
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button variant="outlined" color="warning" startIcon={<ReportIcon />} disabled={isLoading}
                    onClick={() => flag("missing")}>Report missing</Button>
                  <Button variant="contained" color="error" startIcon={<ReportIcon />} disabled={isLoading}
                    onClick={() => flag("stolen")}>Report stolen</Button>
                </Stack>
              )}
            </CardContent>
          </Card>

          {data.tamper && (
            <Card sx={{ border: "1px solid #E0B4AE", bgcolor: "#FBF3F1" }}><CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <LinkOffIcon color="error" />
                <Typography variant="h6" color="error">Tamper &amp; theft detail</Typography>
              </Stack>
              <Typography sx={{ mb: 1.5 }}>{data.tamper.message}</Typography>
              <Box className="grid grid-cols-2 gap-2" sx={{ fontSize: 14 }}>
                <div><b>Security status:</b> {data.tamper.security_status}</div>
                <div><b>Custody chain:</b> {data.tamper.chain_intact ? "Intact" : "BROKEN"}</div>
                {data.chain_length != null && <div><b>Verified links:</b> {data.chain_length}</div>}
                {data.tamper.chain_broken_at != null && <div><b>Broke at link #:</b> {data.tamper.chain_broken_at + 1}</div>}
                {data.tamper.recorded_seal && <div><b>Recorded seal:</b> {data.tamper.recorded_seal}</div>}
                <div><b>Open incidents:</b> {data.tamper.open_incident_count}</div>
              </Box>
              {data.tamper.broken_link && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Trust breaks at the <b>{data.tamper.broken_link.event}</b> event
                  {data.tamper.broken_link.actor ? ` by ${data.tamper.broken_link.actor}` : ""}
                  {data.tamper.broken_link.at ? ` on ${new Date(data.tamper.broken_link.at).toLocaleString()}` : ""}.
                  Every custody record after this point is unverifiable.
                </Alert>
              )}
              {canClear && (
                <Button variant="contained" color="success" sx={{ mt: 2 }} disabled={clearing}
                  onClick={() => clearSecurity({ id: data.batch_id, note: "Cleared via tracking" })}>
                  Clear flag — mark recovered
                </Button>
              )}
            </CardContent></Card>
          )}

          {data.incidents.length > 0 && (
            <Card><CardContent>
              <Typography variant="h6" gutterBottom>Incident history</Typography>
              <Stack spacing={1.25}>
                {data.incidents.map((i, idx) => (
                  <Box key={idx} sx={{ borderLeft: "3px solid #B23A2E", pl: 1.5 }}>
                    <Typography sx={{ fontWeight: 600 }}>{i.type} · {i.status}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {i.note}
                      {i.reported_by ? ` — reported by ${i.reported_by}` : ""}
                      {i.reported_at ? ` on ${new Date(i.reported_at).toLocaleString()}` : ""}
                      {i.last_seen ? ` · last seen ${i.last_seen.lat.toFixed(4)}, ${i.last_seen.lng.toFixed(4)}` : ""}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent></Card>
          )}

          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Verify tamper-evident seal</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scan or type the physical seal on the parcel. A mismatch against the recorded seal
              raises a tamper incident and flags the gold immediately.
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <TextField fullWidth size="small" placeholder="Seal number on the parcel"
                value={sealInput} onChange={(e) => setSealInput(e.target.value)} />
              <Button variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={doScan}
                disabled={!sealInput.trim()}>Check seal</Button>
            </Stack>
            {sealResult && (
              <Alert severity={sealResult.ok ? "success" : "error"} sx={{ mt: 2 }}>{sealResult.note}</Alert>
            )}
          </CardContent></Card>

          <Card><CardContent>
            <ChainTimeline events={data.custody_chain} valid={data.chain_valid} />
          </CardContent></Card>
        </>
      )}
    </Stack>
  );
}
