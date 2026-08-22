# GOLDTRACE GHANA — Web frontend (Phase 5)

React + TypeScript console for the GoldBod gold-traceability API. Built with
Vite, Redux Toolkit (RTK Query), Material UI v6 and Tailwind (utilities only —
MUI owns the base reset).

## Design
Grounded in minting and assay: deep green-black surfaces with a single restrained
metallic-gold accent, Fraunces (engraved serif) for headings, Inter for UI, and
IBM Plex Mono for the hashes and batch codes. Two signature elements — the
**assay hallmark stamp** (fineness shown as a struck seal) and the **hash-linked
custody timeline** with a verified/tampered badge.

## Run
```bash
npm install
cp .env.example .env          # point VITE_API_URL at your Django API
npm run dev                   # http://localhost:5173
```
Sign in with the demo seed account (`python manage.py seed_demo` on the backend):
`kofi.miner` / `Goldtrace2026!`.

## Structure
```
src/
├── app/            store.ts, typed hooks
├── services/api.ts RTK Query client (JWT-injected) — all 21 endpoints
├── features/       authSlice (token persistence)
├── theme.ts        MUI assay/minting theme
├── components/     Layout, ProtectedRoute, AssayStamp, ChainTimeline
└── pages/          Login, Dashboard, Miners, Batches, BatchDetail,
                    Transfers, Certificates, Verify
```

## What each screen does
- **Login** — split brand panel + JWT sign-in; tokens persisted to localStorage.
- **Overview** — live counts (miners, batches, gross gold, certificates) + recent batches.
- **Gold batches** — list + create; each row opens a passport.
- **Batch passport** — assay stamp, QR (served by the API), passport hash, and the
  custody timeline with a chain-verified badge (calls the `verify` endpoint).
- **Transfers** — confirm a pending ownership transfer (writes a custody link).
- **Export certificates** — issue a draft certificate (gated server-side on chain validity).
- **Verify passport** — enter a batch code to confirm provenance and chain integrity;
  the result card turns green (verified) or red (tampered).

`npm run build` runs `tsc` + Vite and currently passes with zero type errors.
