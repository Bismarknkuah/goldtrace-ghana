import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useConcessionsGeoQuery, useHotspotsGeoQuery, useOperatorsQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";

const SEVERITY_COLOR: Record<string, string> = {
  high: "#B23A2E", medium: "#D9822B", low: "#C9A227",
};

export default function MapView() {
  const { data: concessions } = useConcessionsGeoQuery();
  const { data: hotspots } = useHotspotsGeoQuery();
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const oversight = ["super_admin","ceo","goldbod_officer","bog_officer","ministry_official","customs_officer","security_agency","env_officer"].includes(role);
  const { data: operators } = useOperatorsQuery(undefined, { skip: !oversight });
  const hotFeatures = hotspots?.features ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Geospatial monitoring</Typography>
        <Typography color="text.secondary">
          Licensed concession boundaries (gold) and illegal-mining hotspots (severity-coloured).
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Chip size="small" label="Concession" sx={{ bgcolor: "#C9A227", color: "#0C1813" }} />
        <Chip size="small" label="High" sx={{ bgcolor: "#B23A2E", color: "#fff" }} />
        <Chip size="small" label="Medium" sx={{ bgcolor: "#D9822B", color: "#fff" }} />
        <Chip size="small" label="Low" sx={{ bgcolor: "#C9A227", color: "#0C1813" }} />
      </Stack>
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ height: "70vh", borderRadius: 1, overflow: "hidden" }}>
            <MapContainer center={[6.2, -1.67]} zoom={10} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {concessions && (
                <GeoJSON key={concessions.features.length} data={concessions}
                  style={() => ({ color: "#C9A227", weight: 2, fillColor: "#C9A227", fillOpacity: 0.12 })} />
              )}
              {hotFeatures.map((f, i) => {
                if (f.geometry.type !== "Point") return null;
                const coords = f.geometry.coordinates as [number, number];
                const sev = String(f.properties?.severity ?? "medium");
                return (
                  <CircleMarker key={i} center={[coords[1], coords[0]]} radius={9}
                    pathOptions={{ color: SEVERITY_COLOR[sev], fillColor: SEVERITY_COLOR[sev], fillOpacity: 0.7 }}>
                    <Popup>
                      <strong>{String(f.properties?.title ?? "Hotspot")}</strong><br />
                      severity: {sev} · {String(f.properties?.status ?? "")}
                    </Popup>
                  </CircleMarker>
                );
              })}
            {(operators ?? []).map((o, i) => (
          <CircleMarker key={`op-${i}`} center={[o.latitude, o.longitude]} radius={7}
            pathOptions={{ color: "#C9A227", fillColor: "#C9A227", fillOpacity: 0.85 }}>
            <Popup>
              <b>{o.username}</b><br />{o.role_display}<br />
              {[o.district, o.region].filter(Boolean).join(", ")}
            </Popup>
          </CircleMarker>
        ))}
        </MapContainer>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
