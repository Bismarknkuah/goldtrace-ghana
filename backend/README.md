# GOLDTRACE GHANA — Backend (Phase 2–4 core)

National Gold Supply Chain Intelligence & Traceability System for the Ghana Gold
Board (GoldBod). This repository is the **runnable backend foundation**: identity
and RBAC for all 14 user roles, miner & concession registration, and gold-batch
creation with QR-coded passports and a custody chain anchored (asynchronously) to
a permissioned ledger.

Stack: Django 6 · Django REST Framework · Django MongoDB Backend (MongoDB Atlas) ·
Redis · Celery · SimpleJWT · drf-spectacular (OpenAPI).

## Project layout

```
goldtrace/
├── goldtrace/            # project: settings, urls, celery, asgi/wsgi
├── core/                 # base model, audit log + middleware, pagination, permissions
├── accounts/             # custom User (14 roles), JWT w/ role claims, register, /me
├── miners/               # Miner, Concession (GeoJSON boundary), MinerDocument
├── production/           # GoldBatch (+QR passport), CustodyEvent, ledger tasks
├── mongo_migrations/     # MongoDB-compatible migrations for admin/auth/contenttypes
├── manage.py
├── requirements.txt
├── Dockerfile · docker-compose.yml · .env.example
```

## Run it

1. **Create a MongoDB Atlas cluster** (free tier is fine) and a database user.
   Copy the SRV connection string.
2. **Configure env**
   ```bash
   cp .env.example .env        # then paste your MONGODB_URI and a real SECRET_KEY
   ```
3. **Install & migrate**
   ```bash
   pip install -r requirements.txt
   python manage.py makemigrations accounts miners production core
   python manage.py migrate
   python manage.py createsuperuser
   ```
   > `makemigrations` connects to Atlas to introspect collections — that's expected
   > for this backend, so run it with `MONGODB_URI` set.
4. **Start services**
   ```bash
   redis-server &                       # broker for Celery
   celery -A goldtrace worker -l info &  # async QR / ledger anchoring
   python manage.py runserver
   ```
5. Open the interactive API docs at `http://127.0.0.1:8000/api/docs/`.

Docker alternative: set `.env`, then `docker compose up --build`.

## API surface (v1)

| Method | Path | Purpose | Access |
|---|---|---|---|
| POST | `/api/v1/auth/register/` | Create account | Public |
| POST | `/api/v1/auth/token/` | Obtain JWT (role claims) | Public |
| POST | `/api/v1/auth/token/refresh/` | Refresh access token | Public |
| GET/PATCH | `/api/v1/auth/me/` | Current profile | Authenticated |
| GET/POST | `/api/v1/miners/` | List / register miners | Auth (scoped) |
| GET/POST | `/api/v1/concessions/` | Concessions w/ GeoJSON boundary | Auth (scoped) |
| GET/POST | `/api/v1/documents/` | Miner documents | Auth (scoped) |
| GET/POST | `/api/v1/production/batches/` | List / create gold batches | Auth (scoped) |
| GET | `/api/v1/production/batches/verify/?code=GH-...` | Resolve QR → passport + custody chain | Auth |

Scoping: regulators (super admin, CEO, GoldBod officer, BoG, ministry) see all
records; every other role sees only their own.

## Sample requests

**Obtain a token**
```http
POST /api/v1/auth/token/
{ "username": "kofi.miner", "password": "•••••••••" }
```
```json
{ "access": "eyJhbG...", "refresh": "eyJhbG..." }
```
The access token carries `role` and `is_verified` claims.

**Create a gold batch** (miner; `Authorization: Bearer <access>`)
```http
POST /api/v1/production/batches/
{ "gross_weight_g": "1250.500", "fineness": 916,
  "source_point": { "type": "Point", "coordinates": [-1.61, 6.69] } }
```
```json
{
  "id": "66f0...",
  "batch_code": "GH-9F2A1C7E04",
  "status": "created",
  "passport_hash": "8d1c...e2",
  "qr_image": "/media/batch_qr/2026/06/GH-9F2A1C7E04.png",
  "custody_events": [
    { "event_type": "origin", "event_hash": "a31f...", "anchored_tx": "stub-a31f..." }
  ]
}
```

**Verify at the border** (customs)
```http
GET /api/v1/production/batches/verify/?code=GH-9F2A1C7E04
```
```json
{
  "batch_code": "GH-9F2A1C7E04",
  "status": "Created at source",
  "miner_license": "SSM-2024-00831",
  "gross_weight_g": "1250.500",
  "fineness": 916,
  "passport_hash": "8d1c...e2",
  "anchored": true,
  "custody_chain": [ { "event_type": "origin", "anchored_tx": "stub-a31f..." } ]
}
```

## Notes & next phases

- The Hyperledger Fabric call is a stub (`production/tasks._submit_to_fabric`);
  flip `BLOCKCHAIN_ANCHORING_ENABLED` and implement the Gateway SDK call to go live.
- Concession boundaries are stored as GeoJSON; create a 2dsphere index in Atlas on
  `concession.boundary` for hotspot / point-in-polygon queries.
- Still to come (per the phase plan): GIS & environmental modules, AI fraud
  detection + the 7-agent layer, export certification, customs app, analytics,
  notifications, React web, React Native mobile, and the k8s/CI-CD layer.

## Phase 4+ additions (advanced traceability)

- **Tamper-evident custody chain** — every custody event embeds the previous
  event's hash (`production/services.append_custody_event`). `verify_chain`
  recomputes the chain to detect any forged event or broken link. Export
  certificates can only be issued when the chain verifies.
- **trading** — `OwnershipTransfer` with a `confirm` action that moves
  `GoldBatch.current_owner` and writes a linked `transfer` custody event.
- **exports** — `ExportCertificate` with an `issue` action gated on chain
  validity; produces its own QR + hash and a public `verify` endpoint.
- **seed_demo** — `python manage.py seed_demo` builds a full miner → batch →
  transfer → certificate trail (needs a reachable MongoDB).

### Verify the core logic without a database

```bash
python scripts/verify_core.py     # QR rendering, passport hashing, chain tamper-detection
python manage.py spectacular --file openapi-schema.yml --validate   # regenerate the API schema
```

`openapi-schema.yml` (checked in) is the validated OpenAPI 3 contract for all
21 endpoints — import it into Postman/Insomnia or serve it at `/api/docs/`.

### End-to-end flow
```
miner registers ─▶ creates GoldBatch (QR + origin custody event)
   └▶ OwnershipTransfer to exporter ─▶ confirm (transfer custody event, owner moves)
       └▶ ExportCertificate.issue (chain verified ─▶ cert QR + export custody event)
           └▶ customs GET /exports/certificates/verify/?number=GHEX-... ─▶ {valid: true}
```
