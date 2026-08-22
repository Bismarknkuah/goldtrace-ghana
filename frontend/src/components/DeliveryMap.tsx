import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from "react-leaflet";

interface Pt { lat: number; lng: number }

export default function DeliveryMap({ pickup, dropoff, courier, height = "48vh" }: {
  pickup: Pt; dropoff: Pt; courier?: { lat: number | null; lng: number | null }; height?: string;
}) {
  const center: [number, number] = [(pickup.lat + dropoff.lat) / 2, (pickup.lng + dropoff.lng) / 2];
  const hasCourier = courier && courier.lat != null && courier.lng != null;
  return (
    <div style={{ height, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={[[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]}
          pathOptions={{ color: "#C9A227", weight: 3, dashArray: "6 6" }} />
        <CircleMarker center={[pickup.lat, pickup.lng]} radius={10}
          pathOptions={{ color: "#10261C", fillColor: "#10261C", fillOpacity: 0.85 }}>
          <Popup>Store / pickup</Popup>
        </CircleMarker>
        <CircleMarker center={[dropoff.lat, dropoff.lng]} radius={10}
          pathOptions={{ color: "#B23A2E", fillColor: "#B23A2E", fillOpacity: 0.85 }}>
          <Popup>Buyer / drop-off</Popup>
        </CircleMarker>
        {hasCourier && (
          <CircleMarker center={[courier!.lat as number, courier!.lng as number]} radius={9}
            pathOptions={{ color: "#2E7D52", fillColor: "#2E7D52", fillOpacity: 0.9 }}>
            <Popup>Courier (live)</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
