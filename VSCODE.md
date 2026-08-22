# Running GOLDTRACE in VS Code (no terminal commands)

The backend is Django (Python), so install **Python 3.12+** and **Node.js 20+**
once. After that you run everything from VS Code menus.

## First time
1. **File → Open Folder…** → select this `goldtrace-ghana` folder.
2. VS Code will suggest the recommended extensions (bottom-right popup) → **Install**.
   The important one is the Python extension.
3. Your Atlas connection is already set in `backend/.env`. Make sure your current
   IP is allowed in Atlas → Network Access.

## Set everything up (one click)
- **Terminal → Run Task… → "Backend: Setup (venv + install + migrate + seed)"**
  This creates the virtual environment, installs packages, runs the database
  migrations against your Atlas cluster, and loads the demo data.
- **Terminal → Run Task… → "Frontend: Install"**

## Run it
- **Terminal → Run Task… → "▶ Run All (backend + frontend)"**
  starts the API on http://localhost:8000 and the web app on http://localhost:5173.
- Or run them separately with the "Backend: Run server" / "Frontend: Run dev" tasks.

Open http://localhost:5173 and tap any role chip to sign in (password `Goldtrace2026!`).

## Debug the backend (breakpoints)
- Open the **Run and Debug** panel (left sidebar, the ▷ bug icon).
- Pick **"Django: runserver (debug)"** from the dropdown → press the green ▶.
  You can now set breakpoints in any Python file and step through requests.
- **"Django: seed demo data"** re-loads the demo accounts the same way.

## Mobile (optional)
- **Terminal → Run Task… → "Mobile: Start (Expo)"**, then scan the QR with the
  Expo Go app. On a phone, set `mobile/.env` `EXPO_PUBLIC_API_URL` to your
  computer's LAN IP instead of localhost.

## If the interpreter looks wrong
Bottom-right of VS Code shows the Python version. Click it → **Enter interpreter
path** → choose `backend/.venv/bin/python` (Windows: `backend\.venv\Scripts\python.exe`).
