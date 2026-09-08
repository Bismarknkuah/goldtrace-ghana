import { Box, Chip, Stack, Typography } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import VerifiedIcon from "@mui/icons-material/Verified";
import type { CustodyEvent } from "../types";

const short = (h: string) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");

export default function ChainTimeline({ events, valid }: { events: CustodyEvent[]; valid?: boolean }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Typography variant="h6">Chain of custody</Typography>
        {valid !== undefined && (
          <Chip size="small" color={valid ? "success" : "error"}
            icon={<VerifiedIcon sx={{ fontSize: 16 }} />}
            label={valid ? "Verified" : "Tampered"} />
        )}
      </Stack>
      <Stack spacing={0}>
        {events.map((e, i) => (
          <Box key={e.id ?? i} sx={{ display: "flex", gap: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "secondary.main",
                border: "2px solid #0C1813", mt: 0.5 }} />
              {i < events.length - 1 && (
                <Box sx={{ width: 2, flex: 1, minHeight: 44, bgcolor: "#D8D0BD" }} />
              )}
            </Box>
            <Box sx={{ pb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={600} sx={{ fontFamily: "Fraunces, serif" }}>
                  {e.event_type_display || e.event_type}
                </Typography>
                {e.anchored_tx && (
                  <Chip size="small" variant="outlined" icon={<LinkIcon sx={{ fontSize: 14 }} />}
                    label="anchored" sx={{ height: 20 }} />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {e.from_party ? `${e.from_party} → ` : ""}{e.to_party || "—"}
                {e.created_at ? ` · ${new Date(e.created_at).toLocaleString()}` : ""}
              </Typography>
              <Typography className="hash" color="text.secondary">hash {short(e.event_hash)}</Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
