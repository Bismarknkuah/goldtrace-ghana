#!/usr/bin/env bash
set -e

echo "==> Applying database migrations"
python manage.py migrate --noinput || echo "migrate reported an issue; continuing (collections already exist in Atlas)"

echo "==> Seeding demo data (idempotent — runs once)"
python manage.py seed_demo || echo "seed skipped/failed; continuing"

echo "==> Starting gunicorn on port ${PORT:-8000}"
exec gunicorn goldtrace.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers 2 --threads 4 --timeout 120 \
  --access-logfile - --error-logfile -
