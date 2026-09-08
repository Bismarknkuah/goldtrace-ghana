"""Executes GOLDTRACE's core domain logic without a database, to prove it works.
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

Run:  python scripts/verify_core.py
"""
import os
from decimal import Decimal
from io import BytesIO

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "goldtrace.settings")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/")
django.setup()

from PIL import Image  # noqa: E402

from accounts.models import User  # noqa: E402
from exports.models import ExportCertificate  # noqa: E402
from exports.services import certificate_hash  # noqa: E402
from miners.models import Miner  # noqa: E402
from production.models import CustodyEvent, CustodyEventType, GoldBatch  # noqa: E402
from production.services import (  # noqa: E402
    build_qr, event_hash, passport_hash, passport_url, verify_event_links,
)

PASS, FAIL = "  PASS", "  FAIL"


def section(title):
    print(f"\n=== {title} ===")


# In-memory objects (never saved) -------------------------------------------
user = User(username="kofi.miner")
miner = Miner(user=user, license_number="SSM-2024-00831", region="Ashanti")
batch = GoldBatch(
    batch_code="GH-9F2A1C7E04", miner=miner,
    gross_weight_g=Decimal("1250.500"), fine_weight_g=Decimal("1145.460"), fineness=916,
)

# 1. QR generation -----------------------------------------------------------
section("QR passport rendering")
qr_file = build_qr(passport_url(batch), f"{batch.batch_code}.png")
data = qr_file.read()
img = Image.open(BytesIO(data))
print(f"{PASS if img.format == 'PNG' else FAIL} produced {img.format} {img.size[0]}x{img.size[1]}px, {len(data)} bytes")
print(f"       encodes -> {passport_url(batch)}")

# 2. Passport hash is deterministic -----------------------------------------
section("Passport hash")
h1, h2 = passport_hash(batch), passport_hash(batch)
print(f"{PASS if h1 == h2 and len(h1) == 64 else FAIL} sha256 deterministic: {h1[:24]}...")
batch.fineness = 900
print(f"{PASS if passport_hash(batch) != h1 else FAIL} changing fineness changes the hash")
batch.fineness = 916

# 3. Tamper-evident custody chain -------------------------------------------
section("Custody hash chain")
def link(prev, etype, to):
    e = CustodyEvent(batch=batch, event_type=etype, to_party=to, previous_hash=prev, metadata={})
    e.event_hash = event_hash(e, prev)
    return e

e1 = link("", CustodyEventType.ORIGIN, "SSM-2024-00831")
e2 = link(e1.event_hash, CustodyEventType.TRANSFER, "ama.exporter")
e3 = link(e2.event_hash, CustodyEventType.EXPORT, "United Arab Emirates")
chain = [e1, e2, e3]

r = verify_event_links(chain)
print(f"{PASS if r['valid'] else FAIL} intact 3-link chain verifies: {r}")

e2.to_party = "smuggler.xyz"  # tamper without re-hashing
r = verify_event_links(chain)
print(f"{PASS if not r['valid'] and r['broken_at'] == 1 else FAIL} tampering event #2 is detected: {r}")
e2.to_party = "ama.exporter"  # restore

e2.previous_hash = "deadbeef"  # break the link
r = verify_event_links(chain)
print(f"{PASS if not r['valid'] and r['broken_at'] == 1 else FAIL} broken link is detected: {r}")

# 4. Certificate hash binds to the batch passport ---------------------------
section("Export certificate hash")
batch.passport_hash = passport_hash(batch)
cert = ExportCertificate(
    certificate_number="GHEX-1A2B3C4D", batch=batch,
    destination_country="United Arab Emirates",
    fine_weight_g=Decimal("1145.460"), fineness=916,
)
c1 = certificate_hash(cert)
print(f"{PASS if len(c1) == 64 else FAIL} certificate sha256: {c1[:24]}...")
cert.destination_country = "Switzerland"
print(f"{PASS if certificate_hash(cert) != c1 else FAIL} changing destination changes the cert hash")

# 5. GIS point-in-polygon -----------------------------------------------------
section("GIS point-in-polygon")
from gis.services import point_in_polygon, haversine_km  # noqa: E402
square = [[[-1.70, 6.18], [-1.64, 6.18], [-1.64, 6.23], [-1.70, 6.23], [-1.70, 6.18]]]
inside = point_in_polygon(-1.67, 6.20, square)
outside = point_in_polygon(-1.50, 6.20, square)
print(f"{PASS if inside and not outside else FAIL} point inside={inside}, point outside={outside}")
d = haversine_km(6.20, -1.67, 6.27, -1.61)
print(f"{PASS if 8 < d < 12 else FAIL} haversine distance ~{d:.1f} km between known points")

# 6. Logistics pricing + AI matching ------------------------------------------
section("Logistics pricing + matching")
from types import SimpleNamespace  # noqa: E402
from logistics.services import estimate_price, estimate_eta_minutes, rank_nearby_couriers  # noqa: E402

bike = estimate_price("rider", 6.0, 0.0)        # 50 + 36 = 86
veh = estimate_price("driver", 10.0, 50.0)      # 50 + 120 + 100 = 270
print(f"{PASS if bike == 86 and veh == 270 else FAIL} haulage (bike/vehicle): {bike}, {veh}")
eta = estimate_eta_minutes("rider", 15.0)       # 15/30*60 = 30
print(f"{PASS if eta == 30 else FAIL} rider ETA for 15 km: {eta} min")

couriers = [
    SimpleNamespace(current_lat=6.205, current_lng=-1.665, max_weight_kg=20),   # ~0.4 km
    SimpleNamespace(current_lat=6.30,  current_lng=-1.70,  max_weight_kg=20),   # ~11 km
    SimpleNamespace(current_lat=6.20,  current_lng=-1.67,  max_weight_kg=0.5),  # too small
]
ranked = rank_nearby_couriers(6.205, -1.67, "rider", 1.2, couriers, radius_km=15)
nearest_ok = len(ranked) == 2 and ranked[0][1] < ranked[1][1]
print(f"{PASS if nearest_ok else FAIL} nearest-available match: {len(ranked)} eligible, nearest {ranked[0][1]} km")

# 7. Anti-smuggling risk engine ----------------------------------------------
section("Anti-smuggling risk engine")
from intelligence.services import evaluate  # noqa: E402
healthy = {"chain_valid": True, "origin_in_concession": True, "miner_active": True,
           "weight_ok": True, "anchored": True, "near_hotspot": False, "duplicate_passport": False}
clear = evaluate(healthy)
print(f"{PASS if clear['level'] == 'clear' and clear['score'] == 0 else FAIL} clean batch -> {clear['level']} ({clear['score']})")
watch = evaluate({**healthy, "near_hotspot": True})
print(f"{PASS if watch['level'] == 'watch' else FAIL} near hotspot -> {watch['level']} ({watch['score']})")
elevated = evaluate({**healthy, "origin_in_concession": False, "near_hotspot": True})
print(f"{PASS if elevated['level'] == 'elevated' else FAIL} unlicensed origin + hotspot -> {elevated['level']} ({elevated['score']})")
crit = evaluate({**healthy, "chain_valid": False})
codes = [f['code'] for f in crit['flags']]
print(f"{PASS if crit['level'] == 'critical' and 'tampered_chain' in codes else FAIL} tampered chain -> {crit['level']} ({crit['score']})")

# 8. Government revenue & royalty --------------------------------------------
section("Government revenue & royalty")
from decimal import Decimal  # noqa: E402
from revenue.services import export_value_ghs, royalty_ghs  # noqa: E402
val = export_value_ghs(1145.46, 900)          # 1,030,914.00
roy = royalty_ghs(val, 0.05)                  # 51,545.70
print(f"{PASS if val == Decimal('1030914.00') else FAIL} export value (1145.46 g @ 900): GHS {val}")
print(f"{PASS if roy == Decimal('51545.70') else FAIL} 5% mineral royalty: GHS {roy}")

# 9. Per-role data scoping ----------------------------------------------------
section("Per-role data scoping")
from core.scoping import can_view_batch  # noqa: E402
# a mining-company user sees their group's gold, not another company's
mine = dict(role="mining_company", is_superuser=False, user_id="u1", user_company_id="cA",
            miner_user_id="m1", current_owner_id="o1", created_by_id="o1")
own = can_view_batch(**{**mine, "miner_company_id": "cA"})
other = can_view_batch(**{**mine, "miner_company_id": "cB"})
print(f"{PASS if own and not other else FAIL} mining company sees own group only: own={own}, other={other}")
ceo = can_view_batch(role="ceo", is_superuser=False, user_id="x", user_company_id=None,
                     miner_user_id="m", miner_company_id="cZ", current_owner_id="o", created_by_id="o")
print(f"{PASS if ceo else FAIL} regulator sees everything: {ceo}")
miner = can_view_batch(role="miner", is_superuser=False, user_id="m1", user_company_id=None,
                       miner_user_id="m1", miner_company_id="cA", current_owner_id="o", created_by_id="o")
notmine = can_view_batch(role="miner", is_superuser=False, user_id="m2", user_company_id=None,
                         miner_user_id="m1", miner_company_id="cA", current_owner_id="o", created_by_id="o")
print(f"{PASS if miner and not notmine else FAIL} miner sees only own batches: own={miner}, other={notmine}")

# 10. KYC/AML screening ------------------------------------------------------
section("KYC/AML screening")
from compliance.services import screen_party, responsible_sourcing_ok  # noqa: E402
clean = screen_party("Global Bullion DMCC", "United Arab Emirates")
sanctioned = screen_party("Sanctioned Trading Co", "Ghana")
risky = screen_party("Some Buyer", "North Korea")
print(f"{PASS if clean['status'] == 'cleared' else FAIL} clean buyer -> {clean['status']} ({clean['risk_rating']})")
print(f"{PASS if sanctioned['status'] == 'rejected' and sanctioned['sanctions_hit'] else FAIL} sanctioned -> {sanctioned['status']}")
print(f"{PASS if risky['status'] == 'flagged' and risky['risk_rating'] == 'high' else FAIL} high-risk country -> {risky['status']}")
print(f"{PASS if responsible_sourcing_ok(True, True, True) and not responsible_sourcing_ok(True, False, True) else FAIL} responsible-sourcing rule")

# 11. GoldBod supply-chain flow ----------------------------------------------
section("Supply-chain flow")
from core.supply_chain import resolve_stage  # noqa: E402
s1, r1 = resolve_stage("miner", "aggregator")
s2, r2 = resolve_stage("aggregator", "goldbod_officer")
s3, r3 = resolve_stage("miner", "exporter")
print(f"{PASS if s1 == 'miner_to_aggregator' and r1 else FAIL} miner->aggregator regular: {s1}")
print(f"{PASS if s2 == 'aggregator_to_goldbod' and r2 else FAIL} aggregator->GoldBod regular: {s2}")
print(f"{PASS if s3 == 'other' and not r3 else FAIL} miner->exporter flagged irregular: {s3}, regular={r3}")

# 12. Participant AML risk ----------------------------------------------------
section("Participant AML risk")
from intelligence.services import evaluate_participant  # noqa: E402
clean = evaluate_participant({"kyc": "cleared", "unlicensed": False, "irregular_transfers": 0})
rej = evaluate_participant({"kyc": "rejected"})
mix = evaluate_participant({"unlicensed": True, "irregular_transfers": 2})
print(f"{PASS if clean['level'] == 'clear' else FAIL} compliant participant -> {clean['level']}")
print(f"{PASS if rej['level'] == 'critical' else FAIL} KYC-rejected -> {rej['level']}")
print(f"{PASS if mix['level'] == 'elevated' else FAIL} unlicensed + irregular -> {mix['level']} ({mix['score']})")

print("\nAll core-logic checks executed.")
