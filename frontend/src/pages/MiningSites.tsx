import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useDetectionsQuery, useIngestDetectionMutation, useSetDetectionStatusMutation,
  useEnvironmentalRiskQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";

const COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  licensed: "success", unverified: "warning", suspected_illegal: "error", confirmed_illegal: "error", dismissed: "default",
};

export default function MiningSites() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const canIngest = ["super_admin","ceo","goldbod_officer","env_officer","security_agency"].includes(role);
  const { data } = useDetectionsQuery();
  const { data: env } = useEnvironmentalRiskQuery();
  const [ingest, { isLoading }] = useIngestDetectionMutation();
  const [setStatus] = useSetDetectionStatusMutation();
  const [f, setF] = useState({ latitude: "", longitude: "", region: "", source: "satellite", confidence: "0.8", operator_name: "" });
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const rows = data?.results ?? [];
  const illegal = rows.filter((r) => r.status.includes("illegal")).length;

  const submit = async () => {
    try {
      const r = await ingest({ latitude: Number(f.latitude), longitude: Number(f.longitude), region: f.region,
        source: f.source, confidence: Number(f.confidence), operator_name: f.operator_name }).unwrap();
      setMsg({ type: r.status === "licensed" ? "success" : "error",
        text: r.status === "licensed" ? `Inside licensed concession ${r.concession_ref}.`
          : "OUTSIDE any licensed concession — flagged as suspected illegal mining and raised as a hotspot." });
      setF({ ...f, latitude: "", longitude: "", operator_name: "" });
    } catch { setMsg({ type: "error", text: "Could not record the detection." }); }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Mining sites — satellite detections</Typography>
        <Typography color="text.secondary">
          Every detected mining site, legal or illegal, reconciled against licensed concessions.
          Activity outside any concession is flagged automatically.
        </Typography>
      </Box>
      <Stack direction="row" spacing={1.5}>
        <Chip label={`${rows.length} sites detected`} />
        <Chip color="error" label={`${illegal} suspected / confirmed illegal`} />
      </Stack>

      {env && env.regions.length > 0 && (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Environmental risk by region</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {env.regions.map((rg) => (
              <Chip key={rg.region} label={`${rg.region} · ${rg.risk_score} (${rg.hotspots} hotspots)`}
                color={rg.band === "low" ? "success" : rg.band === "medium" ? "warning" : "error"} />
            ))}
          </Stack>
        </CardContent></Card>
      )}

      {canIngest && (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Record a detection</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter coordinates from satellite analysis or a field report. The system checks them against
            every licensed concession and flags unlicensed activity.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <TextField size="small" label="Latitude" value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} sx={{ width: 140 }} />
            <TextField size="small" label="Longitude" value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} sx={{ width: 140 }} />
            <TextField size="small" label="Region" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} sx={{ width: 160 }} />
            <TextField size="small" select label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} sx={{ width: 150 }}>
              <MenuItem value="satellite">Satellite</MenuItem><MenuItem value="field_report">Field report</MenuItem>
            </TextField>
            <TextField size="small" label="Confidence (0-1)" value={f.confidence} onChange={(e) => setF({ ...f, confidence: e.target.value })} sx={{ width: 140 }} />
            <TextField size="small" label="Operator (if known)" value={f.operator_name} onChange={(e) => setF({ ...f, operator_name: e.target.value })} sx={{ width: 200 }} />
          </Stack>
          {msg && <Alert severity={msg.type} sx={{ mt: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
          <Button variant="contained" sx={{ mt: 2, bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}
            disabled={isLoading || !f.latitude || !f.longitude} onClick={submit}>Check & record</Button>
        </CardContent></Card>
      )}

      <Card>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Location</TableCell><TableCell>Region</TableCell><TableCell>Source</TableCell>
            <TableCell>Confidence</TableCell><TableCell>Operator</TableCell><TableCell>Status</TableCell>
            <TableCell align="right">Disposition</TableCell></TableRow></TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell className="mono">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</TableCell>
                <TableCell>{r.region || "—"}</TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell>{Math.round(r.confidence * 100)}%</TableCell>
                <TableCell>{r.operator_name || (r.concession_ref ? `Licensed · ${r.concession_ref}` : "Unregistered")}</TableCell>
                <TableCell><Chip size="small" color={COLOR[r.status] ?? "default"} label={r.status_display} /></TableCell>
                <TableCell align="right">
                  {canIngest && r.status !== "licensed" && (<>
                    <Button size="small" color="error" onClick={() => setStatus({ id: r.id, status: "confirmed_illegal" })}>Confirm illegal</Button>
                    <Button size="small" onClick={() => setStatus({ id: r.id, status: "dismissed" })}>Dismiss</Button>
                  </>)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7}>
              <Typography color="text.secondary">No detections yet. Record one above or connect a satellite feed to POST to /gis/detections/.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
