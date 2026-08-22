import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { colors } from "../theme";
import type { GoldBatch } from "../types";
import type { BatchesStackParams } from "../navTypes";

type Props = NativeStackScreenProps<BatchesStackParams, "BatchDetail">;

export default function BatchDetailScreen({ route }: Props) {
  const [batch, setBatch] = useState<GoldBatch | null>(null);

  useEffect(() => {
    api.get<GoldBatch>(`/production/batches/${route.params.id}/`).then((r) => setBatch(r.data));
  }, [route.params.id]);

  if (!batch) return <View style={styles.center}><ActivityIndicator color={colors.moss} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.code}>{batch.batch_code}</Text>
      <Text style={styles.meta}>{batch.gross_weight_g} g gross · {batch.status_display}</Text>
      {batch.fineness ? <Text style={styles.assay}>Fineness {batch.fineness}</Text> : null}
      <Text style={styles.hash}>passport {batch.passport_hash}</Text>

      <Text style={styles.section}>Chain of custody</Text>
      {batch.custody_events.map((e) => (
        <View key={e.id} style={styles.event}>
          <Text style={styles.eventType}>{e.event_type_display || e.event_type}</Text>
          <Text style={styles.eventMeta}>
            {e.from_party ? `${e.from_party} → ` : ""}{e.to_party || "—"}
          </Text>
          <Text style={styles.hash}>hash {e.event_hash.slice(0, 18)}…</Text>
          {e.anchored_tx ? <Text style={styles.anchored}>anchored · {e.anchored_tx.slice(0, 16)}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  root: { padding: 20 },
  code: { fontSize: 22, fontWeight: "700", color: colors.ink },
  meta: { color: colors.textMuted, marginTop: 4 },
  assay: { color: colors.gold, fontWeight: "700", marginTop: 8, fontSize: 16 },
  hash: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 24, marginBottom: 8 },
  event: { backgroundColor: colors.paper, borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border },
  eventType: { fontWeight: "600", color: colors.ink },
  eventMeta: { color: colors.textMuted, marginTop: 2 },
  anchored: { color: colors.success, fontSize: 11, marginTop: 4 },
});
