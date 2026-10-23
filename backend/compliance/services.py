"""KYC/AML screening logic and the responsible-sourcing rule (both testable)."""

# Demo watchlists — a production system integrates OFAC/UN/EU sanctions feeds.
SANCTIONS = {"sanctioned trading co", "blocked entity ltd"}
PEPS = {"minister x", "governor y"}
HIGH_RISK_COUNTRIES = {"north korea", "iran", "syria", "myanmar"}


def screen_party(name: str, country: str = "") -> dict:
    n = (name or "").strip().lower()
    c = (country or "").strip().lower()
    sanctions_hit = n in SANCTIONS
    pep = n in PEPS
    high_risk_country = c in HIGH_RISK_COUNTRIES

    if sanctions_hit:
        status, rating = "rejected", "high"
    elif high_risk_country:
        status, rating = "flagged", "high"
    elif pep:
        status, rating = "flagged", "medium"
    else:
        status, rating = "cleared", "low"
    return {"sanctions_hit": sanctions_hit, "pep": pep,
            "risk_rating": rating, "status": status}


def responsible_sourcing_ok(origin_verified: bool, conflict_free: bool,
                            oecd_conformant: bool) -> bool:
    return bool(origin_verified and conflict_free and oecd_conformant)
