import { AppBar, Avatar, Box, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Stack, Toolbar, Typography } from "@mui/material";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import GroupsIcon from "@mui/icons-material/Groups";
import BusinessIcon from "@mui/icons-material/Apartment";
import InventoryIcon from "@mui/icons-material/Inventory2";
import TrackIcon from "@mui/icons-material/TravelExplore";
import SwapIcon from "@mui/icons-material/SwapHoriz";
import CertIcon from "@mui/icons-material/WorkspacePremium";
import ShippingIcon from "@mui/icons-material/LocalShipping";
import ReceiptIcon from "@mui/icons-material/ReceiptLong";
import MapIcon from "@mui/icons-material/Public";
import ShieldIcon from "@mui/icons-material/GppMaybe";
import SecurityIcon from "@mui/icons-material/Security";
import RevenueIcon from "@mui/icons-material/AccountBalance";
import CourierIcon from "@mui/icons-material/TwoWheeler";
import QrIcon from "@mui/icons-material/QrCodeScanner";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import PublicIcon from "@mui/icons-material/Public";
import GroupIcon from "@mui/icons-material/Group";
import LicenseIcon from "@mui/icons-material/VerifiedUser";
import ComplianceIcon from "@mui/icons-material/FactCheck";
import LogoutIcon from "@mui/icons-material/Logout";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { logout, setUser } from "../features/authSlice";
import { useMeQuery } from "../services/api";

const W = 252;

type Item = { to: string; label: string; icon: ReactNode };
const NAV: Record<string, Item> = {
  overview: { to: "/", label: "Overview", icon: <DashboardIcon /> },
  track: { to: "/track", label: "Track gold", icon: <TrackIcon /> },
  miners: { to: "/miners", label: "Miners", icon: <GroupsIcon /> },
  companies: { to: "/companies", label: "Mining companies", icon: <BusinessIcon /> },
  batches: { to: "/batches", label: "Gold batches", icon: <InventoryIcon /> },
  transfers: { to: "/transfers", label: "Transfers", icon: <SwapIcon /> },
  certificates: { to: "/certificates", label: "Export certificates", icon: <CertIcon /> },
  deliveries: { to: "/deliveries", label: "Secure transport", icon: <ShippingIcon /> },
  receipts: { to: "/receipts", label: "Payment receipts", icon: <ReceiptIcon /> },
  map: { to: "/map", label: "Geospatial map", icon: <MapIcon /> },
  intelligence: { to: "/intelligence", label: "Risk intelligence", icon: <ShieldIcon /> },
  security: { to: "/security", label: "Security & theft", icon: <SecurityIcon /> },
  revenue: { to: "/revenue", label: "Revenue & royalties", icon: <RevenueIcon /> },
  courier: { to: "/courier", label: "Carrier operations", icon: <CourierIcon /> },
  licensing: { to: "/licensing", label: "Licensing", icon: <LicenseIcon /> },
  compliance: { to: "/compliance", label: "Compliance & KYC", icon: <ComplianceIcon /> },
  verify: { to: "/verify", label: "Verify passport", icon: <QrIcon /> },
  marketplace: { to: "/marketplace", label: "Marketplace", icon: <StorefrontIcon /> },
  requests: { to: "/requests", label: "Purchase requests", icon: <StorefrontIcon /> },
  users: { to: "/users", label: "User management", icon: <GroupIcon /> },
  profile: { to: "/profile", label: "My profile", icon: <PersonIcon /> },
  transparency: { to: "/transparency", label: "Transparency", icon: <PublicIcon /> },
};

// Each role sees only the tools relevant to its mandate.
const ROLE_NAV: Record<string, string[]> = {
  super_admin: Object.keys(NAV),
  ceo: ["overview", "track", "intelligence", "security", "revenue", "licensing", "compliance", "miners", "companies", "batches", "certificates", "map", "verify"],
  goldbod_officer: ["overview", "marketplace", "requests", "track", "intelligence", "security", "licensing", "compliance", "miners", "companies", "batches", "certificates", "transfers", "deliveries", "map", "verify"],
  bog_officer: ["overview", "revenue", "compliance", "receipts", "track", "verify"],
  ministry_official: ["overview", "revenue", "intelligence", "map", "track"],
  customs_officer: ["overview", "verify", "certificates", "compliance", "licensing", "track", "deliveries"],
  security_agency: ["overview", "security", "intelligence", "track", "map", "deliveries"],
  miner: ["overview", "marketplace", "requests", "batches", "transfers", "deliveries", "receipts", "track", "licensing", "verify"],
  mining_company: ["overview", "marketplace", "requests", "companies", "miners", "batches", "map", "track", "licensing", "revenue"],
  buying_agent: ["overview", "marketplace", "requests", "batches", "transfers", "receipts", "track", "licensing", "verify"],
  tier1_buyer: ["overview", "marketplace", "requests", "batches", "transfers", "deliveries", "receipts", "track", "licensing", "verify"],
  tier2_buyer: ["overview", "marketplace", "requests", "batches", "transfers", "deliveries", "receipts", "track", "licensing", "verify"],
  aggregator: ["overview", "marketplace", "requests", "batches", "transfers", "deliveries", "receipts", "track", "licensing", "verify"],
  assayer: ["overview", "batches", "track", "verify"],
  refinery_operator: ["overview", "marketplace", "requests", "batches", "transfers", "track", "verify"],
  exporter: ["overview", "marketplace", "requests", "batches", "certificates", "deliveries", "transfers", "receipts", "track", "licensing", "compliance", "verify"],
  env_officer: ["overview", "map", "miners", "track"],
  international_buyer: ["overview", "marketplace", "requests", "verify", "certificates", "track"],
  rider: ["overview", "courier", "track"],
  driver: ["overview", "courier", "track"],
};
const DEFAULT_NAV = ["overview", "track", "verify"];

export default function Layout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const { data: me } = useMeQuery();
  useEffect(() => { if (me) dispatch(setUser(me)); }, [me, dispatch]);

  const baseKeys = (user && ROLE_NAV[user.role]) || DEFAULT_NAV;
  const withExtras = [...baseKeys];
  if (!withExtras.includes("transparency")) withExtras.push("transparency");
  if (!withExtras.includes("profile")) withExtras.push("profile");
  const keys = withExtras;
  const items = keys.map((k) => NAV[k]).filter(Boolean);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant="permanent" sx={{ width: W, flexShrink: 0,
        "& .MuiDrawer-paper": { width: W, bgcolor: "#0C1813", color: "#F6F2E9", border: 0 } }}>
        <Toolbar sx={{ px: 2.5 }}>
          <Stack>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 20,
              color: "#E4B84C", lineHeight: 1 }}>GOLDTRACE</Typography>
            <Typography sx={{ fontSize: 10, letterSpacing: 3, color: "#9DB0A2" }}>GHANA · GOLDBOD</Typography>
          </Stack>
        </Toolbar>
        <List sx={{ px: 1.5, mt: 1 }}>
          {items.map((n) => (
            <ListItemButton key={n.to} component={NavLink} to={n.to} end={n.to === "/"}
              sx={{ borderRadius: 2, mb: 0.5, color: "#C9D4CB",
                "&.active": { bgcolor: "rgba(201,162,39,0.16)", color: "#E4B84C" },
                "&.active .MuiListItemIcon-root": { color: "#E4B84C" },
                "& .MuiListItemIcon-root": { color: "#7E8F84", minWidth: 38 } }}>
              <ListItemIcon>{n.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} primary={n.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" elevation={0}
          sx={{ bgcolor: "#FFFFFF", color: "text.primary", borderBottom: "1px solid #E6E0D2" }}>
          <Toolbar sx={{ justifyContent: "flex-end", gap: 1.5 }}>
            <Stack alignItems="flex-end" sx={{ lineHeight: 1 }}>
              <Typography fontSize={14} fontWeight={600}>{user?.username ?? "—"}</Typography>
              <Typography fontSize={11} color="text.secondary">{user?.role_display ?? ""}</Typography>
            </Stack>
            <Avatar sx={{ bgcolor: "#10261C", width: 34, height: 34, fontSize: 14 }}>
              {(user?.username ?? "?").slice(0, 1).toUpperCase()}
            </Avatar>
            <ListItemButton onClick={() => { dispatch(logout()); navigate("/login"); }}
              sx={{ flexGrow: 0, borderRadius: 2, px: 1.2 }}>
              <LogoutIcon fontSize="small" />
            </ListItemButton>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ p: 4, maxWidth: 1200, width: "100%", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
