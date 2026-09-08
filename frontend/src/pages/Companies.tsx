import { Card, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useCompaniesQuery } from "../services/api";

export default function Companies() {
  const { data } = useCompaniesQuery();
  const rows = data?.results ?? [];
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Mining companies</Typography>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>Company</TableCell><TableCell>Registration</TableCell><TableCell>Region</TableCell>
            <TableCell>Miners</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell className="mono">{c.registration_no}</TableCell>
                <TableCell>{c.region}</TableCell>
                <TableCell>{c.miner_count}</TableCell>
                <TableCell><Chip size="small" color={c.is_active ? "success" : "default"}
                  label={c.is_active ? "Active" : "Inactive"} /></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5}>
              <Typography color="text.secondary">No mining companies registered.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
