"""Identity, roles and access control for all 14 GoldBod user types."""
from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "super_admin", "Super Administrator"
    CEO = "ceo", "GoldBod CEO"
    GOLDBOD_OFFICER = "goldbod_officer", "GoldBod Officer"
    MINER = "miner", "Licensed Miner"
    BUYING_AGENT = "buying_agent", "Buying Agent"
    TIER1_BUYER = "tier1_buyer", "Tier 1 Buyer"
    TIER2_BUYER = "tier2_buyer", "Tier 2 Buyer"
    AGGREGATOR = "aggregator", "Aggregator"
    ASSAYER = "assayer", "Assayer"
    REFINERY_OPERATOR = "refinery_operator", "Refinery Operator"
    EXPORTER = "exporter", "Exporter"
    CUSTOMS_OFFICER = "customs_officer", "Customs Officer"
    SECURITY_AGENCY = "security_agency", "Security Agency"
    BOG_OFFICER = "bog_officer", "Bank of Ghana Officer"
    MINISTRY_OFFICIAL = "ministry_official", "Ministry Official"
    ENV_OFFICER = "env_officer", "Environmental Protection Officer"
    INTERNATIONAL_BUYER = "international_buyer", "International Buyer"
    MINING_COMPANY = "mining_company", "Mining Company"
    RIDER = "rider", "Delivery Rider"
    DRIVER = "driver", "Delivery Driver"


# Coarse role groupings used by view-level permissions.
REGULATOR_ROLES = {
    Role.SUPER_ADMIN, Role.CEO, Role.GOLDBOD_OFFICER,
    Role.BOG_OFFICER, Role.MINISTRY_OFFICIAL,
}
ENFORCEMENT_ROLES = {Role.CUSTOMS_OFFICER, Role.SECURITY_AGENCY}


class User(AbstractUser):
    """Custom user. Login is by username; identity is bound to a Ghana Card."""

    role = models.CharField(max_length=32, choices=Role.choices, default=Role.MINER, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    ghana_card_number = models.CharField(max_length=20, blank=True, db_index=True)
    organization = models.CharField(max_length=160, blank=True)
    region = models.CharField(max_length=80, blank=True)
    district = models.CharField(max_length=80, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    is_verified = models.BooleanField(default=False)
    mfa_enabled = models.BooleanField(default=False)
    avatar = models.TextField(blank=True, default="")  # base64 data URL (persists in Mongo)
    company = models.ForeignKey(
        "miners.MiningCompany", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="staff")

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_regulator(self):
        return self.role in {r.value for r in REGULATOR_ROLES}
