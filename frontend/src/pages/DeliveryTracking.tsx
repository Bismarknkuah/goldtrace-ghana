import { useState } from "react";
import { Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Security";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, useParams } from "react-router-dom";
import { useDeliveryQuery, useTrackDeliveryQuery, useDeliveryActionMutation,
  useHandoverDeliveryMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";
import DeliveryMap from "../components/DeliveryMap";

const STEPS = ["searching", "offered", "accepted", "picked_up", "in_transit", "delivered"];

export default function DeliveryTracking() {
  const { id = "" } = useParams();
  const { data: d } = useDeliveryQuery(id);
  const { data: track } = useTrackDeliveryQuery(id, { pollingInterval: 5000 });
  const [act, { isLoading }] = useDeliveryActionMutation();
  const [handover, { isLoading: sealing }] = useHandoverDeliveryMutation();
  const me = useAppSelector((s) => s.auth.user);

  const [sealOpen, setSealOpen] = useState(false);
  const [seal, setSeal] = useState("");
  const [escort, setEscort] = useState(false);

  if (!d) return <Typography>Loading shipment…</Typography>;
  const stepIndex = STEPS.indexOf(d.status);
  const isSeller = me?.id === d.seller;
  const isBuyer = me?.id === d.buyer;

  const doHandover = async () => {
    await handover({ id, seal_number: seal, escort_required: escort }).unwrap().catch(() => undefined);
    setSealOpen(false);
  };

  return (
    <Stack spacing={3}>
      <Button component={Link} to="/deliveries" startIcon={<ArrowBackIcon />} sx={{ alignSelf: "flex-start" }}>
        Secure transport
      </Button>
      <Card><CardContent>
        <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" className="mono">{d.batch_code}</Typography>
            <Typography color="text.secondary">
              {d.seller_name} → {d.buyer_name} · {d.distance_km} km · haulage GHS {d.price_ghs}
            </Typography>
            {d.courier_company && <Typography variant="body2">
              Carrier: {d.courier_company} · {d.courier_name} · {d.courier_phone}</Typography>}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {d.seal_number && <Chip size="small" icon={<LockIcon sx={{ fontSize: 15 }} />}
                label={`Seal ${d.seal_number}`} color="secondary" />}
              {d.escort_required && <Chip size="small" icon={<ShieldIcon sx={{ fontSize: 15 }} />}
                label="Security escort" variant="outlined" />}
            </Stack>
          </Box>
          <Chip color={d.status === "delivered" ? "success" : "info"} label={d.status_display} sx={{ height: 36 }} />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
          {STEPS.map((st, i) => (
            <Chip key={st} size="small" label={st.replace("_", " ")}
              color={i <= stepIndex ? "secondary" : "default"}
              variant={i <= stepIndex ? "filled" : "outlined"} />
          ))}
        </Stack>
      </CardContent></Card>

      <Card><CardContent sx={{ p: 1.5 }}>
        <DeliveryMap
          pickup={{ lat: d.pickup_lat, lng: d.pickup_lng }}
          dropoff={{ lat: d.dropoff_lat, lng: d.dropoff_lng }}
          courier={track?.courier ?? { lat: d.courier_lat, lng: d.courier_lng }} />
      </CardContent></Card>

      <Stack direction="row" spacing={2}>
        {isSeller && !d.handed_over && (
          <Button variant="contained" startIcon={<LockIcon />} onClick={() => setSealOpen(true)}>
            Seal & hand to carrier
          </Button>
        )}
        {isBuyer && !d.received_by_buyer && (
          <Button variant="contained" color="success" startIcon={<CheckCircleIcon />} disabled={isLoading}
            onClick={() => act({ id, action: "confirm-receipt" })}>
            Confirm parcel received
          </Button>
        )}
        {d.handed_over && <Chip icon={<CheckCircleIcon />} color="success" label="Sealed & handed over" />}
        {d.received_by_buyer && <Chip icon={<CheckCircleIcon />} color="success" label="Received by buyer" />}
      </Stack>

      <Dialog open={sealOpen} onClose={() => setSealOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Apply tamper-evident seal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              The seal number is written into the batch's custody chain, making the transport leg auditable.
            </Typography>
            <TextField label="Seal number" value={seal} onChange={(e) => setSeal(e.target.value.toUpperCase())}
              placeholder="SEAL-000123" />
            <FormControlLabel control={<Checkbox checked={escort} onChange={(e) => setEscort(e.target.checked)} />}
              label="Security-agency escort required" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSealOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={doHandover} disabled={sealing || !seal}>Seal & hand over</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
