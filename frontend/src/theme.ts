import { createTheme } from "@mui/material/styles";

// Minting / assay palette: authoritative green-black + a single restrained gold.
const ink = "#0C1813";
const moss = "#10261C";
const gold = "#C9A227";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: moss, contrastText: "#F6F2E9" },
    secondary: { main: gold, contrastText: ink },
    success: { main: "#2E7D52" },
    error: { main: "#B23A2E" },
    background: { default: "#F6F2E9", paper: "#FFFFFF" },
    text: { primary: "#15211B", secondary: "#566057" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    h1: { fontFamily: "Fraunces, serif", fontWeight: 600, letterSpacing: "-0.02em" },
    h2: { fontFamily: "Fraunces, serif", fontWeight: 600, letterSpacing: "-0.01em" },
    h3: { fontFamily: "Fraunces, serif", fontWeight: 600 },
    h4: { fontFamily: "Fraunces, serif", fontWeight: 600 },
    h5: { fontFamily: "Fraunces, serif", fontWeight: 600 },
    h6: { fontFamily: "Fraunces, serif", fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid #E6E0D2", boxShadow: "0 1px 2px rgba(12,24,19,0.04)" },
      },
    },
  },
});
