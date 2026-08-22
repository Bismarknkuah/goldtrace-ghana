import { Card, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useMinersQuery } from "../services/api";

export default function Miners() {
  const { data, isLoading } = useMinersQuery();
  const rows = data?.results ?? [];
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Licensed miners</Typography>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Licence</TableCell><TableCell>Name</TableCell>
              <TableCell>Region</TableCell><TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell className="mono">{m.license_number}</TableCell>
                <TableCell>{m.user_detail?.first_name || m.user_detail?.username || "—"}</TableCell>
                <TableCell>{m.region}</TableCell>
                <TableCell><Chip size="small" label={m.license_status} /></TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4}>
                <Typography color="text.secondary">No miners registered yet.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
