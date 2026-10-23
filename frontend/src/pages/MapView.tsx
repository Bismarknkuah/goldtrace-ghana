import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import { useConcessionsGeoQuery, useHotspotsGeoQuery, useOperatorsQuery,
  useComplianceMapQuery, useDetectionsGeoQuery } from "../services/api";
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
  const { data: compliance } = useComplianceMapQuery(undefined, { skip: !oversight });
  const { data: detections } = useDetectionsGeoQuery(undefined, { skip: !oversight });
  const COMPLY = { compliant: "#2E7D32", warning: "#D9822B", violating: "#B23A2E" } as const;
  const hotFeatures = hotspots?.features ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Geospatial monitoring</Typography>
        <Typography color="text.secondary">
          Concession boundaries, illegal-mining hotspots, and live operator compliance —
          green is compliant, amber is a warning, red is violating.
        </Typography>
      </Box>
      {oversight && compliance && (
        <Stack direction="row" spacing={1.5}>
          <Chip label={`${compliance.summary.compliant} compliant`}
            sx={{ bgcolor: "#2E7D32", color: "#fff" }} />
          <Chip label={`${compliance.summary.warning} warning`}
            sx={{ bgcolor: "#D9822B", color: "#fff" }} />
          <Chip label={`${compliance.summary.violating} violating`}
            sx={{ bgcolor: "#B23A2E", color: "#fff" }} />
        </Stack>
      )}
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
            {(compliance?.operators ?? operators ?? []).map((o: { latitude: number; longitude: number; username: string; role_display: string; region: string; district: string; status?: "compliant" | "warning" | "violating"; reasons?: string[] }, i: number) => {
          const status = (o as { status?: keyof typeof COMPLY }).status ?? "compliant";
          const reasons = (o as { reasons?: string[] }).reasons ?? [];
          const color = COMPLY[status];
          return (
          <CircleMarker key={`op-${i}`} center={[o.latitude, o.longitude]} radius={8}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.9 }}>
            <Popup>
              <b>{o.username}</b> · {o.role_display}<br />
              {[o.district, o.region].filter(Boolean).join(", ")}<br />
              <b style={{ color }}>{status.toUpperCase()}</b>
              {reasons.length > 0 && (<><br />{reasons.join("; ")}</>)}
            </Popup>
          </CircleMarker>);
        })}
{(detections?.features ?? []).map((ft, i) => {
          const [lng, lat] = (ft.geometry as unknown as { coordinates: [number, number] }).coordinates;
          const p = ft.properties as { status: string; status_display: string; confidence: number; region: string; operator: string; concession: string | null };
          const bad = p.status.includes("illegal");
          const color = bad ? "#B23A2E" : p.status === "licensed" ? "#2E7D32" : "#D9822B";
          return (
          <CircleMarker key={`det-${i}`} center={[lat, lng]} radius={9}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.55, dashArray: bad ? "4 3" : undefined }}>
            <Popup>
              <b>🛰 {p.status_display}</b><br />
              {p.region || "Unknown region"} · {Math.round(p.confidence * 100)}% confidence<br />
              {p.concession ? `Licensed: ${p.concession}` : p.operator ? `Operator: ${p.operator}` : "No licensed concession here"}
            </Popup>
          </CircleMarker>);
        })}
        </MapContainer>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
