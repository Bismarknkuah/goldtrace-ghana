import { Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import ShieldIcon from "@mui/icons-material/GppMaybe";
import { useRiskOverviewQuery, useParticipantRiskQuery, useAnomaliesQuery } from "../services/api";

const LEVEL: Record<string, { color: string; label: string }> = {
  critical: { color: "#B23A2E", label: "Critical" },
  elevated: { color: "#D9822B", label: "Elevated" },
  watch: { color: "#C9A227", label: "Watch" },
  clear: { color: "#2E7D52", label: "Clear" },
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card sx={{ borderTop: `3px solid ${color}` }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>
          {label.toUpperCase()}
        </Typography>
        <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 40, fontWeight: 600, lineHeight: 1.1, color }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Intelligence() {
  const { data, isLoading, isError } = useRiskOverviewQuery();
  const { data: pr } = useParticipantRiskQuery();
  const { data: anom } = useAnomaliesQuery();

  if (isError) return <Typography color="text.secondary">Enforcement or regulator access is required to view risk intelligence.</Typography>;
  const s = data?.summary;
  const flagged = (data?.batches ?? []).filter((b) => b.level !== "clear");

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <ShieldIcon sx={{ color: "#B23A2E" }} />
          <Typography variant="h4">Anti-smuggling intelligence</Typography>
        </Stack>
        <Typography color="text.secondary">
          Every batch scored against the custody chain, licensed concessions, miner status and hotspots.
        </Typography>
      </Box>

      {anom && anom.anomalies.length > 0 && (
        <Card sx={{ borderLeft: "4px solid #B23A2E" }}><CardContent>
          <Typography variant="h6" gutterBottom>
            AI anomaly detection · {anom.summary.total} pattern{anom.summary.total === 1 ? "" : "s"} flagged
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cross-entity signals — flipping, circular ownership, velocity spikes, shared-identifier
            rings, irregular flow and volume outliers — that no single score reveals.
          </Typography>
          <Stack spacing={1.25}>
            {anom.anomalies.slice(0, 12).map((x: import("../types").Anomaly, i: number) => (
              <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start",
                borderLeft: `3px solid ${x.severity === "critical" ? "#8E1B12" : x.severity === "high" ? "#B23A2E" : "#C9A227"}`,
                pl: 1.5 }}>
                <Chip size="small" label={x.severity}
                  color={x.severity === "critical" || x.severity === "high" ? "error" : "warning"} />
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{x.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{x.detail}</Typography>
                  {x.entities.length > 0 && (
                    <Typography variant="caption" className="mono" color="text.secondary">
                      {x.entities.join(" · ")}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </CardContent></Card>
      )}

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Critical" value={s?.critical ?? 0} color={LEVEL.critical.color} />
        <StatCard label="Elevated" value={s?.elevated ?? 0} color={LEVEL.elevated.color} />
        <StatCard label="Watch" value={s?.watch ?? 0} color={LEVEL.watch.color} />
        <StatCard label="Clear" value={s?.clear ?? 0} color={LEVEL.clear.color} />
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Flagged batches (highest risk first)</Typography>
          <Table>
            <TableHead><TableRow>
              <TableCell>Batch</TableCell><TableCell>Miner</TableCell><TableCell>Region</TableCell>
              <TableCell>Level</TableCell><TableCell>Score</TableCell><TableCell>Flags</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {flagged.map((b) => (
                <TableRow key={b.batch_id} hover>
                  <TableCell className="mono">{b.batch_code}</TableCell>
                  <TableCell className="mono">{b.miner}</TableCell>
                  <TableCell>{b.region}</TableCell>
                  <TableCell>
                    <Chip size="small" label={LEVEL[b.level]?.label ?? b.level}
                      sx={{ bgcolor: LEVEL[b.level]?.color, color: "#fff" }} />
                  </TableCell>
                  <TableCell>{b.score}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                      {b.flags.map((f) => (
                        <Tooltip key={f.code} title={f.message}>
                          <Chip size="small" variant="outlined" label={f.code.replace(/_/g, " ")} />
                        </Tooltip>
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && flagged.length === 0 && (
                <TableRow><TableCell colSpan={6}>
                  <Typography color="text.secondary">No flagged batches — all clear.</Typography>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Participant AML risk</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Every operator scored on KYC status, licence validity and irregular transfers.
        </Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Participant</TableCell><TableCell>Role</TableCell>
            <TableCell>Level</TableCell><TableCell>Score</TableCell><TableCell>Flags</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(pr?.participants ?? []).filter((x) => x.level !== "clear").map((x) => (
              <TableRow key={x.username} hover>
                <TableCell className="mono">{x.username}</TableCell>
                <TableCell>{x.role_display}</TableCell>
                <TableCell><Chip size="small" label={LEVEL[x.level]?.label ?? x.level}
                  sx={{ bgcolor: LEVEL[x.level]?.color, color: "#fff" }} /></TableCell>
                <TableCell>{x.score}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                    {x.flags.map((f) => (
                      <Tooltip key={f.code} title={f.message}>
                        <Chip size="small" variant="outlined" label={f.code.replace(/_/g, " ")} />
                      </Tooltip>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {(pr?.participants ?? []).filter((x) => x.level !== "clear").length === 0 && (
              <TableRow><TableCell colSpan={5}>
                <Typography color="text.secondary">All participants clear.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
