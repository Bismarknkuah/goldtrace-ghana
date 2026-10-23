"""Seed a realistic, GoldBod-compliant gold market for trials.

Adds licensed miners in Ghana's real gold districts, licensed Tier 1 / Tier 2
buyers and aggregators, assayed lots with GPS origins inside their concessions,
complete ownership chains that follow the GoldBod trading order, and marketplace
listings at every tier — so each role sees only the gold it is allowed to buy.

It also adds a few deliberately problematic lots (origin off-concession, origin
next to a confirmed illegal site, under-priced, unassayed) and an expired
licence, so the compliance gate and illegal-mining linkage can be tested.

All people and companies are fictional. Idempotent: runs once.
Usage:  python manage.py seed_market            (after seed_demo)
        python manage.py seed_market --force    (re-run even if present)
"""
import random
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Role
from core.models import SystemConfig
from core.supply_chain import resolve_stage
from gis.models import DetectedMiningSite, DetectionStatus, Hotspot, Severity
from licensing.models import License, LicenseStatus as LStatus, LicenseType
from logistics.models import CourierType, DeliveryRequest, DeliveryStatus
from miners.models import Concession, LicenseStatus as MStatus, Miner, MiningCompany
from pricing.models import ReferenceRate
from production.models import Assay, AssayMethod, BatchStatus, CustodyEventType, GoldBatch
from production.services import append_custody_event, build_qr, passport_hash, passport_url
from trading.models import OwnershipTransfer, PaymentReceipt, TransferStatus

User = get_user_model()
PASSWORD = "Goldtrace2026!"
MARKER = "kwame.asante"
Q2 = Decimal("0.01")

# Demo GoldBod / BoG reference price, GHS per gram of fine gold (last 10 days).
# Replace with the live published rate in Pricing once you go live.
RATE_HISTORY = [1362, 1368, 1371, 1365, 1374, 1380, 1386, 1383, 1391, 1395]

# Real gold-mining districts (centroids); people/companies are fictional.
MINERS = [
    # username, first, last, licence, region, district, (lat, lng), concession name
    ("kwame.asante", "Kwame", "Asante", "SSM-WR-2025-0112", "Western", "Tarkwa-Nsuaem", (5.3018, -1.9930), "Tarkwa Bogoso Block A"),
    ("abena.mensah", "Abena", "Mensah", "SSM-WR-2025-0187", "Western", "Prestea-Huni Valley", (5.4333, -2.1430), "Prestea Himan Plot 7"),
    ("yaw.boateng", "Yaw", "Boateng", "SSM-CR-2025-0044", "Central", "Upper Denkyira East", (5.9624, -1.7799), "Dunkwa Offin Terrace 3"),
    ("akosua.owusu", "Akosua", "Owusu", "SSM-ER-2025-0091", "Eastern", "East Akim", (6.1653, -0.5547), "Kibi Apapam Lease"),
    ("kwabena.darko", "Kwabena", "Darko", "SSM-WN-2025-0063", "Western North", "Bibiani-Anhwiaso-Bekwai", (6.4631, -2.3191), "Bibiani Lineso Block"),
    ("efua.addo", "Efua", "Addo", "SSM-AR-2025-0156", "Ashanti", "Asante Akim Central", (6.6170, -1.2167), "Konongo Odumasi Lease"),
    ("issah.mahama", "Issah", "Mahama", "SSM-UW-2025-0021", "Upper West", "Wa East", (10.0601, -2.5099), "Wa Bulenga Plot 2"),
]
# A miner whose licence has been suspended — cannot sell.
SUSPENDED_MINER = ("kojo.badu", "Kojo", "Badu", "SSM-ER-2024-0310", "Eastern", "Atiwa West", (6.2400, -0.5900), "Atiwa Sekyere Plot")

TRADERS = [
    # username, role, first, last, org, region, district, (lat, lng), licence type
    ("nana.tier1.tarkwa", Role.TIER1_BUYER, "Nana", "Ofori", "Nsuaem Gold Buyers", "Western", "Tarkwa-Nsuaem", (5.3050, -1.9870), LicenseType.TIER1_BUYER),
    ("esi.tier1.kibi", Role.TIER1_BUYER, "Esi", "Antwi", "Akim Abuakwa Gold Traders", "Eastern", "East Akim", (6.1700, -0.5500), LicenseType.TIER1_BUYER),
    ("salifu.tier1.wa", Role.TIER1_BUYER, "Salifu", "Abdulai", "Wa Savannah Gold Buyers", "Upper West", "Wa Municipal", (10.0640, -2.5010), LicenseType.TIER1_BUYER),
    ("kofi.tier2.kumasi", Role.TIER2_BUYER, "Kofi", "Amankwah", "Adum Bullion Enterprise", "Ashanti", "Kumasi Metropolitan", (6.6885, -1.6244), LicenseType.TIER2_BUYER),
    ("ama.tier2.takoradi", Role.TIER2_BUYER, "Ama", "Quaye", "Sekondi Gold House", "Western", "Sekondi-Takoradi", (4.9340, -1.7137), LicenseType.TIER2_BUYER),
    ("goldcoast.aggregator", Role.AGGREGATOR, "Gold Coast", "Aggregators", "Gold Coast Aggregators Ltd", "Greater Accra", "Accra Metropolitan", (5.6037, -0.1870), LicenseType.AGGREGATOR),
    ("northstar.aggregator", Role.AGGREGATOR, "Northstar", "Aggregation", "Northstar Self-Financing Aggregation", "Northern", "Tamale Metropolitan", (9.4008, -0.8393), LicenseType.SELF_FINANCING_AGGREGATOR),
]
# A Tier 1 buyer whose licence has expired — cannot buy or sell.
EXPIRED_TRADER = ("yaa.tier1.expired", Role.TIER1_BUYER, "Yaa", "Asantewaa", "Obuasi Gold Link", "Ashanti", "Obuasi Municipal", (6.2027, -1.6704), LicenseType.TIER1_BUYER)

# Profiles for the base demo accounts so the compliance checklist is realistic.
DEMO_PROFILES = {
    "kofi.miner": ("Ashanti", "Obuasi Municipal", (6.2050, -1.6700)),
    "tier1.buyer": ("Ashanti", "Obuasi Municipal", (6.2100, -1.6650)),
    "tier2.buyer": ("Ashanti", "Kumasi Metropolitan", (6.6950, -1.6200)),
    "aggregator": ("Ashanti", "Kumasi Metropolitan", (6.7000, -1.6300)),
    "buying.agent": ("Western", "Tarkwa-Nsuaem", (5.3000, -1.9950)),
    "goldbod.officer": ("Greater Accra", "Accra Metropolitan", (5.5600, -0.2000)),
    "refinery.op": ("Greater Accra", "Tema Metropolitan", (5.6698, -0.0166)),
    "ama.exporter": ("Greater Accra", "Accra Metropolitan", (5.5900, -0.1800)),
    "mining.company": ("Ashanti", "Obuasi Municipal", (6.1900, -1.6800)),
    "assayer": ("Greater Accra", "Accra Metropolitan", (5.5650, -0.2050)),
}

# Satellite / field detections. Some lie close to lots so the linkage is visible.
DETECTIONS = [
    # lat, lng, region, status, confidence, area_ha, operator, note
    (6.2550, -0.6050, "Eastern", DetectionStatus.CONFIRMED_ILLEGAL, 0.94, 6.5, "Unregistered pit operators",
     "Atiwa forest fringe — excavator pits and washing plant confirmed by EPA patrol."),
    (5.9900, -1.8050, "Central", DetectionStatus.CONFIRMED_ILLEGAL, 0.91, 11.2, "Changfang dredge crew",
     "Dredging on the Offin River outside any concession; river turbidity high."),
    (5.4700, -2.1700, "Western", DetectionStatus.SUSPECTED_ILLEGAL, 0.78, 3.4, "",
     "Fresh land clearing and pits along the Ankobra, outside licensed boundary."),
    (6.5000, -2.3600, "Western North", DetectionStatus.SUSPECTED_ILLEGAL, 0.72, 2.1, "",
     "Cocoa-farm conversion to pits near Bibiani; field verification pending."),
    (10.1200, -2.4600, "Upper West", DetectionStatus.UNVERIFIED, 0.55, 1.2, "",
     "Small artisanal clearing detected by satellite."),
]
HOTSPOTS = [
    ("Atiwa Forest Reserve — galamsey encroachment", 6.2600, -0.5950, Severity.HIGH, "Eastern"),
    ("Offin River dredging — Dunkwa stretch", 5.9850, -1.8000, Severity.HIGH, "Central"),
    ("Ankobra River siltation — Prestea", 5.4650, -2.1650, Severity.MEDIUM, "Western"),
    ("Pra River turbidity — Twifo Praso", 5.6090, -1.5490, Severity.MEDIUM, "Central"),
]


def _box(lat, lng, d=0.03):
    return {"type": "Polygon", "coordinates": [[
        [lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]]]}


def _card(i):
    return f"GHA-7{i:08d}-{i % 9}"


class Command(BaseCommand):
    help = "Seed a realistic GoldBod-compliant marketplace (miners, traders, lots, listings)."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true")

    def handle(self, *args, **opts):
        if User.objects.filter(username=MARKER).exists() and not opts["force"]:
            self.stdout.write(self.style.WARNING("Market data already present — skipping."))
            return
        if not User.objects.filter(username="goldbod.officer").exists():
            self.stdout.write(self.style.WARNING("Run seed_demo first — skipping."))
            return
        rnd = random.Random(1140)
        self.rnd = rnd
        self.today = date.today()
        officer = User.objects.get(username="goldbod.officer")
        self.officer = officer
        self.assayer = User.objects.filter(username="assayer").first()

        # GoldBod price cap: buyers may not pay above the published price.
        cfg = SystemConfig.get()
        if cfg.price_band_above_pct > 2.0:
            cfg.price_band_above_pct = 2.0
            cfg.save(update_fields=["price_band_above_pct"])

        # Reference-rate history.
        bog = User.objects.filter(username="bog.officer").first()
        for i, r in enumerate(RATE_HISTORY):
            d = self.today - timedelta(days=len(RATE_HISTORY) - 1 - i)
            if not ReferenceRate.objects.filter(effective_date=d).exists():
                ReferenceRate.objects.create(rate_ghs_per_g=Decimal(r), effective_date=d, set_by=bog,
                                             source="GoldBod / Bank of Ghana reference (demo)")
        self.rate = Decimal(RATE_HISTORY[-1])

        # Profiles for the base demo accounts.
        for n, (uname, (region, district, (lat, lng))) in enumerate(DEMO_PROFILES.items(), start=1):
            u = User.objects.filter(username=uname).first()
            if u:
                u.region, u.district, u.latitude, u.longitude = region, district, lat, lng
                u.ghana_card_number = u.ghana_card_number or _card(n)
                u.phone = u.phone or f"+23324{n:07d}"
                u.save()

        # Licensed miners + concessions.
        self.miners = {}
        for i, row in enumerate(MINERS + [SUSPENDED_MINER], start=20):
            uname, first, last, lic, region, district, (lat, lng), cname = row
            u = self._user(uname, Role.MINER, first, last, region, district, lat, lng, i,
                           organization=f"{last} Small-Scale Mining")
            suspended = row is SUSPENDED_MINER
            m, _ = Miner.objects.get_or_create(user=u, defaults={
                "license_number": lic, "region": region, "district": district,
                "license_status": MStatus.SUSPENDED if suspended else MStatus.ACTIVE,
                "license_expiry": self.today + timedelta(days=rnd.randint(200, 700)),
                "verified_by": officer})
            code = "CON-" + lic.split("-")[1] + "-" + lic.split("-")[-1]
            c, _ = Concession.objects.get_or_create(code=code, defaults={
                "miner": m, "name": cname, "region": region,
                "area_hectares": round(rnd.uniform(18, 95), 1), "boundary": _box(lat, lng),
                "centroid_lat": lat, "centroid_lng": lng,
                "valid_from": self.today - timedelta(days=300),
                "valid_until": self.today + timedelta(days=1500), "is_active": True})
            self.miners[uname] = (u, m, c)

        # Large-scale mining company.
        company = MiningCompany.objects.filter(registration_no="MC-ASH-0007").first()
        mc_user = User.objects.filter(username="mining.company").first()
        if mc_user and not Miner.objects.filter(user=mc_user).exists():
            m = Miner.objects.create(user=mc_user, license_number="LSM-AR-2019-0007", region="Ashanti",
                                     district="Obuasi Municipal", license_status=MStatus.ACTIVE,
                                     license_expiry=self.today + timedelta(days=2000),
                                     verified_by=officer, company=company)
            c = Concession.objects.create(code="CON-LSM-0007", miner=m, name="Obuasi Deep Lease",
                                          region="Ashanti", area_hectares=4800.0,
                                          boundary=_box(6.10, -1.75, 0.04), centroid_lat=6.10,
                                          centroid_lng=-1.75, is_active=True)
            self.miners["mining.company"] = (mc_user, m, c)

        # Licensed traders.
        self.u = {}
        for i, row in enumerate(TRADERS + [EXPIRED_TRADER], start=40):
            uname, role, first, last, org, region, district, (lat, lng), ltype = row
            u = self._user(uname, role, first, last, region, district, lat, lng, i, organization=org)
            expired = row is EXPIRED_TRADER
            if not License.objects.filter(holder=u, license_type=ltype).exists():
                License.objects.create(
                    holder=u, license_type=ltype, status=LStatus.ACTIVE, region=region,
                    operating_areas=district,
                    working_capital_ghs=Decimal(rnd.choice([150000, 250000, 500000, 2000000])),
                    trade_capital_ghs=Decimal(rnd.choice([100000, 200000, 400000, 1500000])),
                    expires_at=(self.today - timedelta(days=21)) if expired
                    else self.today + timedelta(days=rnd.randint(45, 330)),
                    issued_by=officer)
            self.u[uname] = u
        for uname in ("tier1.buyer", "tier2.buyer", "aggregator", "buying.agent", "goldbod.officer",
                      "refinery.op", "ama.exporter", "intl.buyer", "driver.one"):
            self.u[uname] = User.objects.filter(username=uname).first()

        # Detections and hotspots.
        for lat, lng, region, st, conf, area, op, note in DETECTIONS:
            if not DetectedMiningSite.objects.filter(latitude=lat, longitude=lng).exists():
                DetectedMiningSite.objects.create(latitude=lat, longitude=lng, region=region, status=st,
                                                  confidence=conf, area_ha=area, operator_name=op,
                                                  note=note, source="satellite")
        for title, lat, lng, sev, region in HOTSPOTS:
            Hotspot.objects.get_or_create(title=title, defaults={
                "latitude": lat, "longitude": lng, "severity": sev, "region": region,
                "source": "satellite", "location": {"type": "Point", "coordinates": [lng, lat]}})

        U = self.u
        n = 0
        # ---- Listings at every tier (each chain follows the GoldBod order) ----
        # Miners selling at source -> buyable by Tier 1/2, aggregators, agents, GoldBod.
        for uname, grams, fine in [("kwame.asante", 182.4, 912), ("abena.mensah", 96.7, 905),
                                    ("yaw.boateng", 240.0, 918), ("kwabena.darko", 151.3, 921),
                                    ("efua.addo", 64.9, 899), ("issah.mahama", 118.2, 908),
                                    ("akosua.owusu", 205.5, 915)]:
            self._lot(uname, grams, fine, chain=[], list_factor=self._f(0.96, 0.995)); n += 1
        # Tier 1 lots -> only Tier 2 may buy.
        for uname, t1, grams, fine in [("kwame.asante", "nana.tier1.tarkwa", 310.6, 914),
                                        ("akosua.owusu", "esi.tier1.kibi", 188.0, 917),
                                        ("issah.mahama", "salifu.tier1.wa", 142.8, 903),
                                        ("abena.mensah", "nana.tier1.tarkwa", 225.1, 909)]:
            self._lot(uname, grams, fine, chain=[U[t1]], list_factor=self._f(0.975, 1.0)); n += 1
        # Tier 2 lots -> aggregators, buying agents, GoldBod.
        for uname, t1, t2, grams, fine in [
                ("kwame.asante", "nana.tier1.tarkwa", "ama.tier2.takoradi", 520.4, 916),
                ("efua.addo", None, "kofi.tier2.kumasi", 410.0, 911),
                ("kwabena.darko", None, "kofi.tier2.kumasi", 365.9, 920),
                ("akosua.owusu", "esi.tier1.kibi", "kofi.tier2.kumasi", 298.3, 914)]:
            chain = [U[t1]] if t1 else []
            self._lot(uname, grams, fine, chain=chain + [U[t2]], list_factor=self._f(0.985, 1.005)); n += 1
        # Aggregated lots -> GoldBod only.
        self._aggregated("goldcoast.aggregator", ["kwame.asante", "abena.mensah", "yaw.boateng"], 0.995); n += 1
        self._aggregated("northstar.aggregator", ["issah.mahama", "issah.mahama", "efua.addo"], 1.0); n += 1
        # GoldBod stock -> refinery, export agent, foreign buyers (via GoldBod only).
        for uname, grams, fine in [("yaw.boateng", 2450.0, 995), ("kwabena.darko", 1820.5, 995)]:
            self._lot(uname, grams, fine, chain=[U["kofi.tier2.kumasi"], U["goldcoast.aggregator"],
                                                 U["goldbod.officer"]], list_factor=1.0); n += 1
        # Refined bar at the refinery -> GoldBod or exporter.
        self._lot("efua.addo", 998.0, 999, chain=[U["kofi.tier2.kumasi"], U["goldcoast.aggregator"],
                                                  U["goldbod.officer"], U["refinery.op"]], list_factor=1.0); n += 1
        # Exporter stock -> approved foreign off-taker.
        self._lot("kwame.asante", 3000.0, 995, chain=[U["ama.tier2.takoradi"], U["goldcoast.aggregator"],
                                                      U["goldbod.officer"], U["ama.exporter"]], list_factor=1.0); n += 1
        # Large-scale doré -> GoldBod or refinery.
        if "mining.company" in self.miners:
            self._lot("mining.company", 5200.0, 872, chain=[], list_factor=0.99); n += 1

        # ---- Deliberate compliance test cases --------------------------------
        # Origin OUTSIDE the declared concession (held for review).
        self._lot("akosua.owusu", 77.3, 890, chain=[], list_factor=0.98,
                  origin=(6.3100, -0.4200), note="TEST: origin outside licensed concession"); n += 1
        # Origin right next to the CONFIRMED illegal Offin dredging site (blocked on purchase).
        self._lot("yaw.boateng", 133.6, 902, chain=[], list_factor=0.97,
                  origin=(5.9930, -1.8020), note="TEST: origin beside confirmed illegal dredge site"); n += 1
        # Under-priced 18% below the reference (possible miner under-payment, review).
        self._lot("issah.mahama", 88.0, 906, chain=[U["salifu.tier1.wa"]], list_factor=0.82,
                  note="TEST: priced far below GoldBod reference"); n += 1
        # Not assayed yet.
        self._lot("kwabena.darko", 59.4, None, chain=[], list_factor=None, ask=Decimal("72000"),
                  note="TEST: awaiting assay"); n += 1
        # Suspended miner holding gold (cannot list — not on the market).
        self._lot(SUSPENDED_MINER[0], 140.0, 897, chain=[], list_factor=None, note="Suspended licence — not listed")

        # Pending purchase requests (seller must approve).
        pend = 0
        for buyer, seller_role in [("kofi.tier2.kumasi", Role.TIER1_BUYER), ("goldcoast.aggregator", Role.MINER),
                                   ("buying.agent", Role.TIER2_BUYER)]:
            b = (GoldBatch.objects.filter(listed_for_sale=True, current_owner__role=seller_role)
                 .exclude(field_notes__startswith="TEST").first())
            if b and U.get(buyer):
                stage, ok = resolve_stage(b.current_owner.role, U[buyer].role)
                if ok and not OwnershipTransfer.objects.filter(batch=b, buyer=U[buyer]).exists():
                    OwnershipTransfer.objects.create(batch=b, seller=b.current_owner, buyer=U[buyer],
                                                     price=b.asking_price_ghs, currency="GHS", stage=stage,
                                                     irregular=False, status=TransferStatus.PENDING)
                    pend += 1

        self.stdout.write(self.style.SUCCESS(
            f"Market seeded: {len(self.miners)} miners, {len(TRADERS) + 1} traders, {n} listed lots, "
            f"{pend} pending requests, {len(DETECTIONS)} detections. Password '{PASSWORD}'."))

    # ------------------------------------------------------------------ helpers
    def _f(self, lo, hi):
        return round(self.rnd.uniform(lo, hi), 4)

    def _user(self, uname, role, first, last, region, district, lat, lng, i, organization=""):
        u, created = User.objects.get_or_create(username=uname, defaults={"role": role})
        u.role, u.first_name, u.last_name = role, first, last
        u.region, u.district, u.latitude, u.longitude = region, district, lat, lng
        u.organization = organization
        u.ghana_card_number = u.ghana_card_number or _card(i)
        u.phone = u.phone or f"+23320{i:07d}"
        u.is_verified = True
        if created:
            u.set_password(PASSWORD)
        u.save()
        return u

    def _lot(self, miner_uname, grams, fineness, chain, list_factor, origin=None, note="", ask=None):
        """Create a lot at a miner's concession, move it along `chain` (each sale must be
        permitted), optionally list it at `list_factor` × reference value."""
        mu, m, c = self.miners[miner_uname]
        rnd = self.rnd
        if origin is None:
            origin = (c.centroid_lat + rnd.uniform(-0.008, 0.008), c.centroid_lng + rnd.uniform(-0.008, 0.008))
        gross = Decimal(str(grams)).quantize(Decimal("0.001"))
        fine = (gross * Decimal(fineness) / 1000).quantize(Decimal("0.001")) if fineness else None
        b = GoldBatch.objects.create(
            miner=m, concession=c, current_owner=mu, created_by=mu, gross_weight_g=gross,
            fine_weight_g=fine, fineness=fineness, origin_latitude=round(origin[0], 6),
            origin_longitude=round(origin[1], 6), field_notes=note,
            source_point={"type": "Point", "coordinates": [round(origin[1], 6), round(origin[0], 6)]},
            status=BatchStatus.ASSAYED if fineness else BatchStatus.CREATED)
        b.passport_hash = passport_hash(b)
        try:
            b.qr_image = build_qr(passport_url(b), f"{b.batch_code}.png")
        except Exception:  # pragma: no cover - storage issues must not stop seeding
            pass
        b.save(update_fields=["passport_hash", "qr_image"])
        append_custody_event(b, CustodyEventType.ORIGIN, actor=mu, to_party=m.license_number,
                             location={"type": "Point", "coordinates": [b.origin_longitude, b.origin_latitude]})
        if fineness:
            Assay.objects.create(batch=b, assayer=self.assayer, method=rnd.choice([AssayMethod.XRF, AssayMethod.FIRE]),
                                 gross_weight_g=gross, fine_weight_g=fine, fineness=fineness,
                                 remarks="GoldBod assay centre")
            append_custody_event(b, CustodyEventType.ASSAY, actor=self.assayer,
                                 metadata={"fineness": fineness, "fine_weight_g": str(fine)})
        self._move(b, chain)
        if list_factor or ask:
            price = ask or (fine * self.rate * Decimal(str(list_factor))).quantize(Q2, ROUND_HALF_UP)
            b.listed_for_sale, b.asking_price_ghs = True, price
            b.seal_number = f"GB-SEAL-{rnd.randint(100000, 999999)}"
            b.save(update_fields=["listed_for_sale", "asking_price_ghs", "seal_number"])
        return b

    def _move(self, b, chain):
        seller = b.current_owner
        fine = b.fine_weight_g
        for k, buyer in enumerate(chain):
            stage, ok = resolve_stage(seller.role, buyer.role)
            if not ok:
                raise RuntimeError(f"Seed chain breaks GoldBod rules: {seller.role} -> {buyer.role}")
            # Each tier pays a little more, never above the GoldBod price.
            factor = Decimal(str(min(1.0, 0.965 + 0.01 * k)))
            price = (fine * self.rate * factor).quantize(Q2, ROUND_HALF_UP) if fine else Decimal("0")
            t = OwnershipTransfer.objects.create(batch=b, seller=seller, buyer=buyer, price=price,
                                                 currency="GHS", stage=stage, irregular=False,
                                                 status=TransferStatus.COMPLETED, completed_at=timezone.now())
            PaymentReceipt.objects.create(transfer=t, payer=buyer, payee=seller, amount=price, currency="GHS")
            append_custody_event(b, CustodyEventType.TRANSFER, actor=buyer, from_party=str(seller),
                                 to_party=str(buyer), metadata={"price_ghs": str(price), "stage": stage})
            if seller.latitude is not None and buyer.latitude is not None:
                from gis.services import haversine_km
                DeliveryRequest.objects.create(
                    batch=b, courier_type=CourierType.DRIVER, requested_by=seller, seller=seller, buyer=buyer,
                    parcel_weight_kg=float(b.gross_weight_g) / 1000 + 0.5, parcel_note="Sealed gold parcel",
                    pickup_lat=seller.latitude, pickup_lng=seller.longitude,
                    pickup_address=f"{seller.organization or seller.get_full_name()} — {seller.district}",
                    dropoff_lat=buyer.latitude, dropoff_lng=buyer.longitude,
                    dropoff_address=f"{buyer.organization or buyer.get_full_name()} — {buyer.district or buyer.region}",
                    distance_km=round(haversine_km(seller.latitude, seller.longitude,
                                                   buyer.latitude, buyer.longitude), 2),
                    status=DeliveryStatus.DELIVERED, courier=None)
            b.current_owner = buyer
            seller = buyer
        if chain:
            if seller.role == Role.REFINERY_OPERATOR:
                b.status = BatchStatus.REFINED
            b.save(update_fields=["current_owner", "status"])

    def _aggregated(self, agg_uname, miner_unames, list_factor):
        """Several miner lots bought (via Tier 2 where needed) and merged by an aggregator."""
        agg = self.u[agg_uname]
        parts = []
        for mu in miner_unames:
            p = self._lot(mu, round(self.rnd.uniform(90, 260), 1), self.rnd.choice([904, 911, 916, 919]),
                          chain=[agg], list_factor=None)
            parts.append(p)
        gross = sum(p.gross_weight_g for p in parts)
        fine = sum(p.fine_weight_g for p in parts)
        fineness = int((fine / gross * 1000).to_integral_value())
        first_mu, m, c = self.miners[miner_unames[0]]
        b = GoldBatch.objects.create(
            miner=m, concession=c, current_owner=agg, created_by=agg, gross_weight_g=gross,
            fine_weight_g=fine, fineness=fineness, is_aggregated=True,
            source_lots=[p.batch_code for p in parts], status=BatchStatus.ASSAYED,
            origin_latitude=parts[0].origin_latitude, origin_longitude=parts[0].origin_longitude,
            source_point=parts[0].source_point, field_notes=f"Aggregated by {agg.organization}")
        b.passport_hash = passport_hash(b)
        b.save(update_fields=["passport_hash"])
        append_custody_event(b, CustodyEventType.ORIGIN, actor=agg, to_party=agg.username,
                             metadata={"aggregated_from": b.source_lots})
        for p in parts:
            p.status = BatchStatus.REFINED  # consumed into the aggregate
            p.field_notes = f"Merged into {b.batch_code}"
            p.save(update_fields=["status", "field_notes"])
        b.listed_for_sale = True
        b.asking_price_ghs = (fine * self.rate * Decimal(str(list_factor))).quantize(Q2, ROUND_HALF_UP)
        b.seal_number = f"GB-SEAL-{self.rnd.randint(100000, 999999)}"
        b.save(update_fields=["listed_for_sale", "asking_price_ghs", "seal_number"])
        return b
