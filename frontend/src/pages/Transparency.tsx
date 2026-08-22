import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTransparencyQuery } from "../services/api";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card><CardContent>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </Typography>
      <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 600, lineHeight: 1.15 }}>
        {value}
      </Typography>
      {sub && <Typography variant="body2" color="text.secondary">{sub}</Typography>}
    </CardContent></Card>
  );
}

const fmt = (n: string | number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function Transparency() {
  const { data, isLoading } = useTransparencyQuery();
  if (isLoading || !data) return <Typography color="text.secondary">Loading national figures…</Typography>;

  const { production: p, exports: e, licensing: l } = data;
  const regionData = data.by_region.slice(0, 8).map((r) => ({
    region: r.region, batches: r.batches, kg: Number(r.gross_weight_g) / 1000 }));

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">National transparency</Typography>
        <Typography color="text.secondary">
          Aggregate figures for Ghana's gold value chain under the Ghana Gold Board. No commercially
          sensitive or per-operator detail is shown.
        </Typography>
      </Box>

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Gold handled" value={`${fmt(Number(p.gross_weight_g) / 1000)} kg`}
          sub={`${fmt(p.total_batches)} batches`} />
        <Stat label="Average purity" value={`${p.average_fineness}‰`} sub="fineness across all batches" />
        <Stat label="Export value" value={`GHS ${fmt(e.total_value_ghs)}`}
          sub={`${fmt(e.export_count)} shipments`} />
        <Stat label="FX generated" value={`$${fmt(e.fx_generated_usd)}`} sub="from gold exports" />
      </Box>

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Fine gold exported" value={`${fmt(Number(e.fine_weight_g) / 1000)} kg`} />
        <Stat label="Royalties" value={`GHS ${fmt(e.total_royalty_ghs)}`} />
        <Stat label="BoG reference rate" value={`GHS ${fmt(data.reference_rate_ghs_per_g)}`} sub="per gram fine" />
        <Stat label="Batches exported" value={fmt(p.exported_batches)} />
      </Box>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Production by region</Typography>
        <Box sx={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
              <XAxis dataKey="region" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="batches" radius={[6, 6, 0, 0]}>
                {regionData.map((_, i) => <Cell key={i} fill="#C9A227" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent></Card>

      <Box className="grid lg:grid-cols-2 gap-4">
        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Exports by destination</Typography>
          {data.by_destination.length === 0
            ? <Typography color="text.secondary">No exports recorded yet.</Typography>
            : data.by_destination.map((d) => (
              <Stack key={d.destination} direction="row" justifyContent="space-between"
                sx={{ py: 1, borderBottom: "1px solid #eee" }}>
                <Typography>{d.destination}</Typography>
                <Typography className="mono">GHS {fmt(d.value_ghs)} · {d.count}</Typography>
              </Stack>
            ))}
        </CardContent></Card>

        <Card><CardContent>
          <Typography variant="h6" gutterBottom>Licensing integrity</Typography>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Chip color="success" label={`${l.active} active`} />
            <Chip color="warning" label={`${l.suspended} suspended`} />
            <Chip color="error" label={`${l.revoked} revoked`} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Suspended and revoked licences are published for public accountability. Verify any operator
            on the public License Registry under Licensing.
          </Typography>
        </CardContent></Card>
      </Box>
    </Stack>
  );
}
