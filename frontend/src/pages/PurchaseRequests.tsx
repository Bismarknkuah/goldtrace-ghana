import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useTransfersQuery, useConfirmTransferMutation, useDeclineTransferMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";

export default function PurchaseRequests() {
  const user = useAppSelector((s) => s.auth.user);
  const { data } = useTransfersQuery();
  const [confirm, { isLoading: confirming }] = useConfirmTransferMutation();
  const [decline, { isLoading: declining }] = useDeclineTransferMutation();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const all = data?.results ?? [];
  const pending = all.filter((t) => t.status === "pending");
  const incoming = pending.filter((t) => t.seller === user?.id);   // I'm the seller — approve/decline
  const outgoing = pending.filter((t) => t.buyer === user?.id);    // I'm the buyer — awaiting approval

  const approve = async (id: string) => {
    setMsg(null);
    try {
      await confirm(id).unwrap();
      setMsg({ type: "success", text: "Sale approved — ownership moved and a receipt was issued." });
    } catch {
      setMsg({ type: "error", text: "Could not approve this request." });
    }
  };
  const reject = async (id: string) => {
    setMsg(null);
    try {
      await decline(id).unwrap();
      setMsg({ type: "success", text: "Request declined." });
    } catch {
      setMsg({ type: "error", text: "Could not decline this request." });
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Purchase requests</Typography>
        <Typography color="text.secondary">
          Approve or decline requests to buy your gold. Approving moves ownership and issues the
          buyer's receipt; nothing changes hands until you approve.
        </Typography>
      </Box>

      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Requests to buy your gold</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Buyer</TableCell><TableCell>Offer (GHS)</TableCell>
            <TableCell>Flow</TableCell><TableCell align="right">Decision</TableCell></TableRow></TableHead>
          <TableBody>
            {incoming.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell className="mono">{t.batch_code}</TableCell>
                <TableCell>{t.buyer_name}</TableCell>
                <TableCell className="mono">{t.price ? Number(t.price).toLocaleString() : "—"}</TableCell>
                <TableCell>{t.irregular
                  ? <Chip size="small" color="warning" label="Irregular" />
                  : <Chip size="small" color="success" label="Regular" />}</TableCell>
                <TableCell align="right">
                  <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />}
                    disabled={confirming} onClick={() => approve(t.id)} sx={{ mr: 1 }}>Approve</Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />}
                    disabled={declining} onClick={() => reject(t.id)}>Decline</Button>
                </TableCell>
              </TableRow>
            ))}
            {incoming.length === 0 && <TableRow><TableCell colSpan={5}>
              <Typography color="text.secondary">No incoming purchase requests.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Your pending purchases</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Seller</TableCell><TableCell>Offer (GHS)</TableCell>
            <TableCell>Status</TableCell></TableRow></TableHead>
          <TableBody>
            {outgoing.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell className="mono">{t.batch_code}</TableCell>
                <TableCell>{t.seller_name}</TableCell>
                <TableCell className="mono">{t.price ? Number(t.price).toLocaleString() : "—"}</TableCell>
                <TableCell><Chip size="small" label="Awaiting seller approval" /></TableCell>
              </TableRow>
            ))}
            {outgoing.length === 0 && <TableRow><TableCell colSpan={4}>
              <Typography color="text.secondary">You have no pending purchases.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
