import { useState } from "react";
import { Alert, Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "react-router-dom";
import { useBatchesQuery, useCreateBatchMutation, useMinersQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";

// Batches originate at the source — only these roles may create them.
const CREATOR_ROLES = ["miner", "mining_company", "goldbod_officer", "super_admin",
  "tier1_buyer", "tier2_buyer", "aggregator", "buying_agent"];

export default function Batches() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const canCreate = CREATOR_ROLES.includes(role);
  const isMiner = role === "miner";

  const { data, refetch } = useBatchesQuery();
  const { data: miners } = useMinersQuery(undefined, { skip: isMiner || !canCreate });
  const [createBatch, { isLoading }] = useCreateBatchMutation();

  const [open, setOpen] = useState(false);
  const [gross, setGross] = useState("");
  const [fineness, setFineness] = useState("");
  const [miner, setMiner] = useState("");
  const [err, setErr] = useState("");
  const rows = data?.results ?? [];

  const create = async () => {
    setErr("");
    try {
      await createBatch({
        gross_weight_g: gross,
        fineness: fineness ? Number(fineness) : null,
        ...(isMiner ? {} : { miner }),
      }).unwrap();
      setOpen(false); setGross(""); setFineness(""); setMiner("");
      refetch();
    } catch (e: unknown) {
      const detail = (e as { data?: { miner?: string[]; detail?: string } })?.data;
      setErr(detail?.detail || detail?.miner?.[0] || "Could not create the batch. Check the fields and try again.");
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Gold batches</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>New batch</Button>
        )}
      </Stack>

      {!canCreate && (
        <Alert severity="info">
          Your role has oversight of gold batches. New batches are registered by licensed miners
          at the source of production.
        </Alert>
      )}

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Batch</TableCell><TableCell>Gross (g)</TableCell>
              <TableCell>Fineness</TableCell><TableCell>Status</TableCell><TableCell /></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell className="mono">{b.batch_code}</TableCell>
                <TableCell>{b.gross_weight_g}</TableCell>
                <TableCell>{b.fineness ? <Chip size="small" color="secondary" label={b.fineness} /> : "—"}</TableCell>
                <TableCell>{b.status_display}</TableCell>
                <TableCell align="right">
                  <Button component={Link} to={`/batches/${b.id}`} size="small">Passport</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5}>
                <Typography color="text.secondary">
                  {canCreate ? "No batches yet — create the first one." : "No batches to display."}
                </Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New gold batch</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {!isMiner && (
              <TextField select label="Originating miner" value={miner}
                onChange={(e) => setMiner(e.target.value)} fullWidth>
                {(miners?.results ?? []).map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.license_number} · {m.region}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField label="Gross weight (g)" value={gross} onChange={(e) => setGross(e.target.value)} />
            <TextField label="Fineness (per 1000)" value={fineness} onChange={(e) => setFineness(e.target.value)} />
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create}
            disabled={isLoading || !gross || (!isMiner && !miner)}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Create batch</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
