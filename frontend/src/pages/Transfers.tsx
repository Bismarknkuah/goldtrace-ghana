import { Button, Card, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useConfirmTransferMutation, useTransfersQuery } from "../services/api";

export default function Transfers() {
  const { data } = useTransfersQuery();
  const [confirm, { isLoading }] = useConfirmTransferMutation();
  const rows = data?.results ?? [];
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Ownership transfers</Typography>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Batch</TableCell><TableCell>Price</TableCell>
              <TableCell>Status</TableCell><TableCell /></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell className="mono">{t.batch}</TableCell>
                <TableCell>{t.price ? `${t.price} ${t.currency}` : "—"}</TableCell>
                <TableCell><Chip size="small"
                  color={t.status === "completed" ? "success" : "default"} label={t.status_display} /></TableCell>
                <TableCell align="right">
                  {t.status === "pending" && (
                    <Button size="small" variant="contained" disabled={isLoading}
                      onClick={() => confirm(t.id)}>Confirm</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={4}>
                <Typography color="text.secondary">No transfers recorded.</Typography>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
