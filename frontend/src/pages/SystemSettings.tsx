import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, MenuItem,
  Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useAllRoleFeaturesQuery, useSetRoleFeaturesMutation, usePositionsQuery,
  useCreatePositionMutation, useDeletePositionMutation, useSystemConfigQuery,
  useUpdateSystemConfigMutation } from "../services/api";
import { ROLES } from "./Users";
import type { Position, SystemConfig } from "../types";

const FEATURES: [key: string, label: string][] = [
  ["overview","Overview"], ["miners","Miners"], ["companies","Mining companies"], ["batches","Gold batches"],
  ["track","Track gold"], ["transfers","Transfers"], ["deliveries","Deliveries"], ["courier","Carrier operations"],
  ["marketplace","Marketplace"], ["requests","Purchase requests"], ["receipts","Receipts"], ["certificates","Certificates"],
  ["intelligence","Risk intelligence"], ["security","Security"], ["compliance","Compliance"], ["licensing","Licensing"],
  ["verify","Verify passport"], ["map","Geospatial map"], ["sites","Mining sites (satellite)"], ["reports","Public reports"],
  ["revenue","Revenue"], ["transparency","Transparency"], ["users","User management"], ["settings","System settings"],
  ["profile","My profile"],
];

function FeaturesTab() {
  const { data: all } = useAllRoleFeaturesQuery();
  const [save, { isLoading }] = useSetRoleFeaturesMutation();
  const [role, setRole] = useState("ceo");
  const [sel, setSel] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setSel(all?.[role] ?? []); }, [all, role]);
  const toggle = (k: string) => setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  return (
    <Card><CardContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which features each role sees. Nothing ticked = the role's built-in defaults.
      </Typography>
      <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)} sx={{ minWidth: 260, mb: 2 }}>
        {ROLES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
      </TextField>
      <Box className="grid grid-cols-2 lg:grid-cols-3 gap-1">
        {FEATURES.map(([k, l]) => (
          <FormControlLabel key={k} label={l}
            control={<Checkbox size="small" checked={sel.includes(k)} onChange={() => toggle(k)} />} />
        ))}
      </Box>
      {msg && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setMsg(null)}>{msg}</Alert>}
      <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
        <Button variant="contained" disabled={isLoading} sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}
          onClick={async () => { await save({ role, features: sel }).unwrap(); setMsg(`Saved features for ${role}.`); }}>Save for this role</Button>
        <Button onClick={() => { setSel([]); }}>Select all</Button>
        <Button onClick={() => setSel(FEATURES.map(([k]) => k))}>Tick everything</Button>
      </Stack>
    </CardContent></Card>
  );
}

function PositionsTab() {
  const { data } = usePositionsQuery();
  const [create, { isLoading }] = useCreatePositionMutation();
  const [remove] = useDeletePositionMutation();
  const [pos, setPos] = useState({ title: "", base_role: "goldbod_officer", description: "" });
  const rows = data?.results ?? [];
  return (
    <Stack spacing={2}>
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Create a position</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add any title — Deputy CEO, Director, Regional Manager — and choose which built-in role it inherits
          access from. Users assigned the position carry the title while keeping that role's permissions.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField label="Position title" placeholder="e.g. Deputy CEO" value={pos.title}
            onChange={(e) => setPos({ ...pos, title: e.target.value })} sx={{ flex: 1 }} />
          <TextField select label="Inherits access of" value={pos.base_role}
            onChange={(e) => setPos({ ...pos, base_role: e.target.value })} sx={{ minWidth: 220 }}>
            {ROLES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
          </TextField>
          <Button variant="contained" disabled={isLoading || !pos.title}
            onClick={async () => { await create(pos).unwrap(); setPos({ title: "", base_role: "goldbod_officer", description: "" }); }}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Create</Button>
        </Stack>
      </CardContent></Card>
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Existing positions</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {rows.map((p: Position) => (
            <Chip key={p.id} label={`${p.title} · inherits ${p.base_role_display} · ${p.user_count} user(s)`}
              onDelete={p.user_count === 0 ? () => remove(p.id) : undefined} />
          ))}
          {rows.length === 0 && <Typography color="text.secondary">No custom positions yet.</Typography>}
        </Stack>
      </CardContent></Card>
    </Stack>
  );
}

function GeneralTab() {
  const { data } = useSystemConfigQuery();
  const [save, { isLoading }] = useUpdateSystemConfigMutation();
  const [c, setC] = useState<Partial<SystemConfig>>({});
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (data) setC(data); }, [data]);
  const num = (k: keyof SystemConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) });
  const str = (k: keyof SystemConfig) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: e.target.value });
  return (
    <Stack spacing={2}>
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Organisation</Typography>
        <Stack spacing={2}>
          <TextField label="Organisation name" value={c.org_name ?? ""} onChange={str("org_name")} />
          <TextField label="Tagline" value={c.tagline ?? ""} onChange={str("tagline")} />
          <TextField label="Contact email" value={c.contact_email ?? ""} onChange={str("contact_email")} />
          <TextField label="Public report form title" value={c.report_form_title ?? ""} onChange={str("report_form_title")} />
        </Stack>
      </CardContent></Card>
      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Compliance thresholds</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These drive the pre-transaction gate, refinery reconciliation and BoG reconciliation live.
        </Typography>
        <Box className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField type="number" label="Block purchase at lot risk ≥" value={c.risk_block_threshold ?? 70} onChange={num("risk_block_threshold")} helperText="0–100" />
          <TextField type="number" label="Human review at lot risk ≥" value={c.risk_review_threshold ?? 45} onChange={num("risk_review_threshold")} helperText="0–100" />
          <TextField type="number" label="Mass-balance tolerance (%)" value={c.mass_balance_tolerance_pct ?? 0.5} onChange={num("mass_balance_tolerance_pct")} inputProps={{ step: 0.1 }} />
          <TextField type="number" label="FX discrepancy flag (%)" value={c.fx_discrepancy_pct ?? 5} onChange={num("fx_discrepancy_pct")} inputProps={{ step: 0.5 }} />
          <TextField type="number" label="Max attachments per public report" value={c.max_report_attachments ?? 8} onChange={num("max_report_attachments")} />
        </Box>
      </CardContent></Card>
      {msg && <Alert severity="success" onClose={() => setMsg(null)}>{msg}</Alert>}
      <Box>
        <Button variant="contained" disabled={isLoading} sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}
          onClick={async () => { await save(c).unwrap(); setMsg("Settings saved."); }}>Save settings</Button>
      </Box>
    </Stack>
  );
}

export default function SystemSettings() {
  const [tab, setTab] = useState(0);
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">System settings</Typography>
        <Typography color="text.secondary">Configure the platform without code changes.</Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Features by role" /><Tab label="Positions" /><Tab label="General & thresholds" />
      </Tabs>
      {tab === 0 && <FeaturesTab />}
      {tab === 1 && <PositionsTab />}
      {tab === 2 && <GeneralTab />}
    </Stack>
  );
}
