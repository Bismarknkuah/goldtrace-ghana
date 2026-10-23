import { useEffect } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { GeoPoint } from "../types";
import { GHANA_BOUNDS, GHANA_MAX_BOUNDS, inGhana } from "../geo/ghana";

const KIND: Record<string, { color: string; label: string }> = {
  origin: { color: "#C9A227", label: "Origin (mine)" },
  pickup: { color: "#1565C0", label: "Pickup" },
  courier: { color: "#6A1B9A", label: "Courier (last reported)" },
  dropoff: { color: "#2E7D32", label: "Drop-off" },
  incident: { color: "#B23A2E", label: "Last seen (incident)" },
  now: { color: "#0C1813", label: "Current position" },
};

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 12);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
    else map.fitBounds(GHANA_BOUNDS);
  }, [map, points]);
  return null;
}

// The gold's physical journey across Ghana: origin → transport → current position.
export default function TrailMap({ trail, position }: { trail: GeoPoint[]; position: GeoPoint | null }) {
  const pts = trail.filter((p) => inGhana(p.lat, p.lng));
  const line = pts.filter((p) => p.kind !== "incident").map((p) => [p.lat, p.lng] as [number, number]);
  const all: [number, number][] = [...pts.map((p) => [p.lat, p.lng] as [number, number]),
    ...(position && inGhana(position.lat, position.lng) ? [[position.lat, position.lng] as [number, number]] : [])];

  return (
    <Box>
      <Box sx={{ height: 340, borderRadius: 1, overflow: "hidden" }}>
        <MapContainer bounds={GHANA_BOUNDS} maxBounds={GHANA_MAX_BOUNDS} minZoom={6}
          style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Fit points={all} />
          {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#C9A227", weight: 3, dashArray: "6 6" }} />}
          {pts.map((p, i) => {
            const k = KIND[p.kind ?? "origin"] ?? KIND.origin;
            return (
              <CircleMarker key={i} center={[p.lat, p.lng]} radius={8}
                pathOptions={{ color: "#fff", weight: 2, fillColor: k.color, fillOpacity: 1 }}>
                <Tooltip>{p.label ?? k.label}</Tooltip>
                <Popup><b>{p.label ?? k.label}</b><br />{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</Popup>
              </CircleMarker>
            );
          })}
          {position && inGhana(position.lat, position.lng) && (
            <CircleMarker center={[position.lat, position.lng]} radius={13}
              pathOptions={{ color: "#0C1813", weight: 3, fillColor: "#E4B84C", fillOpacity: 0.55 }}>
              <Tooltip permanent direction="top">Now</Tooltip>
              <Popup><b>Current position</b><br />{position.label}<br />
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
        {Object.entries(KIND).map(([k, v]) => (
          <Stack key={k} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: v.color }} />
            <Typography variant="caption" color="text.secondary">{v.label}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
