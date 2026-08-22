import { Box, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography } from "@mui/material";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";
import { Button, TextField } from "@mui/material";
import { useRevenueOverviewQuery, useCurrentRateQuery, useCreateRateMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";

const ghs = (v: string | number) =>
  "GHS " + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>
          {label.toUpperCase()}
        </Typography>
        <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 600, lineHeight: 1.15 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Revenue() {
  const { data, isError } = useRevenueOverviewQuery();
  const { data: rate } = useCurrentRateQuery();
  const [setRate, { isLoading: savingRate }] = useCreateRateMutation();
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const canSetRate = ["super_admin", "ceo", "bog_officer"].includes(role);
  const [newRate, setNewRate] = useState("");
  if (isError) return <Typography color="text.secondary">Regulator, BoG or ministry access is required.</Typography>;

  const s = data?.summary;
  const chart = (data?.by_destination ?? []).map((d) => ({
    destination: d.destination, value: Number(d.value_ghs), royalty: Number(d.royalty_ghs),
  }));

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">National revenue & royalties</Typography>
        <Typography color="text.secondary">
          Export value and statutory mineral royalty (
          {data ? `${(data.assumptions.royalty_rate * 100).toFixed(0)}% @ GHS ${data.assumptions.gold_price_ghs_per_g}/g fine` : "—"}).
        </Typography>
      </Box>

      <Box className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total export value" value={ghs(s?.total_export_value_ghs ?? 0)} />
        <StatCard label="Royalties due" value={ghs(s?.total_royalty_ghs ?? 0)} />
        <StatCard label="Exports certified" value={String(s?.export_count ?? 0)} />
        <StatCard label="Fine gold exported" value={`${Number(s?.total_fine_weight_g ?? 0).toLocaleString()} g`} />
      </Box>

      <Card><CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, letterSpacing: 1 }}>
              BANK OF GHANA REFERENCE RATE
            </Typography>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600 }}>
              GHS {rate?.rate_ghs_per_g ?? "—"} <span style={{ fontSize: 15, fontWeight: 400 }}>/ g fine</span>
            </Typography>
          </Box>
          {canSetRate && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField size="small" label="New rate (GHS/g)" value={newRate}
                onChange={(e) => setNewRate(e.target.value)} />
              <Button variant="contained" disabled={savingRate || !newRate}
                onClick={() => { setRate({ rate_ghs_per_g: newRate }); setNewRate(""); }}>Update rate</Button>
            </Stack>
          )}
        </Stack>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Export value by destination</Typography>
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE8DA" />
              <XAxis dataKey="destination" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => ghs(Number(value))} />
              <Bar dataKey="value" name="Export value" fill="#C9A227" radius={[4, 4, 0, 0]} />
              <Bar dataKey="royalty" name="Royalty" fill="#10261C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Certified exports</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Certificate</TableCell><TableCell>Batch</TableCell><TableCell>Destination</TableCell>
            <TableCell>Fine (g)</TableCell><TableCell>Value</TableCell><TableCell>Royalty</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {(data?.certificates ?? []).map((c) => (
              <TableRow key={c.certificate_number} hover>
                <TableCell className="mono">{c.certificate_number}</TableCell>
                <TableCell className="mono">{c.batch_code}</TableCell>
                <TableCell>{c.destination}</TableCell>
                <TableCell>{c.fine_weight_g}</TableCell>
                <TableCell>{ghs(c.value_ghs)}</TableCell>
                <TableCell>{ghs(c.royalty_ghs)}</TableCell>
              </TableRow>
            ))}
            {(data?.certificates ?? []).length === 0 && <TableRow><TableCell colSpan={6}>
              <Typography color="text.secondary">No issued export certificates yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
