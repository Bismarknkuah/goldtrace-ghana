import { Box, Chip, Stack, Typography } from "@mui/material";
import type { BatchGraph, GraphNode } from "../types";

const STAGE_LABEL: Record<string, string> = {
  source: "Source", lot: "Gold lot", assay: "Assay", ownership: "Ownership",
  custody: "Custody", refinery: "Refinery", export: "Export",
};
const TYPE_COLOR: Record<string, string> = {
  concession: "#7A6A2E", miner: "#C9A227", lot: "#0C1813", assay: "#2E7D32",
  owner: "#1565C0", custody: "#6A1B9A", export: "#B23A2E", refinery: "#D9822B",
};

function NodeCard({ n }: { n: GraphNode }) {
  const color = TYPE_COLOR[n.type] ?? "#555";
  return (
    <Box sx={{ borderLeft: `4px solid ${color}`, bgcolor: "#FBF9F3", borderRadius: 1,
      px: 1.5, py: 1, minWidth: 150 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{n.label}</Typography>
      {n.detail && <Typography variant="caption" color="text.secondary">{n.detail}</Typography>}
    </Box>
  );
}

export default function RelationshipGraph({ graph }: { graph: BatchGraph }) {
  const stagesWithNodes = graph.stages
    .map((st) => ({ stage: st, nodes: graph.nodes.filter((n) => n.stage === st) }))
    .filter((s) => s.nodes.length > 0);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Every actor and record connected to <b>{graph.batch_code}</b> — from concession and
        miner through assay, ownership, custody and export.
      </Typography>
      <Stack spacing={0}>
        {stagesWithNodes.map((s, i) => (
          <Box key={s.stage}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Chip size="small" label={STAGE_LABEL[s.stage] ?? s.stage}
                sx={{ minWidth: 96, fontWeight: 600, bgcolor: "#0C1813", color: "#E4B84C" }} />
              {s.nodes.map((n) => <NodeCard key={n.id} n={n} />)}
            </Stack>
            {i < stagesWithNodes.length - 1 && (
              <Box sx={{ ml: 6, my: 0.5, height: 18, borderLeft: "2px dashed #C9A227" }} />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
