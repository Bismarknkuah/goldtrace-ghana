import { useState } from "react";
import { Button, Card, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { Link } from "react-router-dom";
import { useBatchesQuery, useCreateDeliveryMutation, useCandidatesQuery,
  useAssignCourierMutation, useDeliveriesQuery } from "../services/api";

const STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  searching: "warning", offered: "warning", accepted: "info",
  picked_up: "info", in_transit: "info", delivered: "success",
};

export default function Deliveries() {
  const { data } = useDeliveriesQuery();
  const { data: batches } = useBatchesQuery();
  const [createDelivery, { isLoading: creating }] = useCreateDeliveryMutation();
  const [assign, { isLoading: assigning }] = useAssignCourierMutation();

  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState("");
  const [courierType, setCourierType] = useState<"rider" | "driver">("rider");
  const [weight, setWeight] = useState("1.2");
  const [lat, setLat] = useState("6.688");
  const [lng, setLng] = useState("-1.622");
  const [address, setAddress] = useState("Kumasi buyer office");
  const [newId, setNewId] = useState<string | null>(null);

  const { data: candidates } = useCandidatesQuery(newId ?? "", { skip: !newId });

  const reset = () => { setOpen(false); setNewId(null); setBatch(""); };

  const request = async () => {
    const created = await createDelivery({
      batch, courier_type: courierType, parcel_weight_kg: Number(weight),
      dropoff_lat: Number(lat), dropoff_lng: Number(lng), dropoff_address: address,
    } as never).unwrap().catch(() => null);
    if (created) setNewId(created.id);
  };

  const pick = async (courierId: string) => {
    if (!newId) return;
    await assign({ id: newId, courier_id: courierId }).unwrap().catch(() => undefined);
    reset();
  };

  const rows = data?.results ?? [];
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">Secure transport</Typography>
        <Button variant="contained" startIcon={<LocalShippingIcon />} onClick={() => setOpen(true)}>
          Dispatch transport
        </Button>
      </Stack>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Type</TableCell><TableCell>Distance</TableCell>
            <TableCell>Price</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell className="mono">{d.batch_code}</TableCell>
                <TableCell>{d.courier_type}</TableCell>
                <TableCell>{d.distance_km} km</TableCell>
                <TableCell>GHS {d.price_ghs}</TableCell>
                <TableCell><Chip size="small" color={STATUS_COLOR[d.status] ?? "default"} label={d.status_display} /></TableCell>
                <TableCell align="right"><Button size="small" component={Link} to={`/deliveries/${d.id}`}>Track</Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6}>
              <Typography color="text.secondary">No deliveries yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={reset} fullWidth maxWidth="sm">
        <DialogTitle>{newId ? "Choose a bonded carrier" : "Dispatch secure transport"}</DialogTitle>
        <DialogContent>
          {!newId ? (
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField select label="Gold batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
                {(batches?.results ?? []).map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.batch_code} · {b.gross_weight_g} g</MenuItem>
                ))}
              </TextField>
              <ToggleButtonGroup exclusive value={courierType} color="primary"
                onChange={(_e, v) => v && setCourierType(v)}>
                <ToggleButton value="rider">Motorbike unit (small)</ToggleButton>
                <ToggleButton value="driver">Vehicle unit (large / heavy)</ToggleButton>
              </ToggleButtonGroup>
              <TextField label="Parcel weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <Stack direction="row" spacing={2}>
                <TextField label="Drop-off lat" value={lat} onChange={(e) => setLat(e.target.value)} />
                <TextField label="Drop-off lng" value={lng} onChange={(e) => setLng(e.target.value)} />
              </Stack>
              <TextField label="Drop-off address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Stack>
          ) : (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Nearest on-duty bonded carriers (AI-matched by proximity):
              </Typography>
              {(candidates ?? []).map((c) => (
                <Card key={c.courier_id} sx={{ p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <div>
                      <Typography fontWeight={600}>{c.company || c.username} · {c.plate_number}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.distance_km} km away · ~{c.eta_minutes} min · ★ {c.rating} · GHS {c.price_ghs}
                      </Typography>
                    </div>
                    <Button variant="contained" size="small" disabled={assigning}
                      onClick={() => pick(c.courier_id)}>Assign</Button>
                  </Stack>
                </Card>
              ))}
              {(candidates ?? []).length === 0 && (
                <Typography color="text.secondary">No couriers available nearby right now.</Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={reset}>Close</Button>
          {!newId && <Button variant="contained" onClick={request} disabled={creating || !batch}>
            {creating ? "Matching…" : "Find carriers"}</Button>}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
