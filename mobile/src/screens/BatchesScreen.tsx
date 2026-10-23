import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { api } from "../api";
import { colors } from "../theme";
import type { GoldBatch, Paginated } from "../types";
import type { BatchesStackParams } from "../navTypes";

type Props = NativeStackScreenProps<BatchesStackParams, "BatchesList">;

export default function BatchesScreen({ navigation }: Props) {
  const [batches, setBatches] = useState<GoldBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<GoldBatch>>("/production/batches/");
        if (active) setBatches(res.data.results);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []));

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.moss} /></View>;

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={batches}
      keyExtractor={(b) => b.id}
      ListEmptyComponent={<Text style={styles.empty}>No batches yet.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card}
          onPress={() => navigation.navigate("BatchDetail", { id: item.id })}>
          <Text style={styles.code}>{item.batch_code}</Text>
          <Text style={styles.meta}>{item.gross_weight_g} g · {item.status_display}</Text>
          {item.fineness ? <Text style={styles.fineness}>{item.fineness}</Text> : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: 16 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  card: { backgroundColor: colors.paper, borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border },
  code: { fontWeight: "700", fontSize: 16, color: colors.ink, fontVariant: ["tabular-nums"] },
  meta: { color: colors.textMuted, marginTop: 4 },
  fineness: { position: "absolute", right: 16, top: 16, color: colors.gold, fontWeight: "700", fontSize: 18 },
});
