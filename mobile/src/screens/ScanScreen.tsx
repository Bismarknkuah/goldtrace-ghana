import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../theme";
import type { VerifyStackParams } from "../navTypes";

type Props = NativeStackScreenProps<VerifyStackParams, "Scan">;

function extractCode(data: string): string {
  const trimmed = data.trim();
  return trimmed.includes("/b/") ? trimmed.split("/b/")[1] : trimmed;
}

export default function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manual, setManual] = useState("");

  const go = (code: string) => {
    if (!code) return;
    navigation.navigate("VerifyResult", { code });
  };

  if (!permission) return <View style={styles.center} />;

  return (
    <View style={styles.root}>
      {permission.granted ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => {
            setScanned(true);
            go(extractCode(data));
            setTimeout(() => setScanned(false), 1500);
          }}
        >
          <View style={styles.reticle} />
          <Text style={styles.hintOnCam}>Point at a gold passport QR</Text>
        </CameraView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.permText}>Camera access is needed to scan passports.</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant camera access</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.manual}>
        <Text style={styles.manualLabel}>Or enter a batch code</Text>
        <View style={styles.manualRow}>
          <TextInput style={styles.input} value={manual} onChangeText={(t) => setManual(t.toUpperCase())}
            placeholder="GH-XXXXXXXXXX" placeholderTextColor="#7E8F84" autoCapitalize="characters" />
          <TouchableOpacity style={styles.btnSmall} onPress={() => go(manual.trim())}>
            <Text style={styles.btnText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  camera: { flex: 1, justifyContent: "center", alignItems: "center" },
  reticle: { width: 220, height: 220, borderWidth: 3, borderColor: colors.goldLight, borderRadius: 18 },
  hintOnCam: { color: colors.parchment, marginTop: 16 },
  permText: { color: colors.parchment, textAlign: "center", marginBottom: 16 },
  manual: { padding: 16, backgroundColor: colors.moss },
  manualLabel: { color: "#9DB0A2", marginBottom: 8, fontSize: 12 },
  manualRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: "#13261D", color: colors.parchment, borderRadius: 10,
    paddingHorizontal: 12, borderWidth: 1, borderColor: "#223a2c" },
  btn: { backgroundColor: colors.gold, borderRadius: 10, padding: 14, alignItems: "center" },
  btnSmall: { backgroundColor: colors.gold, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  btnText: { color: colors.ink, fontWeight: "700" },
});
