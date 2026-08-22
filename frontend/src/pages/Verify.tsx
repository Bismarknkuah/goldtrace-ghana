import { useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import GppGoodIcon from "@mui/icons-material/GppGood";
import GppBadIcon from "@mui/icons-material/GppBad";
import { useVerifyBatchQuery } from "../services/api";
import AssayStamp from "../components/AssayStamp";
import ChainTimeline from "../components/ChainTimeline";

export default function Verify() {
  const [input, setInput] = useState("");
  const [code, setCode] = useState("");
  const { data, isFetching, isError } = useVerifyBatchQuery(code, { skip: !code });

  return (
    <Stack spacing={3} sx={{ maxWidth: 720, mx: "auto" }}>
      <Box>
        <Typography variant="h4">Verify a gold passport</Typography>
        <Typography color="text.secondary">
          Enter the batch code from a QR scan to confirm provenance and chain integrity.
        </Typography>
      </Box>
      <Stack direction="row" spacing={1.5}>
        <TextField fullWidth placeholder="GH-XXXXXXXXXX" value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && setCode(input.trim())} />
        <Button variant="contained" onClick={() => setCode(input.trim())} disabled={!input}>Verify</Button>
      </Stack>

      {isError && code && <Typography color="error">No passport found for that code.</Typography>}
      {isFetching && <Typography color="text.secondary">Checking the ledger…</Typography>}

      {data && (
        <Card sx={{ borderColor: data.chain_valid ? "success.main" : "error.main" }}>
          <CardContent>
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
              <AssayStamp fineness={data.fineness} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" className="mono">{data.batch_code}</Typography>
                <Typography color="text.secondary">
                  Licence {data.miner_license} · {data.gross_weight_g} g · {data.status}
                </Typography>
              </Box>
              <Chip color={data.chain_valid ? "success" : "error"}
                icon={data.chain_valid ? <GppGoodIcon /> : <GppBadIcon />}
                label={data.chain_valid ? "Chain verified" : "Chain tampered"}
                sx={{ height: 40, fontSize: 15, px: 1 }} />
            </Stack>
            <Box sx={{ mt: 3 }}>
              <ChainTimeline events={data.custody_chain} valid={data.chain_valid} />
            </Box>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
