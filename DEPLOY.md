# Deploying GOLDTRACE — GitHub + Vercel (frontend) + Railway + Atlas (backend)

## A. Push to GitHub (from VS Code)
1. **Source Control** panel (the branch icon on the left) → **Initialize Repository**.
2. Confirm `.gitignore` excludes secrets — `backend/.env`, `frontend/.env`,
   `mobile/.env`, `node_modules`, `.venv` should NOT be staged. (They're already
   ignored; never commit `.env`.)
3. Type a commit message → **Commit** → **Publish Branch** → choose **private** repo.
   VS Code creates the GitHub repo and pushes for you.

> Because `.env` is git-ignored, you'll set the same variables in Railway/Vercel
> dashboards instead of committing them.

## B. MongoDB Atlas (cloud access)
Railway's outbound IPs are dynamic, so your Atlas cluster must accept connections
from them:
- Atlas → **Network Access** → **Add IP Address** → **Allow Access from Anywhere**
  (`0.0.0.0/0`). Combined with the DB user/password this is acceptable for getting
  online; tighten later with Railway static egress if you need to.
- Rotate the DB password first (it was shared earlier), then use the new one below.

## C. Backend on Railway
1. railway.com → **New Project → Deploy from GitHub repo** → pick your repo.
2. Open the service → **Settings**:
   - **Root Directory**: `backend`
   - **Pre-Deploy Command**: `python manage.py migrate`
   - (optional, for styled Django admin) **Build Command**:
     `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - **Networking → Generate Domain** (gives you `https://<name>.up.railway.app`).
3. **Variables** tab — add:
   ```
   MONGODB_URI = mongodb+srv://USER:NEWPASS@cluster0.kevjwkd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   MONGODB_NAME = goldtrace
   DJANGO_SECRET_KEY = <a fresh 50-char random string>
   DJANGO_DEBUG = False
   DJANGO_ALLOWED_HOSTS = <name>.up.railway.app
   DJANGO_CSRF_TRUSTED_ORIGINS = https://<name>.up.railway.app
   CORS_ALLOWED_ORIGINS = https://<your-vercel-app>.vercel.app
   CELERY_TASK_ALWAYS_EAGER = True
   ```
   `CELERY_TASK_ALWAYS_EAGER=True` runs anchoring inline, so you need **no Redis
   and no worker** for the first deploy.
4. Deploy. Once green, open `https://<name>.up.railway.app/api/docs/`.
5. **Seed data once**: service → **⋯ → Run a command** (or Railway CLI
   `railway run python manage.py seed_demo`).

Optional (scale-up later): add a **Redis** service + a second service from the
same repo with start command `celery -A goldtrace worker -l info`, set
`CELERY_TASK_ALWAYS_EAGER=False`, and point `CELERY_BROKER_URL` at `$REDIS_URL`.

## D. Frontend on Vercel
1. vercel.com → **Add New → Project** → import the same GitHub repo.
2. **Root Directory**: `frontend` (Vercel auto-detects Vite via `vercel.json`).
3. **Environment Variables**:
   ```
   VITE_API_URL = https://<name>.up.railway.app/api/v1
   ```
4. **Deploy**. You get `https://<your-vercel-app>.vercel.app`.

## E. Link them up
1. Back in Railway, set `CORS_ALLOWED_ORIGINS` to your real Vercel URL → redeploy.
2. Open the Vercel URL, tap a role chip, sign in (`Goldtrace2026!`).

## F. Auto-deploy on every push
Both platforms now redeploy automatically when you `git push` (Commit → Sync in
VS Code). Vercel rebuilds the frontend; Railway rebuilds the backend and runs the
Pre-Deploy migrate.

### Common snags
- **Backend 400 / "DisallowedHost"** → `DJANGO_ALLOWED_HOSTS` doesn't match the
  Railway domain.
- **Browser CORS error** → `CORS_ALLOWED_ORIGINS` doesn't exactly match the Vercel
  URL (https, no trailing slash).
- **Backend can't reach Mongo** → Atlas Network Access missing `0.0.0.0/0`.
- **Migrations didn't run** → set the Pre-Deploy Command (Railway won't run the
  Procfile `release` line like Heroku does).
