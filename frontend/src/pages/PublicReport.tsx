import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import VideocamIcon from "@mui/icons-material/Videocam";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import { API_BASE } from "../services/api";

type Att = { name: string; type: string; data: string };

// Public, no-login collection form opened from a CEO-generated share link.
export default function PublicReport() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<{ title: string; categories: { value: string; label: string }[] } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [f, setF] = useState({ category: "illegal_mining", description: "", reporter_name: "",
    reporter_phone: "", region: "", location_text: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [atts, setAtts] = useState<Att[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/reports/public/${token}/`).then(async (r) => {
      if (!r.ok) { setInvalid(true); return; }
      setMeta(await r.json());
    }).catch(() => setInvalid(true));
  }, [token]);

  const locate = () => {
    if (!navigator.geolocation) { setErr("Location is not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setErr("Could not read your location — allow location access or type the place below."),
      { enableHighAccuracy: true, timeout: 12000 });
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 8 * 1024 * 1024) { setErr(`${file.name} is over 8 MB — please pick a smaller file.`); return; }
      const reader = new FileReader();
      reader.onload = () => setAtts((a) => a.length >= 8 ? a : [...a, { name: file.name, type: file.type, data: reader.result as string }]);
      reader.readAsDataURL(file);
    });
  };

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/reports/public/${token}/submit/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null, attachments: atts }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.detail || "Could not submit."); return; }
      setDone(data.reference);
    } catch { setErr("Network error — please try again."); }
    finally { setBusy(false); }
  };

  if (invalid) return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#FBF9F3", display: "grid", placeItems: "center", p: 3 }}>
      <Typography color="error">This reporting link is not valid or has been closed.</Typography>
    </Box>);
  if (!meta) return null;
  if (done) return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#FBF9F3", display: "grid", placeItems: "center", p: 3 }}>
      <Card sx={{ maxWidth: 480 }}><CardContent>
        <Typography variant="h5" sx={{ fontFamily: "Fraunces, serif", mb: 1 }}>Report received</Typography>
        <Typography>Thank you. GoldBod has received your report. Your reference is <b className="mono">{done}</b>.</Typography>
      </CardContent></Card>
    </Box>);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#FBF9F3", p: { xs: 2, sm: 4 } }}>
      <Box sx={{ maxWidth: 560, mx: "auto" }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Box component="img" src="/goldbod-logo.jpeg" alt="GoldBod" sx={{ width: 44, height: 44, borderRadius: "50%" }} />
          <Box>
            <Typography sx={{ fontFamily: "Fraunces, serif", fontSize: 22, color: "#0C1813", lineHeight: 1 }}>{meta.title}</Typography>
            <Typography variant="caption" color="text.secondary">Ghana Gold Board · GOLDTRACE</Typography>
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tell us what you saw. You can attach photos, videos or files from your phone. Your identity is optional.
        </Typography>
        <Card><CardContent>
          <Stack spacing={2}>
            <TextField select label="What are you reporting?" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {meta.categories.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </TextField>
            <TextField label="Describe what is happening" multiline minRows={4} value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })} />
            <Button variant="outlined" startIcon={<MyLocationIcon />} onClick={locate}>
              {coords ? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Use my current location"}
            </Button>
            <TextField label="Region" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />
            <TextField label="Place / nearest town or landmark" value={f.location_text} onChange={(e) => setF({ ...f, location_text: e.target.value })} />
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <input hidden ref={photoRef} type="file" accept="image/*" capture="environment" multiple onChange={(e) => addFiles(e.target.files)} />
              <input hidden ref={videoRef} type="file" accept="video/*" capture="environment" onChange={(e) => addFiles(e.target.files)} />
              <input hidden ref={fileRef} type="file" multiple onChange={(e) => addFiles(e.target.files)} />
              <Button size="small" variant="outlined" startIcon={<PhotoCameraIcon />} onClick={() => photoRef.current?.click()}>Photo</Button>
              <Button size="small" variant="outlined" startIcon={<VideocamIcon />} onClick={() => videoRef.current?.click()}>Video</Button>
              <Button size="small" variant="outlined" startIcon={<AttachFileIcon />} onClick={() => fileRef.current?.click()}>File</Button>
            </Stack>
            {atts.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {atts.map((a, i) => <Chip key={i} label={a.name} onDelete={() => setAtts(atts.filter((_, j) => j !== i))} />)}
              </Stack>
            )}
            <TextField label="Your name (optional)" value={f.reporter_name} onChange={(e) => setF({ ...f, reporter_name: e.target.value })} />
            <TextField label="Your phone (optional)" value={f.reporter_phone} onChange={(e) => setF({ ...f, reporter_phone: e.target.value })} />
            {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}
            <Button variant="contained" size="large" onClick={submit} disabled={busy || !f.description}
              sx={{ bgcolor: "#0C1813", py: 1.4, "&:hover": { bgcolor: "#16281f" } }}>
              {busy ? "Sending…" : "Send report to GoldBod"}
            </Button>
          </Stack>
        </CardContent></Card>
      </Box>
    </Box>
  );
}
