import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api";
import { colors } from "../theme";
import type { Passport } from "../types";
import type { VerifyStackParams } from "../navTypes";

type Props = NativeStackScreenProps<VerifyStackParams, "VerifyResult">;

export default function VerifyResultScreen({ route }: Props) {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setError(false);
    api.get<Passport>(`/production/batches/verify/?code=${encodeURIComponent(route.params.code)}`)
      .then((r) => setPassport(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [route.params.code]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.moss} /></View>;
  if (error || !passport) return <View style={styles.center}><Text style={styles.err}>No passport found for {route.params.code}.</Text></View>;

  const ok = passport.chain_valid;
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View style={[styles.banner, { backgroundColor: ok ? colors.success : colors.danger }]}>
        <Text style={styles.bannerText}>{ok ? "✓ CHAIN VERIFIED" : "✕ CHAIN TAMPERED"}</Text>
      </View>
      <Text style={styles.code}>{passport.batch_code}</Text>
      <Text style={styles.meta}>Licence {passport.miner_license}</Text>
      <Text style={styles.meta}>{passport.gross_weight_g} g · {passport.status}</Text>
      {passport.fineness ? <Text style={styles.assay}>Fineness {passport.fineness}</Text> : null}

      <Text style={styles.section}>Custody chain</Text>
      {passport.custody_chain.map((e) => (
        <View key={e.id} style={styles.event}>
          <Text style={styles.eventType}>{e.event_type_display || e.event_type}</Text>
          <Text style={styles.hash}>{e.event_hash.slice(0, 20)}…</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  err: { color: colors.danger, textAlign: "center" },
  root: { padding: 20 },
  banner: { borderRadius: 12, padding: 18, alignItems: "center", marginBottom: 18 },
  bannerText: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: 1 },
  code: { fontSize: 22, fontWeight: "700", color: colors.ink },
  meta: { color: colors.textMuted, marginTop: 4 },
  assay: { color: colors.gold, fontWeight: "700", marginTop: 8, fontSize: 16 },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 24, marginBottom: 8 },
  event: { backgroundColor: colors.paper, borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border },
  eventType: { fontWeight: "600", color: colors.ink },
  hash: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
