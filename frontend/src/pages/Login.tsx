import { useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, Chip, Collapse, Divider, Link, Stack,
  TextField, Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { api, useLoginMutation } from "../services/api";
import { useAppDispatch } from "../app/hooks";
import { setTokens, setUser } from "../features/authSlice";

const DEMO_PASSWORD = "Goldtrace2026!";
const CEO_IMAGES = ["/ceo/ceo1.jpeg", "/ceo/ceo2.jpeg", "/ceo/ceo3.jpeg", "/ceo/ceo4.jpeg"];

const DEMO_ACCOUNTS: [label: string, username: string][] = [
  ["Super Admin", "super.admin"],
  ["GoldBod CEO", "goldbod.ceo"],
  ["GoldBod Officer", "goldbod.officer"],
  ["Licensed Miner", "kofi.miner"],
  ["Buying Agent", "buying.agent"],
  ["Tier 1 Buyer", "tier1.buyer"],
  ["Tier 2 Buyer", "tier2.buyer"],
  ["Aggregator", "aggregator"],
  ["Assayer", "assayer"],
  ["Refinery Operator", "refinery.op"],
  ["Exporter", "ama.exporter"],
  ["Customs Officer", "customs.officer"],
  ["Security Agency", "security.agency"],
  ["Bank of Ghana", "bog.officer"],
  ["Ministry Official", "ministry.official"],
  ["EPA Officer", "env.officer"],
  ["International Buyer", "intl.buyer"],
  ["Mining Company", "mining.company"],
  ["Delivery Rider", "rider.one"],
  ["Delivery Driver", "driver.one"],
];

export default function Login() {
  const [username, setUsername] = useState("kofi.miner");
  const [password, setPassword] = useState("");
  const [login, { isLoading }] = useLoginMutation();
  const [error, setError] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [hero, setHero] = useState(0);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setHero((h) => (h + 1) % CEO_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, []);

  const submit = async (u = username, p = password) => {
    setError("");
    try {
      const tokens = await login({ username: u, password: p }).unwrap();
      dispatch(setTokens(tokens));
      const me = await dispatch(
        api.endpoints.me.initiate(undefined, { forceRefetch: true })
      ).unwrap();
      dispatch(setUser(me));
      navigate("/");
    } catch {
      setError("Those credentials didn't match. Please check your username and password.");
    }
  };

  const quick = (u: string) => {
    setUsername(u);
    setPassword(DEMO_PASSWORD);
    submit(u, DEMO_PASSWORD);
  };

  return (
    <Box className="grid md:grid-cols-2" sx={{ minHeight: "100vh" }}>
      <Box sx={{ position: "relative", overflow: "hidden", bgcolor: "#0C1813",
        display: { xs: "none", md: "block" } }}>
        {CEO_IMAGES.map((src, i) => (
          <Box key={src} component="img" src={src} alt=""
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "top center",
              opacity: i === hero ? 1 : 0, transition: "opacity 1.4s ease-in-out" }} />
        ))}
        <Box sx={{ position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(12,24,19,0.72) 0%, rgba(12,24,19,0.32) 42%, rgba(12,24,19,0.92) 100%)" }} />
        <Box sx={{ position: "relative", height: "100%", color: "#F6F2E9",
          p: { md: 6, lg: 8 }, display: "flex", flexDirection: "column",
          justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box component="img" src="/goldbod-logo.jpeg" alt="GoldBod"
              sx={{ height: 46, width: 46, borderRadius: "50%", objectFit: "cover",
                border: "1.5px solid rgba(228,184,76,0.6)" }} />
            <Box>
              <Typography sx={{ fontFamily: "Fraunces, serif", color: "#E4B84C",
                fontSize: 22, lineHeight: 1 }}>GOLDTRACE</Typography>
              <Typography sx={{ color: "#9DB0A2", fontSize: 11, letterSpacing: 4 }}>
                GHANA · GOLDBOD
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ maxWidth: 520 }}>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: { md: 38, lg: 46 },
              fontWeight: 600, lineHeight: 1.03, textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>
              Every gram, traceable from pit to port.
            </Typography>
            <Typography sx={{ mt: 2, color: "#E7EDE7", fontSize: 15.5, lineHeight: 1.6,
              maxWidth: 460, textShadow: "0 1px 12px rgba(0,0,0,0.45)" }}>
              The national gold supply-chain intelligence platform of the Ghana Gold Board —
              licensing, assay, custody and export certification on one verifiable record.
            </Typography>
            <Box sx={{ mt: 4, pl: 2, borderLeft: "3px solid #E4B84C" }}>
              <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>
                Sammy Gyamfi, Esq.
              </Typography>
              <Typography sx={{ color: "#C9D6CB", fontSize: 12.5, letterSpacing: 2 }}>
                CHIEF EXECUTIVE OFFICER · GOLDBOD
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {CEO_IMAGES.map((_, i) => (
              <Box key={i} sx={{ height: 4, width: i === hero ? 26 : 10, borderRadius: 2,
                bgcolor: i === hero ? "#E4B84C" : "rgba(246,242,233,0.4)",
                transition: "all 0.4s ease" }} />
            ))}
            <Typography sx={{ ml: 1.5, fontSize: 11.5, color: "#7E8C81" }}>
              Republic of Ghana
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
        p: { xs: 4, md: 5 }, bgcolor: "#FBF9F3" }}>
        <Stack spacing={2.5} sx={{ width: "100%", maxWidth: 400 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ display: { md: "none" } }}>
            <Avatar src="/goldbod-logo.jpeg" sx={{ width: 40, height: 40 }} />
            <Typography sx={{ fontFamily: "Fraunces, serif", color: "#0C1813", fontSize: 20 }}>
              GOLDTRACE <span style={{ color: "#9DB0A2", fontSize: 11, letterSpacing: 3 }}>GHANA</span>
            </Typography>
          </Stack>
          <Box>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600,
              color: "#0C1813" }}>Welcome back</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14.5 }}>
              Sign in to your GoldBod supply-chain account.
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Username" value={username}
            onChange={(e) => setUsername(e.target.value)} fullWidth />
          <TextField label="Password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} fullWidth />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: -1 }}>
            <Link component="button" underline="hover" type="button"
              onClick={() => setError(
                "Password resets are handled by your GoldBod administrator. " +
                "Please contact your Super Admin to reset your password.")}
              sx={{ fontSize: 13, color: "#7A6A2E" }}>
              Forgot password?
            </Link>
          </Stack>
          <Button variant="contained" size="large" onClick={() => submit()}
            disabled={isLoading}
            sx={{ bgcolor: "#0C1813", py: 1.35, "&:hover": { bgcolor: "#16281f" } }}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
          <Divider sx={{ pt: 0.5 }}>
            <Link component="button" underline="none" type="button"
              onClick={() => setShowDemo((s) => !s)}
              sx={{ fontSize: 11.5, letterSpacing: 2, color: "#8A9A8C", fontWeight: 600 }}>
              {showDemo ? "HIDE DEMO ROLES ▲" : "QUICK DEMO · TAP A ROLE ▼"}
            </Link>
          </Divider>
          <Collapse in={showDemo}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {DEMO_ACCOUNTS.map(([label, u]) => (
                <Chip key={u} label={label} onClick={() => quick(u)} clickable size="small"
                  variant="outlined"
                  sx={{ borderColor: "#D8D0BD",
                    "&:hover": { bgcolor: "rgba(201,162,39,0.14)", borderColor: "#C9A227" } }} />
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Demo accounts use password <span className="mono">{DEMO_PASSWORD}</span>
            </Typography>
          </Collapse>
        </Stack>
      </Box>
    </Box>
  );
}
