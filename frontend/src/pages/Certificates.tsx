import { Button, Card, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useCertificatesQuery, useIssueCertificateMutation } from "../services/api";

export default function Certificates() {
  const { data } = useCertificatesQuery();
  const [issue, { isLoading }] = useIssueCertificateMutation();
  const rows = data?.results ?? [];
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Export certificates</Typography>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Certificate</TableCell><TableCell>Destination</TableCell>
              <TableCell>Fine (g)</TableCell><TableCell>Status</TableCell><TableCell /></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell className="mono">{c.certificate_number}</TableCell>
                <TableCell>{c.destination_country}</TableCell>
                <TableCell>{c.fine_weight_g}</TableCell>
                <TableCell><Chip size="small"
                  color={c.status === "issued" ? "success" : "default"} label={c.status_display} /></TableCell>
                <TableCell align="right">
                  {c.status === "draft" && (
                    <Button size="small" variant="contained" disabled={isLoading}
                      onClick={() => issue(c.id)}>Issue</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5}>
                <Typography color="text.secondary">No certificates yet.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
