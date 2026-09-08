import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, useParams } from "react-router-dom";
import { useBatchQuery, useBatchGraphQuery, useVerifyBatchQuery, useRefineBatchMutation, API_ORIGIN } from "../services/api";
import { useAppSelector } from "../app/hooks";
import RelationshipGraph from "../components/RelationshipGraph";
import AssayStamp from "../components/AssayStamp";
import ChainTimeline from "../components/ChainTimeline";

export default function BatchDetail() {
  const { id = "" } = useParams();
  const { data: batch, isLoading } = useBatchQuery(id);
  const { data: graph } = useBatchGraphQuery(id, { skip: !id });
  const role = useAppSelector((st) => st.auth.user?.role ?? "");
  const canRefine = ["refinery_operator", "goldbod_officer", "super_admin"].includes(role);
  const [refine, { isLoading: refining }] = useRefineBatchMutation();
  const [mb, setMb] = useState({ input_g: "", output_g: "", loss_g: "", sample_g: "", residue_g: "" });
  const [mbRes, setMbRes] = useState<{ ok: boolean; msg: string } | null>(null);
  const doRefine = async () => {
    try {
      const r = await refine({ id, body: mb }).unwrap();
      setMbRes({ ok: r.mass_balance_ok, msg: r.message });
    } catch { setMbRes({ ok: false, msg: "Could not record reconciliation." }); }
  };
  const { data: passport } = useVerifyBatchQuery(batch?.batch_code ?? "", { skip: !batch });

  if (isLoading || !batch) return <Typography>Loading passport…</Typography>;

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/batches" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
        Batches
      </Button>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
            <AssayStamp fineness={batch.fineness} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" className="mono">{batch.batch_code}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip label={batch.status_display} />
                <Chip variant="outlined" label={`${batch.gross_weight_g} g gross`} />
                {batch.fine_weight_g && <Chip variant="outlined" label={`${batch.fine_weight_g} g fine`} />}
              </Stack>
              <Typography className="hash" sx={{ mt: 1.5 }} color="text.secondary">
                passport {batch.passport_hash}
              </Typography>
            </Box>
            {batch.qr_image && (
              <Box sx={{ textAlign: "center" }}>
                <img src={`${API_ORIGIN}${batch.qr_image}`} alt="passport QR" width={120} height={120}
                  style={{ border: "1px solid #E6E0D2", borderRadius: 8, padding: 6, background: "#fff" }} />
                <Typography variant="caption" color="text.secondary" display="block">Scan to verify</Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ChainTimeline events={batch.custody_events} valid={passport?.chain_valid} />
        </CardContent>
      </Card>
          {canRefine && (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Refinery mass-balance reconciliation</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Input must equal output + loss + sample + residue. A mismatch beyond 0.5% raises a fraud case.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            {(["input_g","output_g","loss_g","sample_g","residue_g"] as const).map((k) => (
              <TextField key={k} size="small" label={k.replace("_g"," (g)")} value={mb[k]}
                onChange={(e) => setMb({ ...mb, [k]: e.target.value })} sx={{ width: 130 }} />
            ))}
          </Stack>
          {mbRes && <Alert severity={mbRes.ok ? "success" : "error"} sx={{ mt: 2 }}>{mbRes.msg}</Alert>}
          <Button variant="contained" sx={{ mt: 2, bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}
            disabled={refining || !mb.input_g} onClick={doRefine}>Reconcile</Button>
        </CardContent></Card>
      )}

      {graph && (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Relationship graph</Typography>
          <RelationshipGraph graph={graph} />
        </CardContent></Card>
      )}
    </Stack>
  );
}
