import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth";
import { colors } from "../theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("kofi.miner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setBusy(true);
    try { await signIn(username.trim(), password); }
    catch { setError("Those credentials didn't match."); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>GOLDTRACE</Text>
      <Text style={styles.tag}>GHANA · GOLDBOD</Text>
      <Text style={styles.h1}>Field sign-in</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput style={styles.input} value={username} onChangeText={setUsername}
        autoCapitalize="none" placeholder="Username" placeholderTextColor="#7E8F84" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword}
        secureTextEntry placeholder="Password" placeholderTextColor="#7E8F84" />
      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.btnText}>Sign in</Text>}
      </TouchableOpacity>
      <Text style={styles.hint}>Demo: kofi.miner / Goldtrace2026!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, padding: 28, justifyContent: "center" },
  brand: { color: colors.goldLight, fontSize: 26, fontWeight: "700" },
  tag: { color: "#9DB0A2", fontSize: 11, letterSpacing: 3, marginBottom: 36 },
  h1: { color: colors.parchment, fontSize: 22, fontWeight: "600", marginBottom: 16 },
  input: { backgroundColor: "#13261D", color: colors.parchment, borderRadius: 10,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#223a2c" },
  btn: { backgroundColor: colors.gold, borderRadius: 10, padding: 15, alignItems: "center", marginTop: 6 },
  btnText: { color: colors.ink, fontWeight: "700", fontSize: 16 },
  error: { color: "#F0A89E", marginBottom: 10 },
  hint: { color: "#566057", marginTop: 18, fontSize: 12 },
});
