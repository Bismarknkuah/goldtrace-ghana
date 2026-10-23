import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import { useReportLinksQuery, useCreateReportLinkMutation, usePublicReportsQuery, useAssignReportMutation,
  useSetReportStatusMutation, useAdminUsersQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";
import type { PublicReport } from "../types";

const STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error"> = {
  new: "error", under_review: "warning", resolved: "success", dismissed: "default",
};

export default function Reports() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const isManager = ["super_admin", "ceo", "goldbod_officer"].includes(role);
  const { data: links } = useReportLinksQuery(undefined, { skip: !isManager });
  const [createLink, { isLoading: creating }] = useCreateReportLinkMutation();
  const { data: reports } = usePublicReportsQuery();
  const { data: users } = useAdminUsersQuery(undefined, { skip: !isManager });
  const [assign] = useAssignReportMutation();
  const [setStatus] = useSetReportStatusMutation();
  const [open, setOpen] = useState<PublicReport | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const rows = reports?.results ?? [];
  const officers = (users?.results ?? []).filter((u) =>
    ["goldbod_officer", "env_officer", "security_agency", "customs_officer"].includes(u.role));
  const shareUrl = (token: string) => `${window.location.origin}/report/${token}`;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Public reports</Typography>
        <Typography color="text.secondary">
          Citizen reports of illegal mining and related issues. Located reports feed the map and alerts automatically.
        </Typography>
      </Box>

      {isManager && (
        <Card><CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="h6">Share links</Typography>
            <Button variant="contained" startIcon={<LinkIcon />} disabled={creating}
              onClick={() => createLink({ title: "Report illegal mining to GoldBod" })}
              sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Generate public link</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Share a link publicly (WhatsApp, radio, posters). Anyone who opens it can report without an account.
          </Typography>
          {(links?.results ?? []).map((l) => (
            <Stack key={l.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.75, flexWrap: "wrap" }}>
              <Typography className="mono" sx={{ fontSize: 13, wordBreak: "break-all" }}>{shareUrl(l.token)}</Typography>
              <Chip size="small" label={`${l.submissions} reports`} />
              <Button size="small" onClick={() => { navigator.clipboard.writeText(shareUrl(l.token)); setCopied(l.id); }}>
                {copied === l.id ? "Copied ✓" : "Copy link"}
              </Button>
            </Stack>
          ))}
          {(links?.results ?? []).length === 0 && <Typography color="text.secondary">No links yet.</Typography>}
        </CardContent></Card>
      )}

      <Card>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>When</TableCell><TableCell>Category</TableCell><TableCell>Location</TableCell>
            <TableCell>Media</TableCell><TableCell>Assigned</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{r.category_display}</TableCell>
                <TableCell className="mono" sx={{ fontSize: 12 }}>
                  {r.latitude != null ? `${r.latitude.toFixed(4)}, ${r.longitude?.toFixed(4)}` : (r.location_text || r.region || "—")}
                </TableCell>
                <TableCell>{r.attachment_count > 0 ? <Chip size="small" label={`${r.attachment_count} file(s)`} /> : "—"}</TableCell>
                <TableCell>{r.assigned_names.join(", ") || "—"}</TableCell>
                <TableCell><Chip size="small" color={STATUS_COLOR[r.status]} label={r.status_display} /></TableCell>
                <TableCell align="right"><Button size="small" onClick={() => { setOpen(r); setPick(r.assigned_to); }}>Open</Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7}>
              <Typography color="text.secondary">No reports yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!open} onClose={() => setOpen(null)} fullWidth maxWidth="md">
        {open && (<>
          <DialogTitle>{open.category_display} · {new Date(open.created_at).toLocaleString()}</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography>{open.description}</Typography>
              <Typography variant="body2" color="text.secondary">
                {open.reporter_name || "Anonymous"}{open.reporter_phone ? ` · ${open.reporter_phone}` : ""}
                {open.region ? ` · ${open.region}` : ""}{open.location_text ? ` · ${open.location_text}` : ""}
              </Typography>
              {open.latitude != null && (
                <a href={`https://www.google.com/maps?q=${open.latitude},${open.longitude}`} target="_blank" rel="noreferrer"
                  style={{ color: "#7A6A2E" }}>📍 {open.latitude.toFixed(5)}, {open.longitude?.toFixed(5)} — open location ↗</a>
              )}
              {open.attachments.length > 0 && (
                <Box className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {open.attachments.map((a, i) => a.type.startsWith("image/")
                    ? <img key={i} src={a.data} alt={a.name} style={{ width: "100%", borderRadius: 8 }} />
                    : a.type.startsWith("video/")
                      ? <video key={i} src={a.data} controls style={{ width: "100%", borderRadius: 8 }} />
                      : <a key={i} href={a.data} download={a.name} style={{ color: "#7A6A2E" }}>📎 {a.name}</a>)}
                </Box>
              )}
              {isManager && (
                <TextField select SelectProps={{ multiple: true }} label="Assign officers" value={pick}
                  onChange={(e) => setPick(typeof e.target.value === "string" ? e.target.value.split(",") : e.target.value as string[])}>
                  {officers.map((u) => <MenuItem key={u.id} value={u.id}>{u.username} · {u.role_display}</MenuItem>)}
                </TextField>
              )}
              {open.officer_note && <Alert severity="info">{open.officer_note}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
            {isManager && <Button onClick={() => assign({ id: open.id, user_ids: pick }).then(() => setOpen(null))}>Save assignment</Button>}
            <Button color="success" onClick={() => setStatus({ id: open.id, status: "resolved" }).then(() => setOpen(null))}>Resolve</Button>
            <Button color="inherit" onClick={() => setStatus({ id: open.id, status: "dismissed" }).then(() => setOpen(null))}>Dismiss</Button>
            <Button onClick={() => setOpen(null)}>Close</Button>
          </DialogActions>
        </>)}
      </Dialog>
    </Stack>
  );
}
