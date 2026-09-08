"""Seed a complete demo: one user per role, plus a full mine->trade->export trail.

Usage (needs a reachable MongoDB / Atlas):  python manage.py seed_demo
All demo accounts share the password below.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Role
from exports.models import ExportCertificate
from exports.services import certificate_hash
from gis.models import Hotspot, Severity
from miners.models import Concession, LicenseStatus, Miner, MiningCompany
from datetime import date, timedelta

from production.models import (Assay, AssayMethod, BatchStatus, CustodyEventType,
                               GoldBatch, SecurityStatus)
from licensing.models import License, LicenseStatus, LicenseType
from pricing.models import ReferenceRate
from core.supply_chain import resolve_stage
from security.models import SecurityIncident, IncidentType
from compliance.models import DueDiligence, KycScreening
from compliance.services import screen_party
from production.services import append_custody_event, build_qr, passport_hash, passport_url
from trading.models import OwnershipTransfer, PaymentReceipt, TransferStatus
from logistics.models import (Courier, CourierStatus, CourierType,
                              DeliveryRequest, DeliveryStatus)
from logistics.services import estimate_eta_minutes, estimate_price
from gis.services import haversine_km

User = get_user_model()

DEMO_PASSWORD = "Goldtrace2026!"

# (username, role, first_name) — one demo account for every GoldBod user type.
DEMO_ACCOUNTS = [
    ("super.admin", Role.SUPER_ADMIN, "Super"),
    ("goldbod.ceo", Role.CEO, "CEO"),
    ("goldbod.officer", Role.GOLDBOD_OFFICER, "Officer"),
    ("kofi.miner", Role.MINER, "Kofi"),
    ("buying.agent", Role.BUYING_AGENT, "Buying"),
    ("assayer", Role.ASSAYER, "Assay"),
    ("refinery.op", Role.REFINERY_OPERATOR, "Refinery"),
    ("ama.exporter", Role.EXPORTER, "Ama"),
    ("customs.officer", Role.CUSTOMS_OFFICER, "Customs"),
    ("security.agency", Role.SECURITY_AGENCY, "Security"),
    ("bog.officer", Role.BOG_OFFICER, "BoG"),
    ("ministry.official", Role.MINISTRY_OFFICIAL, "Ministry"),
    ("env.officer", Role.ENV_OFFICER, "EPA"),
    ("intl.buyer", Role.INTERNATIONAL_BUYER, "Buyer"),
    ("rider.one", Role.RIDER, "Kwesi"),
    ("driver.one", Role.DRIVER, "Yaw"),
    ("tier1.buyer", Role.TIER1_BUYER, "Kojo"),
    ("tier2.buyer", Role.TIER2_BUYER, "Adjoa"),
    ("aggregator", Role.AGGREGATOR, "Ashanti Aggregators"),
    ("mining.company", Role.MINING_COMPANY, "Obuasi Holdings"),
]

BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[
        [-1.70, 6.18], [-1.64, 6.18], [-1.64, 6.23], [-1.70, 6.23], [-1.70, 6.18],
    ]],
}
SOURCE_POINT = {"type": "Point", "coordinates": [-1.67, 6.20]}


class Command(BaseCommand):
    help = "Create one demo user per role and a full traceability trail with GIS data."

    def handle(self, *args, **options):
        # Idempotent: safe to run on every deploy — seeds once, then skips.
        if User.objects.filter(username="super.admin").exists():
            self.stdout.write(self.style.WARNING("Demo data already present — skipping seed."))
            return
        users = {}
        for username, role, first_name in DEMO_ACCOUNTS:
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={"role": role, "first_name": first_name, "is_verified": True})
            user.role = role
            user.first_name = first_name
            user.is_verified = True
            if username == "super.admin":
                user.is_staff = True
                user.is_superuser = True
            user.set_password(DEMO_PASSWORD)
            user.save()
            users[username] = user

        miner_user = users["kofi.miner"]
        exporter_user = users["ama.exporter"]
        agg_user = users["aggregator"]

        miner, _ = Miner.objects.get_or_create(
            user=miner_user,
            defaults={"license_number": "SSM-2024-00831", "region": "Ashanti",
                      "license_status": LicenseStatus.ACTIVE})

        concession, _ = Concession.objects.get_or_create(
            code="CON-ASH-014",
            defaults={"miner": miner, "name": "Obuasi Block 14", "region": "Ashanti",
                      "area_hectares": 248.0, "boundary": BOUNDARY,
                      "centroid_lat": 6.205, "centroid_lng": -1.67})

        company, _ = MiningCompany.objects.get_or_create(
            registration_no="MC-ASH-0007",
            defaults={"name": "Ashanti Goldfields Ltd", "region": "Ashanti",
                      "contact_email": "ops@ashantigold.example"})
        if miner.company_id is None:
            miner.company = company
            miner.save(update_fields=["company"])
        mc_user = users["mining.company"]
        if mc_user.company_id is None:
            mc_user.company = company
            mc_user.save(update_fields=["company"])

        batch = GoldBatch.objects.create(
            miner=miner, concession=concession, current_owner=miner_user,
            created_by=miner_user, gross_weight_g=Decimal("1250.500"),
            fine_weight_g=Decimal("1145.46"), fineness=916, source_point=SOURCE_POINT)
        batch.passport_hash = passport_hash(batch)
        batch.qr_image = build_qr(passport_url(batch), f"{batch.batch_code}.png")
        batch.save(update_fields=["passport_hash", "qr_image"])
        append_custody_event(batch, CustodyEventType.ORIGIN, actor=miner_user,
                             to_party=miner.license_number)

        _stage, _reg = resolve_stage(miner_user.role, agg_user.role)
        transfer = OwnershipTransfer.objects.create(
            batch=batch, seller=miner_user, buyer=agg_user,
            price=Decimal("900000.00"), currency="GHS",
            stage=_stage, irregular=not _reg)
        append_custody_event(batch, CustodyEventType.TRANSFER, actor=agg_user,
                             from_party=str(miner_user), to_party=str(agg_user))
        batch.current_owner = agg_user
        batch.status = BatchStatus.IN_TRANSIT
        batch.save(update_fields=["current_owner", "status"])
        transfer.status = TransferStatus.COMPLETED
        transfer.completed_at = timezone.now()
        transfer.save()

        cert = ExportCertificate.objects.create(
            batch=batch, exporter=exporter_user,
            destination_country="United Arab Emirates",
            fine_weight_g=batch.fine_weight_g, fineness=batch.fineness)
        from exports.models import CertificateStatus
        from django.utils import timezone as _tz
        cert.certificate_hash = certificate_hash(cert)
        cert.status = CertificateStatus.ISSUED
        cert.issued_by = exporter_user
        cert.issued_at = _tz.now()
        cert.save(update_fields=["certificate_hash", "status", "issued_by", "issued_at"])

        for title, lat, lng, sev in [
            ("Unlicensed pit — Anyinam", 6.27, -1.61, Severity.HIGH),
            ("River siltation — Offin", 6.15, -1.73, Severity.MEDIUM),
        ]:
            Hotspot.objects.get_or_create(
                title=title, defaults={"latitude": lat, "longitude": lng,
                                        "severity": sev, "region": "Ashanti", "source": "satellite"})

        # Payment receipt (buyer -> seller) for the completed transfer.
        PaymentReceipt.objects.get_or_create(
            transfer=transfer,
            defaults={"payer": agg_user, "payee": miner_user,
                      "amount": transfer.price, "currency": "GHS"})

        # Couriers: one rider and one driver, online and near the store.
        rider, _ = Courier.objects.get_or_create(
            user=users["rider.one"],
            defaults={"courier_type": CourierType.RIDER, "status": CourierStatus.AVAILABLE,
                      "plate_number": "M-2291-24", "phone": "+233201112222",
                      "max_weight_kg": 20, "current_lat": 6.205, "current_lng": -1.665,
                      "is_bonded": True, "company": "Ashanti Bullion Logistics", "registration_no": "BC-0192"})
        driver, _ = Courier.objects.get_or_create(
            user=users["driver.one"],
            defaults={"courier_type": CourierType.DRIVER, "status": CourierStatus.AVAILABLE,
                      "plate_number": "GR-5567-23", "phone": "+233203334444",
                      "max_weight_kg": 500, "current_lat": 6.190, "current_lng": -1.690,
                      "is_bonded": True, "company": "Ghana Secure Convoy Ltd", "registration_no": "BC-0247"})

        # A sample delivery from the store to the buyer, offered to the rider.
        pickup = (6.205, -1.67)   # concession centroid
        dropoff = (6.688, -1.622)  # buyer in Kumasi
        dist = haversine_km(*pickup, *dropoff)
        DeliveryRequest.objects.get_or_create(
            batch=batch, courier_type=CourierType.RIDER,
            defaults={
                "requested_by": miner_user, "seller": miner_user, "buyer": exporter_user,
                "parcel_weight_kg": 1.2, "parcel_note": "Sealed gold parcel",
                "pickup_lat": pickup[0], "pickup_lng": pickup[1], "pickup_address": "Obuasi Block 14",
                "dropoff_lat": dropoff[0], "dropoff_lng": dropoff[1], "dropoff_address": "Kumasi buyer office",
                "distance_km": round(dist, 2),
                "price_ghs": estimate_price("rider", dist, 1.2),
                "eta_minutes": estimate_eta_minutes("rider", dist),
                "status": DeliveryStatus.OFFERED, "courier": rider})

        # A second batch reported stolen — populates the security console.
        theft_batch = GoldBatch.objects.create(
            miner=miner, concession=concession, current_owner=miner_user,
            created_by=miner_user, gross_weight_g=Decimal("420.000"),
            fine_weight_g=Decimal("384.72"), fineness=916, source_point=SOURCE_POINT)
        theft_batch.passport_hash = passport_hash(theft_batch)
        theft_batch.qr_image = build_qr(passport_url(theft_batch), f"{theft_batch.batch_code}.png")
        theft_batch.save(update_fields=["passport_hash", "qr_image"])
        append_custody_event(theft_batch, CustodyEventType.ORIGIN, actor=miner_user,
                             to_party=miner.license_number)
        if not theft_batch.incidents.exists():
            SecurityIncident.objects.create(
                batch=theft_batch, incident_type=IncidentType.STOLEN,
                note="Parcel unaccounted for after transit checkpoint",
                reported_by=users["security.agency"])
            theft_batch.security_status = SecurityStatus.STOLEN
            theft_batch.save(update_fields=["security_status"])

        # KYC/AML screenings + responsible-sourcing attestation.
        for nm, ctry in [("Global Bullion DMCC", "United Arab Emirates"),
                         ("Sanctioned Trading Co", "Ghana")]:
            if not KycScreening.objects.filter(subject_name=nm).exists():
                verdict = screen_party(nm, ctry)
                KycScreening.objects.create(
                    subject_name=nm, country=ctry,
                    screened_by=users["goldbod.officer"], **verdict)
        DueDiligence.objects.get_or_create(batch=batch, defaults={
            "origin_verified": True, "conflict_free": True, "oecd_conformant": True,
            "oecd_step": 5,
            "statement": "OECD 5-step due diligence complete; conflict-free origin verified.",
            "attested_by": users["goldbod.officer"]})

        # GoldBod licences for participants (public via the License Registry).
        for holder, ltype in [
            (users["tier1.buyer"], LicenseType.TIER1_BUYER),
            (users["tier2.buyer"], LicenseType.TIER2_BUYER),
            (users["aggregator"], LicenseType.AGGREGATOR),
            (users["ama.exporter"], LicenseType.EXPORTER),
            (users["refinery.op"], LicenseType.REFINER),
        ]:
            if not License.objects.filter(holder=holder, license_type=ltype).exists():
                License.objects.create(
                    holder=holder, license_type=ltype, status=LicenseStatus.ACTIVE,
                    region="Ashanti", working_capital_ghs=Decimal("100000"),
                    trade_capital_ghs=Decimal("100000"),
                    expires_at=date.today() + timedelta(days=365),
                    issued_by=users["goldbod.officer"])

        # Bank of Ghana reference rate.
        if not ReferenceRate.objects.exists():
            ReferenceRate.objects.create(rate_ghs_per_g=Decimal("920.00"),
                                         set_by=users["bog.officer"])

        # Assay record for the main batch.
        if not Assay.objects.filter(batch=batch).exists():
            Assay.objects.create(
                batch=batch, assayer=users["assayer"], method=AssayMethod.XRF,
                gross_weight_g=batch.gross_weight_g,
                fine_weight_g=batch.fine_weight_g or Decimal("1145.46"),
                fineness=batch.fineness or 916, remarks="XRF assay at GoldBod assay centre")

        # An irregular transfer that skips the licensed chain -> surfaces as AML risk.
        if not OwnershipTransfer.objects.filter(batch=theft_batch, irregular=True).exists():
            _s2, _r2 = resolve_stage(miner_user.role, exporter_user.role)
            OwnershipTransfer.objects.create(
                batch=theft_batch, seller=miner_user, buyer=exporter_user,
                price=Decimal("300000.00"), currency="GHS", stage=_s2, irregular=not _r2,
                status=TransferStatus.COMPLETED, completed_at=timezone.now())

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(users)} role accounts (password '{DEMO_PASSWORD}'), "
            f"batch {batch.batch_code} -> cert {cert.certificate_number}, "
            f"concession {concession.code}, 2 hotspots"))
