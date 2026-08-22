import { useState } from "react";
import { Alert, Box, Button, Card, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useAdminUsersQuery, useCreateAdminUserMutation, useUpdateAdminUserMutation } from "../services/api";

export const ROLES: [value: string, label: string][] = [
  ["super_admin", "Super Admin"], ["ceo", "GoldBod CEO"], ["goldbod_officer", "GoldBod Officer"],
  ["miner", "Licensed Miner"], ["mining_company", "Mining Company"], ["buying_agent", "Buying Agent"],
  ["tier1_buyer", "Tier 1 Buyer"], ["tier2_buyer", "Tier 2 Buyer"], ["aggregator", "Aggregator"],
  ["assayer", "Assayer"], ["refinery_operator", "Refinery Operator"], ["exporter", "Exporter"],
  ["customs_officer", "Customs Officer"], ["security_agency", "Security Agency"],
  ["bog_officer", "Bank of Ghana"], ["ministry_official", "Ministry Official"],
  ["env_officer", "EPA Officer"], ["international_buyer", "International Buyer"],
  ["rider", "Delivery Rider"], ["driver", "Delivery Driver"],
];

export default function Users() {
  const { data, isError } = useAdminUsersQuery();
  const [createUser, { isLoading: creating }] = useCreateAdminUserMutation();
  const [updateUser] = useUpdateAdminUserMutation();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ username: "", password: "", role: "miner",
    first_name: "", last_name: "", email: "", region: "", district: "",
    latitude: "", longitude: "" });

  if (isError) return <Typography color="text.secondary">Super Admin access is required.</Typography>;
  const rows = data?.results ?? [];
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const create = async () => {
    setErr("");
    try {
      await createUser({ ...f,
        latitude: f.latitude ? Number(f.latitude) : null,
        longitude: f.longitude ? Number(f.longitude) : null }).unwrap();
      setOpen(false);
      setF({ username: "", password: "", role: "miner", first_name: "", last_name: "",
        email: "", region: "", district: "", latitude: "", longitude: "" });
    } catch {
      setErr("Could not create user. Username may be taken or the password too weak (min 10 chars).");
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4">User management</Typography>
          <Typography color="text.secondary">Create accounts and assign GoldBod roles.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}
          sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>New user</Button>
      </Stack>

      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>User</TableCell><TableCell>Name</TableCell><TableCell>Role</TableCell>
            <TableCell>Active</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell className="mono">{u.username}</TableCell>
                <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>
                  <TextField select size="small" value={u.role}
                    onChange={(e) => updateUser({ id: u.id, body: { role: e.target.value as never } })}
                    sx={{ minWidth: 180 }}>
                    {ROLES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell>
                  <Switch checked={u.is_active}
                    onChange={(e) => updateUser({ id: u.id, body: { is_active: e.target.checked } })} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4}>
              <Typography color="text.secondary">No users yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Username" value={f.username} onChange={set("username")} fullWidth />
              <TextField label="Password" type="password" value={f.password} onChange={set("password")} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="First name" value={f.first_name} onChange={set("first_name")} fullWidth />
              <TextField label="Last name" value={f.last_name} onChange={set("last_name")} fullWidth />
            </Stack>
            <TextField label="Email" value={f.email} onChange={set("email")} fullWidth />
            <TextField select label="Role" value={f.role} onChange={set("role")} fullWidth>
              {ROLES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Region" value={f.region} onChange={set("region")} fullWidth />
              <TextField label="District" value={f.district} onChange={set("district")} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Latitude" value={f.latitude} onChange={set("latitude")}
                placeholder="e.g. 6.2027" fullWidth />
              <TextField label="Longitude" value={f.longitude} onChange={set("longitude")}
                placeholder="e.g. -1.6700" fullWidth />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Location pins the operator on the national map. Copy coordinates from Google Maps
              (right-click a spot → the lat, lng at the top).
            </Typography>
            {err && <Alert severity="error">{err}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={creating || !f.username || !f.password}
            sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>Create user</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
