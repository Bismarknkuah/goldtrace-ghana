import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/auth";
import { colors } from "./src/theme";
import LoginScreen from "./src/screens/LoginScreen";
import BatchesScreen from "./src/screens/BatchesScreen";
import BatchDetailScreen from "./src/screens/BatchDetailScreen";
import ScanScreen from "./src/screens/ScanScreen";
import CaptureScreen from "./src/screens/CaptureScreen";
import VerifyResultScreen from "./src/screens/VerifyResultScreen";
import type { BatchesStackParams, VerifyStackParams } from "./src/navTypes";

const BatchesStack = createNativeStackNavigator<BatchesStackParams>();
const VerifyStack = createNativeStackNavigator<VerifyStackParams>();
const Tabs = createBottomTabNavigator();

function SignOut() {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity onPress={signOut} style={{ paddingHorizontal: 12 }}>
      <Ionicons name="log-out-outline" size={22} color={colors.parchment} />
    </TouchableOpacity>
  );
}

const headerOpts = {
  headerStyle: { backgroundColor: colors.ink },
  headerTintColor: colors.parchment,
  headerRight: () => <SignOut />,
};

function BatchesFlow() {
  return (
    <BatchesStack.Navigator screenOptions={headerOpts}>
      <BatchesStack.Screen name="BatchesList" component={BatchesScreen} options={{ title: "Gold batches" }} />
      <BatchesStack.Screen name="BatchDetail" component={BatchDetailScreen} options={{ title: "Passport" }} />
    </BatchesStack.Navigator>
  );
}

function VerifyFlow() {
  return (
    <VerifyStack.Navigator screenOptions={headerOpts}>
      <VerifyStack.Screen name="Scan" component={ScanScreen} options={{ title: "Scan passport" }} />
      <VerifyStack.Screen name="VerifyResult" component={VerifyResultScreen} options={{ title: "Verification" }} />
    </VerifyStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.moss,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={route.name === "Batches" ? "cube-outline" : route.name === "Capture" ? "add-circle-outline" : "qr-code-outline"}
            size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="Capture" component={CaptureScreen} />
      <Tabs.Screen name="Batches" component={BatchesFlow} />
      <Tabs.Screen name="Verify" component={VerifyFlow} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.ink }}>
        <Text style={{ color: colors.goldLight, fontSize: 22, fontWeight: "700", marginBottom: 12 }}>GOLDTRACE</Text>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  return (
    <NavigationContainer>
      {token ? <MainTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}
