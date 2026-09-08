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
import type { ReactNode } from "react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { logout, setUser } from "../features/authSlice";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import { useState } from "react";
import { IconButton, useMediaQuery } from "@mui/material";
import { useMeQuery, useMyFeaturesQuery } from "../services/api";

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
  sites: { to: "/sites", label: "Mining sites (satellite)", icon: <PublicIcon /> },
  settings: { to: "/settings", label: "System settings", icon: <GroupIcon /> },
  reports: { to: "/reports", label: "Public reports", icon: <PublicIcon /> },
};

// Logical groups so the sidebar reads as sections, not one long list.
const SECTIONS: { title: string; keys: string[] }[] = [
  { title: "", keys: ["overview"] },
  { title: "Supply chain", keys: ["miners", "companies", "batches", "track", "transfers", "deliveries", "courier"] },
  { title: "Trading", keys: ["marketplace", "requests", "receipts", "certificates"] },
  { title: "Compliance & risk", keys: ["intelligence", "security", "compliance", "licensing", "verify"] },
  { title: "Oversight", keys: ["map", "sites", "reports", "revenue", "transparency", "users", "settings"] },
  { title: "Account", keys: ["profile"] },
];

// Each role sees only the tools relevant to its mandate.
const ROLE_NAV: Record<string, string[]> = {
  super_admin: Object.keys(NAV),
  ceo: Object.keys(NAV),
  goldbod_officer: ["reports", "overview", "miners", "companies", "batches", "track", "transfers", "deliveries",
    "marketplace", "requests", "receipts", "certificates", "intelligence", "security", "compliance",
    "licensing", "verify", "map", "sites", "users"],
  bog_officer: ["overview", "revenue", "receipts", "certificates", "compliance", "track", "verify"],
  ministry_official: ["overview", "revenue", "intelligence", "licensing", "compliance", "certificates",
    "map", "sites", "track"],
  customs_officer: ["reports", "overview", "verify", "certificates", "deliveries", "track", "security",
    "compliance", "licensing", "map", "sites"],
  security_agency: ["reports", "overview", "security", "intelligence", "batches", "track", "verify",
    "deliveries", "map", "sites"],
  independent_auditor: ["overview", "miners", "companies", "batches", "track", "transfers",
    "deliveries", "receipts", "certificates", "intelligence", "security", "compliance",
    "licensing", "verify", "map", "sites", "revenue"],
  miner: ["overview", "batches", "track", "transfers", "deliveries", "marketplace", "requests",
    "receipts", "licensing", "verify"],
  mining_company: ["overview", "companies", "miners", "batches", "track", "transfers", "deliveries",
    "marketplace", "requests", "receipts", "licensing", "map"],
  buying_agent: ["overview", "batches", "track", "transfers", "deliveries", "marketplace",
    "requests", "receipts", "licensing", "verify"],
  tier1_buyer: ["overview", "batches", "track", "transfers", "deliveries", "marketplace",
    "requests", "receipts", "licensing", "verify"],
  tier2_buyer: ["overview", "batches", "track", "transfers", "deliveries", "marketplace",
    "requests", "receipts", "licensing", "verify"],
  aggregator: ["overview", "batches", "track", "transfers", "deliveries", "marketplace",
    "requests", "receipts", "licensing", "verify"],
  assayer: ["overview", "batches", "track", "transfers", "verify"],
  refinery_operator: ["overview", "batches", "track", "transfers", "deliveries", "marketplace",
    "requests", "verify"],
  exporter: ["overview", "batches", "track", "transfers", "deliveries", "marketplace", "requests",
    "receipts", "certificates", "licensing", "verify"],
  international_buyer: ["overview", "marketplace", "requests", "certificates", "verify", "track"],
  env_officer: ["reports", "overview", "sites", "map", "miners", "companies", "licensing", "track"],
  rider: ["overview", "courier", "deliveries", "track"],
  driver: ["overview", "courier", "deliveries", "track"],
};
const DEFAULT_NAV = ["overview", "track", "verify"];

export default function Layout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { data: me } = useMeQuery();
  useEffect(() => { if (me) dispatch(setUser(me)); }, [me, dispatch]);

  const baseKeys = (user && ROLE_NAV[user.role]) || DEFAULT_NAV;
  const withExtras = [...baseKeys];
  if (!withExtras.includes("transparency")) withExtras.push("transparency");
  if (!withExtras.includes("profile")) withExtras.push("profile");
  const { data: feat } = useMyFeaturesQuery(undefined, { skip: !user });
  const configured = feat?.features && feat.features.length > 0 ? feat.features : null;
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width:900px)");
  const [mobileOpen, setMobileOpen] = useState(false);
  const keys = configured
    ? [...configured.filter((k) => k in NAV), ...(configured.includes("profile") ? [] : ["profile"])]
    : withExtras;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant={isMobile ? "temporary" : "permanent"} open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }}
        sx={{ width: isMobile ? 0 : W, flexShrink: 0,
        "& .MuiDrawer-paper": { width: W, bgcolor: "#0C1813", color: "#F6F2E9", border: 0 } }}>
        <Toolbar sx={{ px: 2.5 }}>
          <Stack>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 20,
              color: "#E4B84C", lineHeight: 1 }}>GOLDTRACE</Typography>
            <Typography sx={{ fontSize: 10, letterSpacing: 3, color: "#9DB0A2" }}>GHANA · GOLDBOD</Typography>
          </Stack>
        </Toolbar>
        <List sx={{ px: 1.5, mt: 1, overflowY: "auto" }}>
          {SECTIONS.map((section) => {
            const secItems = section.keys.filter((k) => keys.includes(k)).map((k) => NAV[k]).filter(Boolean);
            if (secItems.length === 0) return null;
            return (
              <Box key={section.title || "top"} sx={{ mb: 0.5 }}>
                {section.title && (
                  <Typography sx={{ px: 1.5, mt: 1.5, mb: 0.5, fontSize: 10, letterSpacing: 1.5,
                    color: "#6E7F73", fontWeight: 700, textTransform: "uppercase" }}>
                    {section.title}
                  </Typography>
                )}
                {secItems.map((n) => (
                  <ListItemButton key={n.to} component={NavLink} to={n.to} end={n.to === "/"} onClick={() => setMobileOpen(false)}
                    sx={{ borderRadius: 2, mb: 0.5, color: "#C9D4CB",
                      "&.active": { bgcolor: "rgba(201,162,39,0.16)", color: "#E4B84C" },
                      "&.active .MuiListItemIcon-root": { color: "#E4B84C" },
                      "& .MuiListItemIcon-root": { color: "#7E8F84", minWidth: 38 } }}>
                    <ListItemIcon>{n.icon}</ListItemIcon>
                    <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} primary={n.label} />
                  </ListItemButton>
                ))}
              </Box>
            );
          })}
          <ListItemButton onClick={() => { dispatch(logout()); navigate("/login"); }}
            sx={{ borderRadius: 2, mt: 0.5, color: "#E8A59A", "& .MuiListItemIcon-root": { color: "#E8A59A", minWidth: 38 } }}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} primary="Sign out" />
          </ListItemButton>
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        <AppBar position="sticky" elevation={0}
          sx={{ bgcolor: "#FFFFFF", color: "text.primary", borderBottom: "1px solid #E6E0D2" }}>
          <Toolbar sx={{ justifyContent: "space-between", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {isMobile && (
                <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu"><MenuIcon /></IconButton>
              )}
              {isMobile && <Typography sx={{ fontFamily: "Fraunces, serif", fontWeight: 600 }}>GOLDTRACE</Typography>}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Stack alignItems="flex-end" sx={{ lineHeight: 1 }}>
              <Typography fontSize={14} fontWeight={600}>{user?.username ?? "—"}</Typography>
              <Typography fontSize={11} color="text.secondary">{user?.role_display ?? ""}</Typography>
            </Stack>
            <Avatar sx={{ bgcolor: "#10261C", width: 34, height: 34, fontSize: 14 }}>
              {(user?.username ?? "?").slice(0, 1).toUpperCase()}
            </Avatar>
            </Box>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ p: 4, maxWidth: 1200, width: "100%", mx: "auto" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
