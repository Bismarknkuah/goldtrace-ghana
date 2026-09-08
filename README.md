# GOLDTRACE GHANA

National Gold Supply Chain Intelligence & Traceability System for the Ghana Gold
Board (GoldBod). Tracks every gram of gold from extraction to export with a
tamper-evident custody chain, QR-verifiable passports, geospatial monitoring, and
optional Hyperledger Fabric anchoring.

```
goldtrace-ghana/
├── backend/      Django 6 + DRF + MongoDB Atlas API (24 endpoints)
│   ├── accounts miners production trading exports gis   # domain apps
│   ├── blockchain/   Hyperledger Fabric chaincode + gateway sidecar
│   ├── scripts/verify_core.py   # runs core logic with no DB
│   └── Procfile · railway.json · requirements.txt
├── frontend/     React + TS console (Vite, Redux Toolkit, MUI, Leaflet map)
│   └── vercel.json
├── mobile/       React Native (Expo) app — field batches + QR passport verify
├── docker-compose.yml   backend + worker + redis + frontend
└── package.json         monorepo convenience scripts
```

## What's built
Mine → trade → export → verify, end to end: miner & concession registration →
gold batch with QR passport → ownership transfer → export certificate (gated on a
valid custody chain) → border verification. Plus a GIS map (concession boundaries
+ illegal-mining hotspots, point-in-polygon "illegal origin" checks) and a
permissioned-ledger anchoring layer. All 14 GoldBod roles with JWT + RBAC.

---

## 1. Local development

**Backend** (needs a MongoDB Atlas cluster)
```bash
cd backend
cp .env.example .env          # set MONGODB_URI + a real DJANGO_SECRET_KEY
pip install -r requirements.txt
python manage.py makemigrations accounts miners production trading exports gis core
python manage.py migrate
python manage.py seed_demo     # demo trail + GIS data
python manage.py runserver     # http://localhost:8000  (docs: /api/docs/)
redis-server & celery -A goldtrace worker -l info &   # async anchoring
```

**Frontend**
```bash
cd frontend && npm install
cp .env.example .env           # VITE_API_URL=http://localhost:8000/api/v1
npm run dev                    # http://localhost:5173
```

**Mobile** (Expo)
```bash
cd mobile && npm install
# set EXPO_PUBLIC_API_URL in .env (see below for device/LAN), then:
npx expo start                 # scan the QR with Expo Go, or run an emulator
```

Sign in everywhere with the seeded account: `kofi.miner` / `Goldtrace2026!`

---

## 2. Run on a local network (LAN)
So phones and other machines on the same Wi-Fi can reach it. Find your computer's
LAN IP (e.g. `192.168.1.20`).

- **Backend**: `python manage.py runserver 0.0.0.0:8000` and add the IP to
  `DJANGO_ALLOWED_HOSTS` in `backend/.env` (e.g. `localhost,127.0.0.1,192.168.1.20`).
- **Frontend**: `npm run dev -- --host`, and set `VITE_API_URL=http://192.168.1.20:8000/api/v1`.
- **Mobile**: set `EXPO_PUBLIC_API_URL=http://192.168.1.20:8000/api/v1` in `mobile/.env`
  (a phone can't reach `localhost` — it must be the LAN IP).

---

## 3. Host online (Atlas + Railway + Vercel)

**Database — MongoDB Atlas**: create a cluster + DB user, allow network access,
copy the SRV connection string into `MONGODB_URI`.

**Backend — Railway**
1. New project → Deploy from your repo, set **root directory** to `backend/`.
2. Add a **Redis** service (Railway plugin).
3. Set variables: `MONGODB_URI`, `MONGODB_NAME`, `DJANGO_SECRET_KEY`,
   `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=<your>.up.railway.app`,
   `DJANGO_CSRF_TRUSTED_ORIGINS=https://<your>.up.railway.app`,
   `CORS_ALLOWED_ORIGINS=https://<your-frontend>.vercel.app`,
   `CELERY_BROKER_URL=$REDIS_URL`, `CELERY_RESULT_BACKEND=$REDIS_URL`,
   `REDIS_CACHE_URL=$REDIS_URL`.
4. `Procfile` runs `collectstatic` + `migrate` on release, then gunicorn. Add a
   second service from the same repo with start command
   `celery -A goldtrace worker -l info` for the worker.

> **Migrations**: generate them once locally (connected to Atlas) and commit the
> `*/migrations/` files so Railway's release `migrate` has them.
> **Media (QR images)**: Railway's filesystem is ephemeral, so generated QR PNGs
> won't survive redeploys. For production, point storage at object storage
> (S3/Cloudinary via `django-storages`) — the `STORAGES["default"]` setting is the
> single place to change.

**Frontend — Vercel**
1. Import the repo, set **root directory** to `frontend/` (Vercel detects Vite via
   `vercel.json`).
2. Add env var `VITE_API_URL=https://<your-backend>.up.railway.app/api/v1`.
3. Deploy — `vercel.json` handles SPA routing.

**Mobile — Expo / EAS**: set `EXPO_PUBLIC_API_URL` to the Railway URL and build
with `eas build` (Android/iOS) or publish an Expo Go preview with `eas update`.

**Blockchain (optional)**: the Fabric network is deployed separately — see
`backend/blockchain/README.md`. Until enabled, anchoring uses a deterministic stub.

---

## Verify without infrastructure
```bash
cd backend && python scripts/verify_core.py   # QR + hashing + chain + GIS logic
cd frontend && npm run build                  # type-check + production build
cd mobile && npx tsc --noEmit                 # mobile type-check
```
All three currently pass.
