// Ghana geography shared by every map: national bounds and the 16 regional capitals.
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";

export const LAT_MIN = 4.5;
export const LAT_MAX = 11.2;
export const LNG_MIN = -3.3;
export const LNG_MAX = 1.3;

export const GHANA_CENTER: LatLngTuple = [7.95, -1.03];
export const GHANA_BOUNDS: LatLngBoundsExpression = [[LAT_MIN, LNG_MIN], [LAT_MAX, LNG_MAX]];
// Slightly looser box so users can pan to the border without the map snapping back.
export const GHANA_MAX_BOUNDS: LatLngBoundsExpression = [[3.5, -4.5], [12.2, 2.5]];

export const inGhana = (lat?: number | null, lng?: number | null) =>
  lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;

export const REGIONS: Record<string, LatLngTuple> = {
  "Greater Accra": [5.6037, -0.187],
  Ashanti: [6.6885, -1.6244],
  Western: [4.934, -1.7137],
  "Western North": [6.2077, -2.4859],
  Central: [5.1053, -1.2466],
  Eastern: [6.0941, -0.2591],
  Volta: [6.6008, 0.4713],
  Oti: [8.0697, 0.1794],
  Northern: [9.4008, -0.8393],
  Savannah: [9.0833, -1.8167],
  "North East": [10.5274, -0.3698],
  "Upper East": [10.7856, -0.8514],
  "Upper West": [10.0601, -2.5099],
  Bono: [7.3349, -2.3123],
  "Bono East": [7.5832, -1.9381],
  Ahafo: [6.8036, -2.5172],
};

// Major gold-mining districts, for quick navigation on the national map.
export const MINING_AREAS: Record<string, LatLngTuple> = {
  "Obuasi (Ashanti)": [6.2027, -1.6704],
  "Tarkwa (Western)": [5.3018, -1.9930],
  "Prestea (Western)": [5.4333, -2.1430],
  "Dunkwa-on-Offin (Central)": [5.9624, -1.7799],
  "Bibiani (Western North)": [6.4631, -2.3191],
  "Kibi (Eastern)": [6.1653, -0.5547],
  "Konongo (Ashanti)": [6.6170, -1.2167],
  "Wa / Upper West belt": [10.0601, -2.5099],
};

/** Parse "6.2027, -1.6704" (or "6.2027 -1.6704") into a point, or null. */
export function parseLatLng(text: string): LatLngTuple | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]);
  return inGhana(lat, lng) ? [lat, lng] : null;
}
