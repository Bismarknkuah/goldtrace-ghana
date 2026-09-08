import { useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import * as Location from "expo-location";
import { api } from "../api";
import { colors } from "../theme";
import type { GoldBatch } from "../types";

// Field capture for miners / buying agents at the source or buying centre:
// weigh the lot, record fineness, stamp GPS origin, and register it live.
export default function CaptureScreen() {
  const [gross, setGross] = useState("");
  const [fineness, setFineness] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);

  const captureLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location needed", "Allow location to stamp the gold's origin.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Location error", "Could not read GPS. Try again in the open.");
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!gross) { Alert.alert("Weight required", "Enter the gross weight in grams."); return; }
    setSaving(true);
    try {
      const res = await api.post<GoldBatch>("/production/batches/", {
        gross_weight_g: gross,
        fineness: fineness ? Number(fineness) : null,
        origin_latitude: coords?.lat ?? null,
        origin_longitude: coords?.lng ?? null,
        field_notes: notes,
      });
      setLastCode(res.data.batch_code);
      setGross(""); setFineness(""); setNotes(""); setCoords(null);
      Alert.alert("Registered", `Batch ${res.data.batch_code} created.`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { miner?: string[]; detail?: string } } };
      Alert.alert("Could not register",
        err.response?.data?.detail || err.response?.data?.miner?.[0] ||
        "Check the values and your connection, then try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Register gold at source</Text>
      <Text style={styles.sub}>
        Weigh the lot, record its fineness and stamp where it was received. It enters the
        traceability chain immediately.
      </Text>

      {lastCode && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Last registered: {lastCode}</Text>
        </View>
      )}

      <Text style={styles.label}>Gross weight (grams)</Text>
      <TextInput style={styles.input} value={gross} onChangeText={setGross}
        keyboardType="decimal-pad" placeholder="e.g. 124.5" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Fineness (per 1000)</Text>
      <TextInput style={styles.input} value={fineness} onChangeText={setFineness}
        keyboardType="number-pad" placeholder="e.g. 916" placeholderTextColor={colors.textMuted} />

      <Text style={styles.label}>Field notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes}
        multiline placeholder="Seller, site, container seal…" placeholderTextColor={colors.textMuted} />

      <TouchableOpacity style={styles.gps} onPress={captureLocation} disabled={locating}>
        {locating ? <ActivityIndicator color={colors.moss} />
          : <Text style={styles.gpsText}>
              {coords ? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Capture GPS origin"}
            </Text>}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.submit, saving && { opacity: 0.6 }]}
        onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.parchment} />
          : <Text style={styles.submitText}>Register batch</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, backgroundColor: colors.parchment, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  sub: { color: colors.textMuted, marginTop: 6, marginBottom: 18, lineHeight: 20 },
  banner: { backgroundColor: "#E7F1EA", borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: colors.success },
  bannerText: { color: colors.success, fontWeight: "600" },
  label: { color: colors.ink, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: colors.paper, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  multiline: { height: 80, textAlignVertical: "top" },
  gps: { marginTop: 18, backgroundColor: colors.paper, borderRadius: 10, borderWidth: 1,
    borderColor: colors.gold, padding: 14, alignItems: "center" },
  gpsText: { color: colors.ink, fontWeight: "600" },
  submit: { marginTop: 22, backgroundColor: colors.ink, borderRadius: 12, padding: 16, alignItems: "center" },
  submitText: { color: colors.parchment, fontWeight: "700", fontSize: 16 },
});
