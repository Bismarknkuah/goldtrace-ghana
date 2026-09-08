import { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import VerifiedIcon from "@mui/icons-material/Verified";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { useLicensesQuery, useLicenseActionMutation, useRegistryLookupQuery,
  useRequestRenewalMutation } from "../services/api";
import { useAppSelector } from "../app/hooks";

const MANAGERS = ["super_admin", "ceo", "goldbod_officer"];
const STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success", pending: "warning", suspended: "warning", revoked: "error", expired: "default",
};

export default function Licensing() {
  const role = useAppSelector((s) => s.auth.user?.role ?? "");
  const canManage = MANAGERS.includes(role);
  const { data } = useLicensesQuery();
  const [act, { isLoading }] = useLicenseActionMutation();
  const [requestRenewal] = useRequestRenewalMutation();
  const renewRef = useRef<HTMLInputElement>(null);
  const [renewId, setRenewId] = useState<string | null>(null);
  const onRenewFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !renewId) return;
    if (file.size > 1_800_000) { alert("Please choose a file under 1.8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => requestRenewal({ id: renewId, renewal_document: reader.result as string });
    reader.readAsDataURL(file);
  };

  const [input, setInput] = useState("");
  const [number, setNumber] = useState("");
  const { data: result, isError, isFetching } = useRegistryLookupQuery(number, { skip: !number });

  const rows = data?.results ?? [];

  return (
    <Stack spacing={3}>
      <input hidden ref={renewRef} type="file" accept="image/*,application/pdf" onChange={onRenewFile} />
      <Box>
        <Typography variant="h4">Licensing</Typography>
        <Typography color="text.secondary">GoldBod licences and the public License Registry.</Typography>
      </Box>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Verify a licence</Typography>
        <Stack direction="row" spacing={1.5}>
          <TextField fullWidth size="small" placeholder="GB-AG-2026-XXXXX" value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && setNumber(input.trim())} />
          <Button variant="contained" onClick={() => setNumber(input.trim())} disabled={!input}>Verify</Button>
        </Stack>
        {isFetching && <Typography color="text.secondary" sx={{ mt: 2 }}>Checking the registry…</Typography>}
        {isError && number && <Alert severity="warning" sx={{ mt: 2 }}>No licence found for {number}.</Alert>}
        {result?.found && (
          <Alert severity={result.is_valid ? "success" : "error"} icon={<VerifiedIcon />} sx={{ mt: 2 }}>
            <b>{result.license_number}</b> — {result.type_display}, held by {result.holder_name} ({result.region}).
            Status: {result.status}. {result.is_valid ? "Valid and active." : "Not currently valid."}
          </Alert>
        )}
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>{canManage ? "Issued licences" : "Your licences"}</Typography>
        <Table>
          <TableHead><TableRow>
            <TableCell>Number</TableCell><TableCell>Type</TableCell><TableCell>Holder</TableCell>
            <TableCell>Status</TableCell><TableCell>Expires</TableCell><TableCell />
          </TableRow></TableHead>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id} hover>
                <TableCell className="mono">{l.license_number}</TableCell>
                <TableCell>{l.type_display}</TableCell>
                <TableCell>{l.holder_name}</TableCell>
                <TableCell><Chip size="small" color={STATUS_COLOR[l.status] ?? "default"} label={l.status_display} /></TableCell>
                <TableCell>{l.expires_at ?? "—"}</TableCell>
                {!canManage && (
                  <TableCell align="right">
                    {l.renewal_requested ? (
                      <Chip size="small" color="info" label="Renewal submitted" />
                    ) : (
                      <Button size="small" startIcon={<AutorenewIcon />}
                        onClick={() => { setRenewId(l.id); renewRef.current?.click(); }}>
                        Renew licence
                      </Button>
                    )}
                  </TableCell>
                )}
                {canManage && (
                  <TableCell align="right">
                    {l.status === "active" ? (
                      <>
                        <Button size="small" color="warning" disabled={isLoading}
                          onClick={() => act({ id: l.id, action: "suspend" })}>Suspend</Button>
                        <Button size="small" color="error" disabled={isLoading}
                          onClick={() => act({ id: l.id, action: "revoke" })}>Revoke</Button>
                      </>
                    ) : (
                      <Button size="small" disabled={isLoading}
                        onClick={() => act({ id: l.id, action: "reinstate" })}>Reinstate</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={canManage ? 6 : 5}>
              <Typography color="text.secondary">No licences yet.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </Stack>
  );
}
