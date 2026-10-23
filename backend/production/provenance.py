"""Gold provenance: turn a batch's raw records into an interpretable story.

Answers, in plain language, the questions a regulator, buyer or off-taker asks:
where the gold came from, who produced it, who owns it now, every hand it passed
through, whether it was tested, where it is, and whether its record can be
trusted. Every statement is derived from stored records — nothing is inferred
that the data does not show.
"""
from __future__ import annotations

from decimal import Decimal


def _name(user) -> str:
    if not user:
        return "Unknown party"
    full = f"{user.first_name} {user.last_name}".strip()
    return full or user.username


def _who(user) -> dict | None:
    if not user:
        return None
    return {"name": _name(user), "username": user.username,
            "role": getattr(user, "display_title", None) or user.get_role_display(),
            "region": getattr(user, "region", "") or ""}


def _money(v) -> str | None:
    if v in (None, ""):
        return None
    return f"GHS {Decimal(str(v)):,.2f}"


def _grams(v) -> str | None:
    if v in (None, ""):
        return None
    return f"{Decimal(str(v)):,.3f} g"


def build_provenance(batch, chain: dict, lot_risk: dict) -> dict:
    from exports.models import CertificateStatus
    from gis.ghana import in_ghana, nearest_region, region_centroid
    from pricing.services import current_rate
    from trading.models import OwnershipTransfer, TransferStatus

    miner = batch.miner
    miner_user = miner.user if miner else None
    concession = batch.concession

    # ---- Source -------------------------------------------------------------
    origin = None
    if batch.origin_latitude is not None and in_ghana(batch.origin_latitude, batch.origin_longitude):
        origin = {"lat": batch.origin_latitude, "lng": batch.origin_longitude,
                  "basis": "GPS captured at source"}
    elif (batch.source_point or {}).get("coordinates"):
        lng, lat = batch.source_point["coordinates"][:2]
        if in_ghana(lat, lng):
            origin = {"lat": lat, "lng": lng, "basis": "Recorded extraction point"}
    if origin is None and concession and concession.centroid_lat is not None:
        origin = {"lat": concession.centroid_lat, "lng": concession.centroid_lng,
                  "basis": f"Centre of concession {concession.code}"}
    if origin is None and miner and region_centroid(miner.region):
        lat, lng = region_centroid(miner.region)
        origin = {"lat": lat, "lng": lng, "basis": f"{miner.region} Region (approximate)"}

    region = (miner.region if miner else "") or (
        nearest_region(origin["lat"], origin["lng"]) if origin else "") or "Unknown"
    source = {
        "producer": _who(miner_user),
        "licence_number": miner.license_number if miner else None,
        "licence_status": miner.get_license_status_display() if miner else None,
        "region": region,
        "district": (miner.district if miner else "") or None,
        "concession": ({"code": concession.code, "name": concession.name,
                        "region": concession.region, "area_ha": concession.area_hectares,
                        "active": concession.is_active} if concession else None),
        "origin": origin,
        "registered_at": batch.created_at,
        "registered_by": _who(batch.created_by),
        "aggregated_from": batch.source_lots or [],
    }

    # ---- Assay --------------------------------------------------------------
    try:
        assay_obj = batch.assay
    except Exception:  # RelatedObjectDoesNotExist
        assay_obj = None
    assay = None
    if assay_obj:
        assay = {"certificate_no": assay_obj.certificate_no,
                 "assayer": _who(assay_obj.assayer), "method": assay_obj.get_method_display(),
                 "gross_weight_g": str(assay_obj.gross_weight_g),
                 "fine_weight_g": str(assay_obj.fine_weight_g),
                 "fineness": assay_obj.fineness, "purity_pct": round(assay_obj.fineness / 10, 1),
                 "at": assay_obj.created_at}

    # ---- Ownership chain ----------------------------------------------------
    transfers = list(OwnershipTransfer.objects.filter(batch=batch)
                     .select_related("seller", "buyer").order_by("created_at"))
    completed = [t for t in transfers if t.status == TransferStatus.COMPLETED]
    holders = [{"holder": _who(miner_user) or _who(batch.created_by), "acquired_at": batch.created_at,
                "how": "Produced the gold at source", "price": None, "receipt": None,
                "irregular": False}]
    for t in completed:
        try:
            rcpt = t.receipt
        except Exception:
            rcpt = None
        holders.append({
            "holder": _who(t.buyer), "acquired_at": t.completed_at or t.created_at,
            "how": f"Bought from {_name(t.seller)}", "price": _money(t.price),
            "receipt": rcpt.reference if rcpt else None,
            "irregular": t.irregular,
        })
    for i, h in enumerate(holders):
        h["until"] = holders[i + 1]["acquired_at"] if i + 1 < len(holders) else None
        h["current"] = i == len(holders) - 1
    owner = batch.current_owner
    current_owner = {**(_who(owner) or {}), "since": holders[-1]["acquired_at"] if holders else None} if owner else None
    pending = [{"buyer": _name(t.buyer), "offer": _money(t.price), "at": t.created_at}
               for t in transfers if t.status == TransferStatus.PENDING]

    # ---- Journey (chronological, plain language) ---------------------------
    journey = []

    def step(at, kind, title, sentence, *, actor=None, place=None, ok=True):
        journey.append({"at": at, "kind": kind, "title": title, "sentence": sentence,
                        "actor": actor, "place": place, "ok": ok})

    where = f"{concession.name} ({concession.code}), {region} Region" if concession else f"{region} Region"
    step(batch.created_at, "origin", "Gold registered at source",
         f"{_name(miner_user)} (licence {source['licence_number']}) registered "
         f"{_grams(batch.gross_weight_g)} of gold mined at {where}.",
         actor=_name(batch.created_by or miner_user), place=origin)
    if batch.is_aggregated and batch.source_lots:
        step(batch.created_at, "aggregate", "Combined from smaller lots",
             f"This lot was formed by combining {len(batch.source_lots)} lots "
             f"({', '.join(batch.source_lots[:6])}); their origins remain on record.")
    if assay:
        step(assay["at"], "assay", "Tested by an assayer",
             f"{assay['assayer']['name'] if assay['assayer'] else 'An assayer'} tested the gold by "
             f"{assay['method']}: {assay['purity_pct']}% pure, {_grams(assay['fine_weight_g'])} of fine gold "
             f"(certificate {assay['certificate_no']}).", actor=assay["assayer"]["name"] if assay["assayer"] else None)
    for t in transfers:
        if t.status == TransferStatus.COMPLETED:
            step(t.completed_at or t.created_at, "sale", "Ownership changed hands",
                 f"{_name(t.seller)} sold the gold to {_name(t.buyer)} "
                 f"({t.buyer.get_role_display()})" + (f" for {_money(t.price)}." if t.price else ".")
                 + (" This sale skipped the normal GoldBod trading order." if t.irregular else ""),
                 actor=_name(t.buyer), ok=not t.irregular)
        elif t.status == TransferStatus.PENDING:
            step(t.created_at, "offer", "Purchase request pending",
                 f"{_name(t.buyer)} asked to buy this gold" + (f" for {_money(t.price)}" if t.price else "")
                 + "; it is waiting for the seller's approval.", actor=_name(t.buyer))
    for dlv in batch.deliveries.order_by("created_at"):
        step(dlv.created_at, "transport", "Secure transport arranged",
             f"Bonded transport from {dlv.pickup_address or 'pickup'} to {dlv.dropoff_address or 'drop-off'}"
             f" ({dlv.distance_km:.1f} km)" + (f", sealed with {dlv.seal_number}" if dlv.seal_number else "")
             + f". Status: {dlv.get_status_display()}.",
             place={"lat": dlv.pickup_lat, "lng": dlv.pickup_lng})
    if batch.refine_input_g is not None:
        step(batch.updated_at, "refine", "Refined",
             f"Refinery received {_grams(batch.refine_input_g)} and produced {_grams(batch.refine_output_g)}. "
             + ("Weights reconciled." if batch.mass_balance_ok else "Weights did NOT reconcile — a fraud case was opened."),
             ok=bool(batch.mass_balance_ok))
    for c in batch.export_certificates.order_by("created_at"):
        step(c.issued_at or c.created_at, "export", "Export certificate",
             f"Export certificate {c.certificate_number} for {_grams(c.fine_weight_g)} fine gold to "
             f"{c.destination_country} — {c.get_status_display()}.",
             ok=c.status != CertificateStatus.REVOKED)
    for inc in batch.incidents.order_by("created_at"):
        step(inc.created_at, "incident", f"Security: {inc.get_incident_type_display()}",
             f"{inc.get_incident_type_display()} reported"
             + (f" by {_name(inc.reported_by)}" if inc.reported_by else "")
             + f". Status now: {inc.get_status_display()}." + (f" Note: {inc.note}" if inc.note else ""),
             ok=False,
             place=({"lat": inc.last_seen_lat, "lng": inc.last_seen_lng} if inc.last_seen_lat is not None else None))
    journey.sort(key=lambda s: s["at"])

    # ---- Location trail for the map ----------------------------------------
    trail = []
    if origin:
        trail.append({**origin, "label": "Origin", "kind": "origin"})
    for dlv in batch.deliveries.order_by("created_at"):
        trail.append({"lat": dlv.pickup_lat, "lng": dlv.pickup_lng, "label": f"Pickup · {dlv.pickup_address}", "kind": "pickup"})
        if dlv.courier_lat is not None:
            trail.append({"lat": dlv.courier_lat, "lng": dlv.courier_lng, "label": "Courier (last reported)", "kind": "courier"})
        trail.append({"lat": dlv.dropoff_lat, "lng": dlv.dropoff_lng, "label": f"Drop-off · {dlv.dropoff_address}", "kind": "dropoff"})
    for inc in batch.incidents.all():
        if inc.last_seen_lat is not None:
            trail.append({"lat": inc.last_seen_lat, "lng": inc.last_seen_lng, "label": f"Last seen ({inc.get_incident_type_display()})", "kind": "incident"})
    trail = [p for p in trail if in_ghana(p["lat"], p["lng"])]

    # ---- Value --------------------------------------------------------------
    rate = current_rate()
    fine = batch.fine_weight_g or (Decimal(str(batch.gross_weight_g)) * Decimal(batch.fineness) / 1000
                                   if batch.fineness else None)
    value = {"reference_rate": _money(rate), "fine_weight": _grams(fine),
             "reference_value": _money(Decimal(str(fine)) * rate) if fine else None,
             "basis": "Fine gold × Bank of Ghana reference rate" if fine else "Not yet assayed — value unknown"}

    # ---- Verdict ------------------------------------------------------------
    reasons_bad, reasons_warn, reasons_good = [], [], []
    if not chain["valid"]:
        reasons_bad.append("The tamper-evident custody record is broken.")
    else:
        reasons_good.append(f"All {chain.get('length', 0)} custody records are intact and unaltered.")
    if batch.security_status in ("stolen", "missing"):
        reasons_bad.append(f"The gold has been reported {batch.security_status}.")
    elif batch.security_status == "flagged":
        reasons_warn.append("The gold carries a security flag under review.")
    if miner and miner.license_status != "active":
        reasons_warn.append(f"The producer's licence is {miner.get_license_status_display().lower()}.")
    elif miner:
        reasons_good.append("The producer holds an active GoldBod licence.")
    if not assay and not batch.fineness:
        reasons_warn.append("Purity has not yet been verified by an assayer.")
    elif assay:
        reasons_good.append(f"Purity verified by assay ({assay['purity_pct']}%).")
    if any(t.irregular for t in completed):
        reasons_warn.append("At least one sale skipped the normal GoldBod trading order.")
    if batch.mass_balance_ok is False:
        reasons_bad.append("Refinery weights did not reconcile.")
    if not origin or origin["basis"].endswith("(approximate)"):
        reasons_warn.append("No precise GPS origin was captured — origin is approximate.")
    else:
        reasons_good.append(f"Origin location is on record ({origin['basis'].lower()}).")

    # ---- Responsible sourcing: could it come from illegal mining? -----------
    try:
        from gis.sourcing import source_check
        sourcing = source_check(batch)
    except Exception:  # pragma: no cover - never let sourcing break tracing
        sourcing = {"status": "unverified", "message": "Mine-site check unavailable."}
    if sourcing["status"] == "illegal":
        reasons_bad.append(sourcing["message"])
    elif sourcing["status"] in ("outside", "suspect"):
        reasons_warn.append(sourcing["message"])
    elif sourcing["status"] == "verified":
        reasons_good.append(sourcing["message"])

    if reasons_bad:
        level, headline = "compromised", "Do not trade — this gold's record cannot be trusted."
    elif reasons_warn or lot_risk.get("band") in ("high", "critical"):
        level, headline = "caution", "Traceable, but needs checks before trading."
    else:
        level, headline = "trusted", "Fully traceable — origin, ownership and custody check out."

    # ---- Current position (actual, not the planned destination) -------------
    pos = None
    if batch.security_status in ("stolen", "missing"):
        seen = [p for p in trail if p["kind"] == "incident"]
        pos = seen[-1] if seen else None
    if pos is None:
        latest = batch.deliveries.order_by("created_at")
        latest = latest[len(latest) - 1] if len(latest) else None
        if latest is not None:
            st = getattr(latest, "status", "")
            if st == "delivered":
                pos = {"lat": latest.dropoff_lat, "lng": latest.dropoff_lng,
                       "label": f"delivered to {latest.dropoff_address or 'drop-off'}"}
            elif latest.courier_lat is not None and st not in ("cancelled",):
                pos = {"lat": latest.courier_lat, "lng": latest.courier_lng,
                       "label": f"with the courier, en route to {latest.dropoff_address or 'drop-off'}"}
            elif st not in ("cancelled",):
                pos = {"lat": latest.pickup_lat, "lng": latest.pickup_lng,
                       "label": f"awaiting pickup at {latest.pickup_address or 'pickup'}"}
    if pos is None and origin:
        pos = {**origin, "label": "at origin — no movement recorded since registration"}
    if pos is not None and not in_ghana(pos["lat"], pos["lng"]):
        pos = None

    # ---- Direct answers -----------------------------------------------------
    answers = [
        {"q": "Where did this gold come from?",
         "a": f"{where}." + ((f" Approximate position (regional capital): {origin['lat']:.4f}, {origin['lng']:.4f}."
                              if origin['basis'].endswith('(approximate)') else
                              f" {origin['basis']}: {origin['lat']:.5f}, {origin['lng']:.5f}.") if origin else "")},
        {"q": "Who produced it?",
         "a": f"{_name(miner_user)}, licence {source['licence_number']} ({source['licence_status']})."},
        {"q": "Who owns it now?",
         "a": (f"{current_owner['name']} ({current_owner['role']})" if current_owner else "No current owner recorded")
              + (f", since {current_owner['since']:%d %b %Y}." if current_owner and current_owner.get('since') else ".")},
        {"q": "How many hands has it passed through?",
         "a": f"{len(holders)} holder{'s' if len(holders) != 1 else ''}: "
              + " → ".join(h["holder"]["name"] for h in holders if h["holder"]) + "."},
        {"q": "Has it been tested?",
         "a": (f"Yes — {assay['purity_pct']}% pure by {assay['method']} ({assay['certificate_no']})."
               if assay else ("Purity declared but not independently assayed." if batch.fineness else "Not yet."))},
        {"q": "Where is it now?",
         "a": (f"Last known position {pos['lat']:.5f}, {pos['lng']:.5f} — {pos.get('label') or pos.get('basis')}."
               if pos else "No location on record.") + f" Status: {batch.get_status_display()}."},
        {"q": "Has anyone tampered with it?",
         "a": "No — the custody record is intact." if chain["valid"] and batch.security_status == "normal"
              else "Yes — see the security and tamper details below."},
        {"q": "What is it worth?", "a": value["reference_value"] or value["basis"]},
        {"q": "Could it come from illegal mining (galamsey)?",
         "a": {"verified": "Unlikely — ", "illegal": "Yes, high risk — ", "outside": "Possibly — ",
               "suspect": "Possibly — ", "unverified": "Cannot tell — "}.get(sourcing["status"], "")
              + sourcing["message"]},
    ]

    return {"verdict": {"level": level, "headline": headline,
                        "problems": reasons_bad, "warnings": reasons_warn, "assurances": reasons_good},
            "answers": answers, "source": source, "assay": assay,
            "current_owner": current_owner, "owners": holders, "pending_offers": pending,
            "journey": journey, "trail": trail, "value": value, "position": pos,
            "sourcing": sourcing}
