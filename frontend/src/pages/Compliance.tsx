import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { useComplianceOverviewQuery, useKycScreeningsQuery, useCreateKycMutation,
  useDueDiligenceQuery } from "../services/api";

const RISK: Record<string, "success" | "warning" | "error"> = {
  cleared: "success", pending: "warning", flagged: "warning", rejected: "error",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>{label.toUpperCase()}</Typography>
      <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 34, fontWeight: 600 }}>{value}</Typography>
    </CardContent></Card>
  );
}

export default function Compliance() {
  const { data: overview, isError } = useComplianceOverviewQuery();
  const { data: kyc } = useKycScreeningsQuery();
  const { data: dd } = useDueDiligenceQuery();
  const [screen, { isLoading }] = useCreateKycMutation();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");

  if (isError) return <Typography color="text.secondary">Regulator or customs access is required for compliance.</Typography>;

  const sc = overview?.screening_counts ?? {};
  const ddc = overview?.due_diligence;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Compliance & responsible sourcing</Typography>
        <Typography color="text.secondary">KYC/AML screening and OECD due-diligence attestations.</Typography>
      </Box>

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Cleared" value={sc.cleared ?? 0} />
        <Stat label="Flagged" value={sc.flagged ?? 0} />
        <Stat label="Rejected" value={sc.rejected ?? 0} />
        <Stat label="DD coverage" value={`${ddc?.coverage_pct ?? 0}%`} />
      </Box>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Screen a buyer (KYC/AML)</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField size="small" label="Party name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField size="small" label="Country" value={country} onChange={(e) => setCountry(e.target.value)} fullWidth />
          <Button variant="contained" disabled={isLoading || !name}
            onClick={() => { screen({ subject_name: name, country }); setName(""); setCountry(""); }}>
            Run screening
          </Button>
        </Stack>
        <Alert severity="info" sx={{ mt: 2 }}>
          Screening checks sanctions, PEP status and high-risk jurisdictions, then assigns a risk rating.
        </Alert>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Screenings</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Party</TableCell><TableCell>Country</TableCell><TableCell>Risk</TableCell>
            <TableCell>Sanctions</TableCell><TableCell>Status</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(kyc?.results ?? []).map((k) => (
              <TableRow key={k.id} hover>
                <TableCell>{k.subject_name}</TableCell>
                <TableCell>{k.country}</TableCell>
                <TableCell><Chip size="small" label={k.risk_rating} /></TableCell>
                <TableCell>{k.sanctions_hit ? "⚠️ hit" : "—"}</TableCell>
                <TableCell><Chip size="small" color={RISK[k.status] ?? "default"} label={k.status_display} /></TableCell>
              </TableRow>
            ))}
            {(kyc?.results ?? []).length === 0 && <TableRow><TableCell colSpan={5}>
              <Typography color="text.secondary">No screenings yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Responsible-sourcing attestations</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>OECD step</TableCell><TableCell>Conflict-free</TableCell>
            <TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {(dd?.results ?? []).map((d) => (
              <TableRow key={d.id} hover>
                <TableCell className="mono">{d.batch_code}</TableCell>
                <TableCell>{d.oecd_step} / 5</TableCell>
                <TableCell>{d.conflict_free ? "Yes" : "No"}</TableCell>
                <TableCell><Chip size="small" color={d.responsible ? "success" : "warning"}
                  label={d.responsible ? "Responsible" : "Pending"} /></TableCell>
              </TableRow>
            ))}
            {(dd?.results ?? []).length === 0 && <TableRow><TableCell colSpan={4}>
              <Typography color="text.secondary">No attestations yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
