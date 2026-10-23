"""Audit and repair geographic data so every map point is real and inside Ghana.

Safe to run repeatedly. Fixes the most common data-entry error (a missing minus
sign on longitude, or swapped lat/lng), backfills empty regions from the nearest
regional capital, and reports anything it cannot repair.
"""
from django.core.management.base import BaseCommand

from gis.ghana import in_ghana, nearest_region

RENAMES = {
    # Demo seed placed this near Obuasi but named it after a town in Eastern Region.
    "Unlicensed pit — Anyinam": ("Unlicensed pit — Adansi North (near Obuasi)", None, None),
    "River siltation — Offin": ("River siltation — Offin River, Dunkwa", 5.9624, -1.7799),
}


def repair(lat, lng):
    """Return a corrected (lat, lng) inside Ghana, or None if no safe fix exists."""
    if lat is None or lng is None:
        return None
    for cand in ((lat, -abs(lng)), (lng, lat), (lng, -abs(lat))):
        if in_ghana(*cand):
            return cand
    return None


class Command(BaseCommand):
    help = "Repair out-of-Ghana coordinates, backfill regions, correct demo place names."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, dry_run=False, **opts):
        from accounts.models import User
        from gis.models import DetectedMiningSite, Hotspot
        from production.models import GoldBatch

        fixed = unfixable = regions = renamed = 0

        def fix(obj, lat_f, lng_f, label, region_f=None):
            nonlocal fixed, unfixable, regions
            lat, lng = getattr(obj, lat_f), getattr(obj, lng_f)
            changed = []
            if lat is not None and lng is not None and not in_ghana(lat, lng):
                r = repair(lat, lng)
                if r:
                    setattr(obj, lat_f, r[0]); setattr(obj, lng_f, r[1]); changed += [lat_f, lng_f]
                    fixed += 1
                    self.stdout.write(f"  fixed {label}: ({lat}, {lng}) -> {r}")
                else:
                    unfixable += 1
                    self.stdout.write(self.style.WARNING(f"  CANNOT fix {label}: ({lat}, {lng}) — correct manually"))
            if region_f and not getattr(obj, region_f) and in_ghana(getattr(obj, lat_f), getattr(obj, lng_f)):
                setattr(obj, region_f, nearest_region(getattr(obj, lat_f), getattr(obj, lng_f)) or "")
                changed.append(region_f); regions += 1
            if changed and not dry_run:
                obj.save()

        for title, (new, lat, lng) in RENAMES.items():
            for h in Hotspot.objects.filter(title=title):
                h.title = new
                if lat is not None:
                    h.latitude, h.longitude = lat, lng
                    h.region = "Central"
                renamed += 1
                if not dry_run:
                    h.save()

        for h in Hotspot.objects.all():
            fix(h, "latitude", "longitude", f"hotspot '{h.title}'", "region")
        for d in DetectedMiningSite.objects.all():
            fix(d, "latitude", "longitude", f"detection {d.id}", "region")
        for u in User.objects.exclude(latitude=None):
            fix(u, "latitude", "longitude", f"user {u.username}", "region")
        for b in GoldBatch.objects.exclude(origin_latitude=None):
            fix(b, "origin_latitude", "origin_longitude", f"batch {b.batch_code}")

        self.stdout.write(self.style.SUCCESS(
            f"geodata: {fixed} coordinates repaired, {regions} regions backfilled, "
            f"{renamed} demo names corrected, {unfixable} need manual correction"
            + (" (dry run — nothing saved)" if dry_run else "")))
