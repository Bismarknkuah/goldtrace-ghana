import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, useParams } from "react-router-dom";
import { useBatchQuery, useVerifyBatchQuery, API_ORIGIN } from "../services/api";
import AssayStamp from "../components/AssayStamp";
import ChainTimeline from "../components/ChainTimeline";

export default function BatchDetail() {
  const { id = "" } = useParams();
  const { data: batch, isLoading } = useBatchQuery(id);
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
    </Stack>
  );
}
