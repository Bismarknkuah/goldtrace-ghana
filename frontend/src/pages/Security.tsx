import { Box, Button, Card, CardContent, Chip, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Typography } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import { useSecurityOverviewQuery, useResolveIncidentMutation } from "../services/api";

const CARD: Record<string, string> = {
  stolen: "#B23A2E", missing: "#B23A2E", flagged: "#D9822B", recovered: "#2E7D52", normal: "#10261C",
};

export default function Security() {
  const { data, isError } = useSecurityOverviewQuery();
  const [resolve, { isLoading }] = useResolveIncidentMutation();
  if (isError) return <Typography color="text.secondary">Enforcement or regulator access is required.</Typography>;

  const counts = data?.status_counts ?? {};
  const order = ["stolen", "missing", "flagged", "recovered", "normal"];

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} alignItems="center">
        <SecurityIcon sx={{ color: "#B23A2E" }} />
        <Typography variant="h4">Security & theft protection</Typography>
      </Stack>

      <Box className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {order.map((k) => (
          <Card key={k} sx={{ borderTop: `3px solid ${CARD[k]}` }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11, letterSpacing: 1 }}>
                {k.toUpperCase()}
              </Typography>
              <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 34, fontWeight: 600, color: CARD[k] }}>
                {counts[k] ?? 0}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Open incidents</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell>
            <TableCell>Note</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {(data?.open_incidents ?? []).map((i) => (
              <TableRow key={i.id} hover>
                <TableCell className="mono">{i.batch_code}</TableCell>
                <TableCell><Chip size="small" color="error" label={i.type_display} /></TableCell>
                <TableCell>{i.status_display}</TableCell>
                <TableCell>{i.note}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="contained" disabled={isLoading}
                    onClick={() => resolve(i.id)}>Mark recovered</Button>
                </TableCell>
              </TableRow>
            ))}
            {(data?.open_incidents ?? []).length === 0 && <TableRow><TableCell colSpan={5}>
              <Typography color="text.secondary">No open incidents.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>At risk — custody gaps</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Batches that have gone quiet while still in circulation.
        </Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Last event</TableCell><TableCell>Status</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(data?.at_risk ?? []).map((r) => (
              <TableRow key={r.batch_id} hover>
                <TableCell className="mono">{r.batch_code}</TableCell>
                <TableCell>{r.last_event} · {new Date(r.silent_since).toLocaleDateString()}</TableCell>
                <TableCell>{r.status}</TableCell>
              </TableRow>
            ))}
            {(data?.at_risk ?? []).length === 0 && <TableRow><TableCell colSpan={3}>
              <Typography color="text.secondary">No custody gaps detected.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
