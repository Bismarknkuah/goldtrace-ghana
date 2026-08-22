import { useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import { useMarketplaceQuery, useBatchesQuery, useListForSaleMutation,
  useUnlistBatchMutation, useBuyBatchMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";
import { useNavigate } from "react-router-dom";

const SEC_COLOR: Record<string, "success" | "warning" | "error"> = {
  normal: "success", flagged: "warning", missing: "error", stolen: "error", recovered: "warning",
};

export default function Marketplace() {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const { data: market } = useMarketplaceQuery();
  const { data: batches, refetch } = useBatchesQuery();
  const [listForSale, { isLoading: listing }] = useListForSaleMutation();
  const [unlist] = useUnlistBatchMutation();
  const [buy, { isLoading: buying }] = useBuyBatchMutation();

  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [seal, setSeal] = useState("");

  const listings = market?.listings ?? [];
  const myGold = (batches?.results ?? []).filter((b) => b.current_owner === user?.id);

  const doBuy = async (id: string) => {
    setMsg(null);
    try {
      const r = await buy(id).unwrap();
      setMsg({ type: "success", text: `${r.detail} (${r.batch_code})` });
    } catch (e: unknown) {
      setMsg({ type: "error", text: (e as { data?: { detail?: string } })?.data?.detail || "Purchase failed." });
    }
  };
  const doList = async () => {
    if (!dlg) return;
    try {
      await listForSale({ id: dlg, asking_price_ghs: price, seal_number: seal }).unwrap();
      setDlg(null); setPrice(""); setSeal(""); refetch();
      setMsg({ type: "success", text: "Listed on the marketplace." });
    } catch {
      setMsg({ type: "error", text: "Could not list this batch." });
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Gold marketplace</Typography>
        <Typography color="text.secondary">
          Buy gold available to you under the GoldBod flow, and list your own for licensed buyers.
          Every purchase issues a receipt and records custody.
        </Typography>
      </Box>

      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Available to buy</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Seller</TableCell><TableCell>Gross (g)</TableCell>
            <TableCell>Fineness</TableCell><TableCell>Asking (GHS)</TableCell>
            <TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {listings.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell className="mono">{l.batch_code}</TableCell>
                <TableCell>{l.seller}<br /><Typography variant="caption" color="text.secondary">{l.seller_role}</Typography></TableCell>
                <TableCell>{l.gross_weight_g}</TableCell>
                <TableCell>{l.fineness ?? "—"}</TableCell>
                <TableCell className="mono">{Number(l.asking_price_ghs).toLocaleString()}</TableCell>
                <TableCell><Chip size="small" color={SEC_COLOR[l.security_status] ?? "default"} label={l.security_status} /></TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => navigate(`/batches/${l.id}`)}>Details</Button>
                  <Button size="small" variant="contained" startIcon={<StorefrontIcon />}
                    disabled={buying} onClick={() => doBuy(l.id)}
                    sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Buy</Button>
                </TableCell>
              </TableRow>
            ))}
            {listings.length === 0 && <TableRow><TableCell colSpan={7}>
              <Typography color="text.secondary">No gold is currently listed that your role is permitted to buy.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Your gold — list for sale</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Gross (g)</TableCell><TableCell>Status</TableCell>
            <TableCell>Listed</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {myGold.map((b) => (
              <TableRow key={b.id} hover>
                <TableCell className="mono">{b.batch_code}</TableCell>
                <TableCell>{b.gross_weight_g}</TableCell>
                <TableCell>{b.status_display}</TableCell>
                <TableCell>{b.listed_for_sale ? <Chip size="small" color="secondary" label="On market" /> : "—"}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => navigate(`/batches/${b.id}`)}>Details</Button>
                  {b.listed_for_sale
                    ? <Button size="small" color="inherit" onClick={() => { unlist(b.id); refetch(); }}>Unlist</Button>
                    : <Button size="small" onClick={() => setDlg(b.id)}>List for sale</Button>}
                </TableCell>
              </TableRow>
            ))}
            {myGold.length === 0 && <TableRow><TableCell colSpan={5}>
              <Typography color="text.secondary">You don't currently hold any gold to sell.</Typography>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!dlg} onClose={() => setDlg(null)} fullWidth maxWidth="xs">
        <DialogTitle>List gold for sale</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField label="Asking price (GHS)" value={price} onChange={(e) => setPrice(e.target.value)} />
            <TextField label="Tamper-evident seal number (optional)" value={seal} onChange={(e) => setSeal(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlg(null)}>Cancel</Button>
          <Button variant="contained" onClick={doList} disabled={listing || !price}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>List it</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
