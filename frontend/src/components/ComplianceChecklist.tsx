import { Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useNavigate } from "react-router-dom";
import { useMyComplianceQuery } from "../services/api";

const LEVEL = {
  good: { color: "#2E7D32", label: "Compliant" },
  fair: { color: "#B26A00", label: "Action needed" },
  poor: { color: "#B23A2E", label: "Not compliant" },
} as const;

// "Your compliance": one card that tells a trader exactly what to fix to trade legally.
export default function ComplianceChecklist({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useMyComplianceQuery();
  const navigate = useNavigate();
  if (isLoading) return <LinearProgress />;
  if (!data) return null;
  const lv = LEVEL[data.level];
  const rows = compact ? data.items.filter((i) => !i.ok).slice(0, 5) : data.items;
  return (
    <Card sx={{ border: `1px solid ${lv.color}33` }}><CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Your compliance</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={lv.label} sx={{ bgcolor: lv.color, color: "#fff", fontWeight: 700 }} />
          <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 28, fontWeight: 600, color: lv.color }}>
            {data.score}%
          </Typography>
        </Stack>
      </Stack>
      <LinearProgress variant="determinate" value={data.score}
        sx={{ height: 8, borderRadius: 4, mb: 2, bgcolor: "#EEE7D6", "& .MuiLinearProgress-bar": { bgcolor: lv.color } }} />
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Everything is in order — you can trade under GoldBod rules.
        </Typography>
      )}
      <Stack spacing={1.25}>
        {rows.map((i) => (
          <Stack key={i.key} direction="row" spacing={1.25} alignItems="flex-start">
            {i.ok ? <CheckCircleIcon sx={{ color: "#2E7D32", fontSize: 20, mt: "2px" }} />
              : <ErrorOutlineIcon sx={{ color: "#B23A2E", fontSize: 20, mt: "2px" }} />}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{i.label}</Typography>
              <Typography variant="body2" color="text.secondary">{i.detail}</Typography>
              {i.action && <Typography variant="body2" sx={{ color: "#7A6A2E" }}>→ {i.action}</Typography>}
            </Box>
            {i.link && <Button size="small" onClick={() => navigate(`/${i.link}`)}>Fix</Button>}
          </Stack>
        ))}
      </Stack>
      {compact && (
        <Button size="small" sx={{ mt: 1.5 }} onClick={() => navigate("/rules")}>
          Full checklist & trading rules →
        </Button>
      )}
    </CardContent></Card>
  );
}
