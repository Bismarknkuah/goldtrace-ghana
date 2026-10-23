# GOLDTRACE GHANA — Complete Installation Guide

Everything you need to install and run the platform locally. Three parts share
one folder: **backend** (Django API), **frontend** (React web app), **mobile**
(Expo app). The database is MongoDB Atlas (cloud) — nothing to install locally.

---

## 0. Prerequisites (install once)
| Tool | Version | Check | Get it |
|---|---|---|---|
| Python | 3.12+ | `python --version` | python.org |
| Node.js | 20+ | `node --version` | nodejs.org |
| Git | any | `git --version` | git-scm.com |
| VS Code | latest | — | code.visualstudio.com |

A free **MongoDB Atlas** account: https://www.mongodb.com/atlas

---

## 1. Get the code
Unzip `goldtrace-ghana.zip`, then open the `goldtrace-ghana` folder in VS Code
(**File → Open Folder**). You should see `backend/`, `frontend/`, `mobile/`.

---

## 2. Set up MongoDB Atlas (5 min)
1. Create a **free cluster** (M0).
2. **Database Access** → Add a database user (username + password). Save them.
3. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`) for dev.
4. **Connect → Drivers** → copy the connection string, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

> The bundled `backend/.env` already contains a connection string. Replace it with
> yours (and **rotate the password** if it was ever shared).

---

## 3. Backend (Django API)
```bash
cd backend

# create + activate a virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```
Edit `backend/.env` and set at least:
```env
DJANGO_SECRET_KEY=<any long random string>
MONGODB_URI=<your Atlas connection string>
MONGODB_NAME=goldtrace
CORS_ALLOWED_ORIGINS=http://localhost:5173
CELERY_TASK_ALWAYS_EAGER=True
```
Generate a secret key: `python -c "import secrets; print(secrets.token_urlsafe(50))"`

Create the database schema and demo data (connects to Atlas):
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py seed_demo
python manage.py runserver          # http://localhost:8000
```
Confirm: open **http://localhost:8000/api/docs/** (interactive API).

---

## 4. Frontend (React web app) — new terminal
```bash
cd frontend
npm install
# .env is included: VITE_API_URL=http://localhost:8000/api/v1
npm run dev                          # http://localhost:5173
```
Open **http://localhost:5173** and tap any role chip to sign in.
All demo accounts use password **`Goldtrace2026!`**.

---

## 5. Mobile app (optional) — new terminal
```bash
cd mobile
npm install
npx expo start                       # scan the QR with the Expo Go app
```
On a phone, edit `mobile/.env` and set `EXPO_PUBLIC_API_URL` to your computer's
LAN IP (e.g. `http://192.168.1.20:8000/api/v1`) — a phone can't reach `localhost`.
Then run the backend with `python manage.py runserver 0.0.0.0:8000` and add that
IP to `DJANGO_ALLOWED_HOSTS` in `backend/.env`.

---

## 6. Prefer buttons over commands? (VS Code)
With the folder open in VS Code: **Terminal → Run Task…**
- **Backend: Setup (venv + install + migrate + seed)**
- **Frontend: Install**
- **▶ Run All (backend + frontend)**

Debug the API with breakpoints: **Run and Debug** panel → **Django: runserver (debug)**.
Full details in `VSCODE.md`.

---

## 7. Verify it works (no database needed)
```bash
cd backend && python scripts/verify_core.py   # QR, hashing, custody chain, GIS,
                                              # logistics pricing, risk engine, royalties
cd frontend && npm run build                  # type-check + production build
cd mobile && npx tsc --noEmit                 # mobile type-check
```

---

## 8. Demo accounts (created by `seed_demo`)
Password for all: **`Goldtrace2026!`**
`super.admin` · `goldbod.ceo` · `goldbod.officer` · `kofi.miner` ·
`buying.agent` · `assayer` · `refinery.op` · `ama.exporter` · `customs.officer` ·
`security.agency` · `bog.officer` · `ministry.official` · `env.officer` ·
`intl.buyer` · `rider.one` · `driver.one`

Try: sign in as **goldbod.ceo** for Risk intelligence + Revenue; **kofi.miner**
to dispatch secure transport; **rider.one** for Carrier operations.

---

## 9. Host it online
See **DEPLOY.md** — GitHub + Vercel (frontend) + Railway (backend) + Atlas.

## Troubleshooting
- **`migrate` hangs** → Atlas Network Access must allow your IP (or `0.0.0.0/0`);
  check the password in `MONGODB_URI` is URL-encoded.
- **CORS error in browser** → `CORS_ALLOWED_ORIGINS` must be exactly `http://localhost:5173`.
- **Login fails** → run `seed_demo`; confirm the backend is on port 8000.
- **`python` not found** → use `python3`; Django 6 needs Python 3.12+.
