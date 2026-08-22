import { useRef, useState } from "react";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, Stack, TextField,
  Typography } from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import { useUpdateProfileMutation, useChangePasswordMutation } from "../services/api";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../features/authSlice";

export default function Profile() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [save, { isLoading }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: pwLoading }] = useChangePasswordMutation();
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: user?.first_name ?? "", last_name: user?.last_name ?? "",
    email: user?.email ?? "", phone: user?.phone ?? "", organization: user?.organization ?? "",
  });
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      setMsg({ type: "error", text: "Please choose an image under 1.5 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setMsg(null);
    try {
      const updated = await save({ ...form, avatar }).unwrap();
      dispatch(setUser(updated));
      setMsg({ type: "success", text: "Profile updated." });
    } catch {
      setMsg({ type: "error", text: "Could not save your profile. Please try again." });
    }
  };

  const submitPw = async () => {
    setPwMsg(null);
    try {
      const r = await changePassword(pw).unwrap();
      setPwMsg({ type: "success", text: r.detail });
      setPw({ old_password: "", new_password: "" });
    } catch (e: unknown) {
      const d = (e as { data?: { old_password?: string; new_password?: string[] } })?.data;
      setPwMsg({ type: "error", text: d?.old_password || d?.new_password?.[0] ||
        "Could not change password. New password must be at least 10 characters." });
    }
  };

  if (!user) return null;

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Box>
        <Typography variant="h4">My profile</Typography>
        <Typography color="text.secondary">Update your details and display picture.</Typography>
      </Box>

      <Card><CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
          <Avatar src={avatar || undefined}
            sx={{ width: 96, height: 96, fontSize: 32, bgcolor: "#0C1813" }}>
            {user.first_name?.[0] ?? user.username[0]}
          </Avatar>
          <Box>
            <input hidden ref={fileRef} type="file" accept="image/*" onChange={onFile} />
            <Button variant="outlined" startIcon={<PhotoCameraIcon />}
              onClick={() => fileRef.current?.click()}>Upload photo</Button>
            {avatar && (
              <Button color="inherit" sx={{ ml: 1 }} onClick={() => setAvatar("")}>Remove</Button>
            )}
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
              Square images work best · under 1.5 MB
            </Typography>
          </Box>
        </Stack>
      </CardContent></Card>

      <Card><CardContent>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography className="mono">{user.username}</Typography>
            <Chip size="small" label={user.role_display} />
            {user.is_verified && <Chip size="small" color="success" label="Verified" />}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="First name" value={form.first_name} onChange={set("first_name")} fullWidth />
            <TextField label="Last name" value={form.last_name} onChange={set("last_name")} fullWidth />
          </Stack>
          <TextField label="Email" value={form.email} onChange={set("email")} fullWidth />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Phone" value={form.phone} onChange={set("phone")} fullWidth />
            <TextField label="Organization" value={form.organization} onChange={set("organization")} fullWidth />
          </Stack>
          {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
          <Box>
            <Button variant="contained" onClick={submit} disabled={isLoading}
              sx={{ bgcolor: "#0C1813", "&:hover": { bgcolor: "#16281f" } }}>
              {isLoading ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        </Stack>
      </CardContent></Card>

      <Card><CardContent>
        <Typography variant="h6" gutterBottom>Change password</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          If an administrator gave you a temporary password, set your own here.
        </Typography>
        <Stack spacing={2.5} sx={{ maxWidth: 420 }}>
          <TextField label="Current password" type="password" value={pw.old_password}
            onChange={(e) => setPw({ ...pw, old_password: e.target.value })} fullWidth />
          <TextField label="New password" type="password" value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })} fullWidth />
          {pwMsg && <Alert severity={pwMsg.type}>{pwMsg.text}</Alert>}
          <Box>
            <Button variant="outlined" onClick={submitPw}
              disabled={pwLoading || !pw.old_password || !pw.new_password}>
              {pwLoading ? "Updating…" : "Update password"}
            </Button>
          </Box>
        </Stack>
      </CardContent></Card>
    </Stack>
  );
}
