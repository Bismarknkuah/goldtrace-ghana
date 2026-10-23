import { useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Switch, Typography } from "@mui/material";
import { useCourierMeQuery, useRegisterCourierMutation, useGoOnlineMutation,
  useDeliveriesQuery, useDeliveryActionMutation, usePostCourierPingMutation } from "../services/api";
import DeliveryMap from "../components/DeliveryMap";

// Demo location near the Obuasi store; a real device would use geolocation.
const DEMO_POS = { lat: 6.205, lng: -1.665 };

export default function CourierDashboard() {
  const { data: courier, isError } = useCourierMeQuery();
  const [register] = useRegisterCourierMutation();
  const [goOnline] = useGoOnlineMutation();
  const [ping] = usePostCourierPingMutation();
  const [act, { isLoading }] = useDeliveryActionMutation();
  const { data: deliveries } = useDeliveriesQuery();
  const [online, setOnline] = useState(false);

  if (isError || !courier) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 420 }}>
        <Typography variant="h4">Carrier operations</Typography>
        <Typography color="text.secondary">You are not registered as a bonded carrier yet.</Typography>
        <Button variant="contained" onClick={() => register({ courier_type: "rider", max_weight_kg: 20 })}>
          Register motorbike unit
        </Button>
        <Button variant="outlined" onClick={() => register({ courier_type: "driver", max_weight_kg: 500 })}>
          Register vehicle unit
        </Button>
      </Stack>
    );
  }

  const jobs = deliveries?.results ?? [];
  const active = jobs.find((d) => ["accepted", "picked_up", "in_transit"].includes(d.status));
  const offered = jobs.filter((d) => d.status === "offered");

  const toggleOnline = async (v: boolean) => {
    setOnline(v);
    await goOnline({ status: v ? "available" : "offline", ...DEMO_POS }).unwrap().catch(() => undefined);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4">Carrier operations</Typography>
          <Typography color="text.secondary">
            {courier.company || courier.courier_type_display} · {courier.courier_type_display} · {courier.plate_number || "no plate"} · ★ {courier.rating}
          </Typography>
        </Box>
        <Stack direction="row" alignItems="center">
          <Typography>{online ? "Online" : "Offline"}</Typography>
          <Switch checked={online} onChange={(e) => toggleOnline(e.target.checked)} />
        </Stack>
      </Stack>

      {offered.length > 0 && (
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>New job offers</Typography>
          <Stack spacing={1.5}>
            {offered.map((d) => (
              <Card key={d.id} sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <div>
                    <Typography fontWeight={600} className="mono">{d.batch_code}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {d.distance_km} km · {d.parcel_weight_kg} kg · GHS {d.price_ghs} · to {d.dropoff_address || "buyer"}
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" disabled={isLoading}
                      onClick={() => act({ id: d.id, action: "accept" })}>Accept</Button>
                    <Button size="small" color="error" disabled={isLoading}
                      onClick={() => act({ id: d.id, action: "reject" })}>Reject</Button>
                  </Stack>
                </Stack>
              </Card>
            ))}
          </Stack>
        </CardContent></Card>
      )}

      {active && (
        <Card><CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Active delivery · {active.batch_code}</Typography>
            <Chip color="info" label={active.status_display} />
          </Stack>
          <Box sx={{ my: 2 }}>
            <DeliveryMap pickup={{ lat: active.pickup_lat, lng: active.pickup_lng }}
              dropoff={{ lat: active.dropoff_lat, lng: active.dropoff_lng }}
              courier={{ lat: active.courier_lat, lng: active.courier_lng }} />
          </Box>
          <Button variant="contained"
            onClick={() => ping({ id: active.id, lat: DEMO_POS.lat + 0.02, lng: DEMO_POS.lng + 0.02 })}>
            Update convoy position
          </Button>
        </CardContent></Card>
      )}

      {offered.length === 0 && !active && (
        <Typography color="text.secondary">
          {online ? "You're online — waiting for job offers." : "Go online to receive delivery offers."}
        </Typography>
      )}
    </Stack>
  );
}
