import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import {
  CircleMarker, GeoJSON, LayerGroup, LayersControl, MapContainer, Popup, TileLayer, Tooltip, useMap,
} from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { useConcessionsGeoQuery, useHotspotsGeoQuery, useOperatorsQuery,
  useComplianceMapQuery, useDetectionsGeoQuery } from "../services/api";
import { useAppSelector } from "../app/hooks";
import {
  GHANA_BOUNDS, GHANA_MAX_BOUNDS, MINING_AREAS, REGIONS, inGhana, parseLatLng,
} from "../geo/ghana";

const SEVERITY_COLOR: Record<string, string> = { high: "#B23A2E", medium: "#D9822B", low: "#C9A227" };
const COMPLY = { compliant: "#2E7D32", warning: "#D9822B", violating: "#B23A2E" } as const;
const OVERSIGHT = ["super_admin", "ceo", "goldbod_officer", "bog_officer", "ministry_official",
  "customs_officer", "security_agency", "env_officer", "independent_auditor"];

type Target = { center: LatLngTuple; zoom: number } | { fit: "all" | "ghana" } | null;

function Navigator({ target, all }: { target: Target; all: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if ("center" in target) map.flyTo(target.center, target.zoom, { duration: 0.8 });
    else if (target.fit === "all" && all.length > 1) map.fitBounds(all, { padding: [40, 40], maxZoom: 12 });
    else map.fitBounds(GHANA_BOUNDS);
  }, [map, target, all]);
  return null;
}

const gmaps = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

type Operator = { latitude: number; longitude: number; username: string; role_display: string;
  region: string; district: string; status?: keyof typeof COMPLY; reasons?: string[] };

export default function MapView() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const oversight = OVERSIGHT.includes(role);
  const { data: concessions } = useConcessionsGeoQuery();
  const { data: hotspots } = useHotspotsGeoQuery();
  const { data: operators } = useOperatorsQuery(undefined, { skip: !oversight });
  const { data: compliance } = useComplianceMapQuery(undefined, { skip: !oversight });
  const { data: detections } = useDetectionsGeoQuery(undefined, { skip: !oversight });
  const [target, setTarget] = useState<Target>(null);
  const [jump, setJump] = useState("");
  const [coord, setCoord] = useState("");
  const [coordErr, setCoordErr] = useState("");
  const [pin, setPin] = useState<LatLngTuple | null>(null);

  // Keep only points that are genuinely inside Ghana; count the rest so bad data is visible.
  const { hot, dets, ops, hidden, allPts } = useMemo(() => {
    let hidden = 0;
    const pt = (lat: number, lng: number) => { if (inGhana(lat, lng)) return true; hidden += 1; return false; };
    const hot = (hotspots?.features ?? []).filter((f) => {
      if (f.geometry?.type !== "Point") return false;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      return pt(lat, lng);
    });
    const dets = (detections?.features ?? []).filter((f) => {
      const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      return pt(lat, lng);
    });
    const ops = ((compliance?.operators ?? operators ?? []) as Operator[]).filter((o) => pt(o.latitude, o.longitude));
    const allPts: LatLngTuple[] = [
      ...hot.map((f) => { const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates; return [lat, lng] as LatLngTuple; }),
      ...dets.map((f) => { const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates; return [lat, lng] as LatLngTuple; }),
      ...ops.map((o) => [o.latitude, o.longitude] as LatLngTuple),
    ];
    return { hot, dets, ops, hidden, allPts };
  }, [hotspots, detections, compliance, operators]);

  const illegal = dets.filter((f) => String((f.properties as { status?: string })?.status ?? "").includes("illegal")).length;

  const goJump = (v: string) => {
    setJump(v);
    const c = REGIONS[v] ?? MINING_AREAS[v];
    if (c) setTarget({ center: c, zoom: REGIONS[v] ? 9 : 12 });
  };
  const goCoord = () => {
    const p = parseLatLng(coord);
    if (!p) { setCoordErr("Enter a point inside Ghana as “latitude, longitude”, e.g. 6.2027, -1.6704"); return; }
    setCoordErr(""); setPin(p); setTarget({ center: p, zoom: 14 });
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4">Geospatial monitoring</Typography>
        <Typography color="text.secondary">
          Licensed concessions, illegal-mining hotspots, satellite and citizen detections, and operator
          compliance across Ghana. Switch to the satellite view to inspect ground conditions.
        </Typography>
      </Box>

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Chip label={`${concessions?.features.length ?? 0} licensed concessions`} sx={{ bgcolor: "#C9A227", color: "#0C1813" }} />
        <Chip label={`${hot.length} hotspots`} sx={{ bgcolor: "#D9822B", color: "#fff" }} />
        {oversight && <Chip label={`${dets.length} detections · ${illegal} illegal`} sx={{ bgcolor: "#B23A2E", color: "#fff" }} />}
        {oversight && compliance && (<>
          <Chip label={`${compliance.summary.compliant} compliant`} sx={{ bgcolor: COMPLY.compliant, color: "#fff" }} />
          <Chip label={`${compliance.summary.warning} warning`} sx={{ bgcolor: COMPLY.warning, color: "#fff" }} />
          <Chip label={`${compliance.summary.violating} violating`} sx={{ bgcolor: COMPLY.violating, color: "#fff" }} />
        </>)}
      </Stack>

      <Card><CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField size="small" select label="Go to region or mining area" value={jump}
            onChange={(e) => goJump(e.target.value)} sx={{ minWidth: 260 }}>
            <MenuItem disabled value="__r">— Regions —</MenuItem>
            {Object.keys(REGIONS).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            <MenuItem disabled value="__m">— Mining areas —</MenuItem>
            {Object.keys(MINING_AREAS).map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Find coordinates" placeholder="6.2027, -1.6704" value={coord}
            onChange={(e) => setCoord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && goCoord()}
            error={!!coordErr} sx={{ minWidth: 220 }} />
          <Button size="small" variant="outlined" onClick={goCoord}>Locate</Button>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={() => setTarget({ fit: "all" })} disabled={allPts.length < 2}>Fit to data</Button>
          <Button size="small" onClick={() => { setTarget({ fit: "ghana" }); setPin(null); }}>Whole of Ghana</Button>
        </Stack>
        {coordErr && <Typography variant="caption" color="error">{coordErr}</Typography>}
      </CardContent></Card>

      {hidden > 0 && (
        <Alert severity="warning">
          {hidden} record{hidden > 1 ? "s have" : " has"} coordinates outside Ghana and {hidden > 1 ? "are" : "is"} not shown.
          These are data-entry errors (often a missing minus sign on longitude) and should be corrected at source.
        </Alert>
      )}

      <Card><CardContent sx={{ p: 0 }}>
        <Box sx={{ height: { xs: "60vh", md: "72vh" }, borderRadius: 1, overflow: "hidden" }}>
          <MapContainer bounds={GHANA_BOUNDS} maxBounds={GHANA_MAX_BOUNDS} minZoom={6} maxZoom={18}
            style={{ height: "100%", width: "100%" }}>
            <Navigator target={target} all={allPts} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Street map">
                <TileLayer attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite imagery">
                <TileLayer attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics" maxZoom={18}
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Terrain">
                <TileLayer attribution="&copy; OpenTopoMap (CC-BY-SA)" maxZoom={17}
                  url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />
              </LayersControl.BaseLayer>

              <LayersControl.Overlay checked name="Licensed concessions">
                <LayerGroup>
                  {concessions && (
                    <GeoJSON key={concessions.features.length} data={concessions}
                      style={() => ({ color: "#C9A227", weight: 2, fillColor: "#C9A227", fillOpacity: 0.15 })}
                      onEachFeature={(f, layer) => {
                        const p = (f.properties ?? {}) as Record<string, unknown>;
                        layer.bindPopup(`<b>${p.name ?? "Concession"}</b><br/>${p.code ?? ""} · ${p.region ?? ""} Region<br/>`
                          + `${Number(p.area_hectares ?? 0).toLocaleString()} ha · ${p.is_active ? "Active licence" : "Inactive"}`);
                      }} />
                  )}
                </LayerGroup>
              </LayersControl.Overlay>

              <LayersControl.Overlay checked name="Illegal-mining hotspots">
                <LayerGroup>
                  {hot.map((f, i) => {
                    const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
                    const pr = (f.properties ?? {}) as Record<string, string>;
                    const sev = String(pr.severity ?? "medium");
                    return (
                      <CircleMarker key={`h-${i}`} center={[lat, lng]} radius={9}
                        pathOptions={{ color: "#fff", weight: 2, fillColor: SEVERITY_COLOR[sev], fillOpacity: 0.9 }}>
                        <Tooltip>{pr.title ?? "Hotspot"}</Tooltip>
                        <Popup>
                          <b>{pr.title ?? "Hotspot"}</b><br />
                          Severity: {sev} · {pr.status ?? ""}<br />
                          {pr.region ? `${pr.region} Region · ` : ""}source: {pr.source || "—"}<br />
                          {lat.toFixed(5)}, {lng.toFixed(5)} · <a href={gmaps(lat, lng)} target="_blank" rel="noreferrer">open in Maps ↗</a>
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </LayerGroup>
              </LayersControl.Overlay>

              {oversight && (
                <LayersControl.Overlay checked name="Satellite & citizen detections">
                  <LayerGroup>
                    {dets.map((ft, i) => {
                      const [lng, lat] = (ft.geometry as unknown as { coordinates: [number, number] }).coordinates;
                      const p = ft.properties as { status: string; status_display: string; confidence: number;
                        region: string; operator: string; concession: string | null; source: string };
                      const bad = p.status.includes("illegal");
                      const color = bad ? "#B23A2E" : p.status === "licensed" ? "#2E7D32" : "#D9822B";
                      return (
                        <CircleMarker key={`d-${i}`} center={[lat, lng]} radius={11}
                          pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.35, dashArray: bad ? "4 3" : undefined }}>
                          <Popup>
                            <b>{p.source === "public_report" ? "📣 Citizen report" : "🛰 Satellite detection"}: {p.status_display}</b><br />
                            {p.region || "Unknown region"} · {Math.round((p.confidence ?? 0) * 100)}% confidence<br />
                            {p.concession ? `Inside licensed concession ${p.concession}` : p.operator ? `Operator: ${p.operator}` : "No licensed concession covers this point"}<br />
                            {lat.toFixed(5)}, {lng.toFixed(5)} · <a href={gmaps(lat, lng)} target="_blank" rel="noreferrer">open in Maps ↗</a>
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}

              {oversight && (
                <LayersControl.Overlay checked name="Operator compliance">
                  <LayerGroup>
                    {ops.map((o, i) => {
                      const color = COMPLY[o.status ?? "compliant"];
                      return (
                        <CircleMarker key={`o-${i}`} center={[o.latitude, o.longitude]} radius={7}
                          pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }}>
                          <Popup>
                            <b>{o.username}</b> · {o.role_display}<br />
                            {[o.district, o.region].filter(Boolean).join(", ")}<br />
                            <b style={{ color }}>{(o.status ?? "compliant").toUpperCase()}</b>
                            {(o.reasons ?? []).length > 0 && (<><br />{(o.reasons ?? []).join("; ")}</>)}
                          </Popup>
                        </CircleMarker>
                      );
                    })}
                  </LayerGroup>
                </LayersControl.Overlay>
              )}

              <LayersControl.Overlay name="Regional capitals">
                <LayerGroup>
                  {Object.entries(REGIONS).map(([name, c]) => (
                    <CircleMarker key={name} center={c} radius={4} pathOptions={{ color: "#0C1813", fillColor: "#0C1813", fillOpacity: 1 }}>
                      <Tooltip permanent direction="right" offset={[6, 0]}>{name}</Tooltip>
                    </CircleMarker>
                  ))}
                </LayerGroup>
              </LayersControl.Overlay>
            </LayersControl>

            {pin && (
              <CircleMarker center={pin} radius={12} pathOptions={{ color: "#1565C0", weight: 3, fillOpacity: 0.15 }}>
                <Tooltip permanent direction="top">{pin[0].toFixed(5)}, {pin[1].toFixed(5)}</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        </Box>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="subtitle2" gutterBottom>Legend</Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
          {[
            ["#C9A227", "Licensed concession boundary"],
            [SEVERITY_COLOR.high, "Hotspot — high severity"],
            [SEVERITY_COLOR.medium, "Hotspot — medium"],
            ["#B23A2E", "Detection — illegal (dashed ring)"],
            ["#2E7D32", "Detection inside a licence / compliant operator"],
            [COMPLY.warning, "Operator — warning"],
            [COMPLY.violating, "Operator — violating"],
          ].map(([c, l]) => (
            <Stack key={l} direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: c }} />
              <Typography variant="caption">{l}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent></Card>
    </Stack>
  );
}
