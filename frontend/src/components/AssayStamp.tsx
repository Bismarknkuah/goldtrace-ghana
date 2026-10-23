// Fineness shown as a struck assay hallmark — the subject's own vernacular.
export default function AssayStamp({ fineness, size = 76 }: { fineness: number | null; size?: number }) {
  const value = fineness ?? "—";
  const karat = fineness ? Math.round((fineness / 1000) * 24) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Fineness ${value}`}>
      <circle cx="50" cy="50" r="46" fill="#0C1813" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#C9A227" strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#C9A227" strokeWidth="0.6" opacity="0.6" />
      <text x="50" y="42" textAnchor="middle" fontFamily="Fraunces, serif" fontSize="26"
        fontWeight="600" fill="#E4B84C">{value}</text>
      <text x="50" y="58" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7"
        letterSpacing="2" fill="#9DB0A2">FINENESS</text>
      {karat && (
        <text x="50" y="74" textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
          fontSize="9" fill="#C9A227">{karat}K</text>
      )}
    </svg>
  );
}
