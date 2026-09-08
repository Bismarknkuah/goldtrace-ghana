"""Anti-smuggling & fraud risk scoring.

Every gold batch is scored against signals derived from data the platform
already holds — the tamper-evident custody chain, GIS concession boundaries,
miner licence status, illegal-mining hotspots, and ledger anchoring. The result
is an explainable risk level that routes the worst cases to enforcement.
"""

SEV_SCORE = {"critical": 100, "high": 38, "medium": 15, "low": 5}

CRITICAL, ELEVATED, WATCH, CLEAR = "critical", "elevated", "watch", "clear"


def evaluate(signals: dict) -> dict:
    """Turn a dict of boolean signals into an explainable risk assessment.

    Signals (True = healthy unless noted):
      chain_valid, origin_in_concession, miner_active, weight_ok, anchored
      near_hotspot (True = risky), duplicate_passport (True = risky)
    Missing/None signals are treated as 'unknown' and not flagged.
    """
    flags = []

    def flag(code, severity, message):
        flags.append({"code": code, "severity": severity, "message": message})

    if signals.get("chain_valid") is False:
        flag("tampered_chain", "critical", "Custody hash chain failed verification.")
    if signals.get("origin_in_concession") is False:
        flag("unlicensed_origin", "high", "Recorded origin falls outside any licensed concession.")
    if signals.get("duplicate_passport"):
        flag("duplicate_passport", "high", "Passport hash is duplicated on another batch.")
    if signals.get("miner_active") is False:
        flag("unlicensed_miner", "high", "Miner licence is not active.")
    if signals.get("weight_ok") is False:
        flag("weight_anomaly", "high", "Fine weight or fineness is implausible.")
    if signals.get("near_hotspot"):
        flag("near_hotspot", "medium", "Origin is near a known illegal-mining hotspot.")
    if signals.get("anchored") is False:
        flag("unanchored", "low", "Custody events are not yet anchored to the ledger.")

    score = min(100, sum(SEV_SCORE[f["severity"]] for f in flags))
    if any(f["severity"] == "critical" for f in flags) or score >= 70:
        level = CRITICAL
    elif score >= 38:
        level = ELEVATED
    elif score >= 15:
        level = WATCH
    else:
        level = CLEAR
    return {"score": score, "level": level, "flags": flags}


def evaluate_participant(signals: dict) -> dict:
    """Score a supply-chain participant for AML risk (KYC, licence, behaviour)."""
    flags = []

    def flag(code, severity, message):
        flags.append({"code": code, "severity": severity, "message": message})

    kyc = signals.get("kyc")
    if kyc == "rejected":
        flag("kyc_rejected", "critical", "KYC/AML screening rejected this party.")
    elif kyc == "flagged":
        flag("kyc_flagged", "high", "KYC/AML screening flagged this party for review.")
    if signals.get("unlicensed"):
        flag("unlicensed_operator", "high", "No valid GoldBod licence for this role.")
    n_irr = signals.get("irregular_transfers", 0)
    if n_irr >= 3:
        flag("many_irregular_transfers", "high", f"{n_irr} transfers outside the GoldBod flow.")
    elif n_irr >= 1:
        flag("irregular_transfers", "medium", f"{n_irr} transfer(s) outside the GoldBod flow.")
    if signals.get("shared_identifiers"):
        flag("shared_identifiers", "high", "Shares directors/address/bank with other operators.")
    if signals.get("volume_anomaly"):
        flag("volume_anomaly", "medium", "Traded volume exceeds expected capacity.")

    score = min(100, sum(SEV_SCORE[f["severity"]] for f in flags))
    if any(f["severity"] == "critical" for f in flags) or score >= 70:
        level = CRITICAL
    elif score >= 38:
        level = ELEVATED
    elif score >= 15:
        level = WATCH
    else:
        level = CLEAR
    return {"score": score, "level": level, "flags": flags}


# ---------------------------------------------------------------------------
# System-wide anomaly detection: cross-entity signals that no single batch or
# participant score would reveal on its own. Each anomaly is explainable and
# carries the entities involved so enforcement can act.
# ---------------------------------------------------------------------------

def detect_anomalies(*, transfers, participants, batch_chains, now=None) -> list[dict]:
    """Return a sorted list of cross-entity anomalies.

    transfers: [{seller_id, seller_name, buyer_id, buyer_name, batch_code,
                 created_at (datetime), irregular (bool)}]
    participants: [{id, username, role, phone, organization, total_gross_g (float)}]
    batch_chains: [{batch_code, owner_sequence: [owner_id,...], chain_valid (bool)}]
    """
    import datetime as _dt
    from collections import Counter, defaultdict

    now = now or _dt.datetime.now(_dt.timezone.utc)
    anomalies = []

    def add(kind, severity, title, detail, entities):
        anomalies.append({"kind": kind, "severity": severity, "title": title,
                          "detail": detail, "entities": entities})

    # 1. Rapid resale / flipping — a batch changing hands many times.
    for bc in batch_chains:
        seq = bc.get("owner_sequence", [])
        if len(seq) >= 4:
            add("flipping", "high", "Rapid resale",
                f"Batch {bc['batch_code']} changed ownership {len(seq)} times — "
                "possible layering to obscure origin.", [bc["batch_code"]])
        # 2. Circular ownership — gold returning to a previous holder.
        seen = set()
        for i, owner in enumerate(seq):
            if owner in seen and (i == 0 or seq[i - 1] != owner):
                add("circular_ownership", "critical", "Circular ownership",
                    f"Batch {bc['batch_code']} returned to a previous owner — "
                    "classic wash-trading pattern.", [bc["batch_code"]])
                break
            seen.add(owner)
        # 3. Broken custody chain.
        if bc.get("chain_valid") is False:
            add("broken_chain", "critical", "Broken custody chain",
                f"Batch {bc['batch_code']} has a broken tamper-evident chain — "
                "records after the break are untrustworthy.", [bc["batch_code"]])

    # 4. Transfer-velocity spike — a seller moving gold unusually fast.
    recent = defaultdict(list)
    irregular_by_seller = Counter()
    for t in transfers:
        ts = t.get("created_at")
        if ts and (now - ts) <= _dt.timedelta(days=7):
            recent[(t["seller_id"], t.get("seller_name"))].append(t)
        if t.get("irregular"):
            irregular_by_seller[(t["seller_id"], t.get("seller_name"))] += 1
    for (sid, sname), rows in recent.items():
        if len(rows) >= 6:
            add("velocity_spike", "high", "Transfer-velocity spike",
                f"{sname or sid} initiated {len(rows)} transfers in 7 days — "
                "far above normal trading cadence.", [sname or str(sid)])

    # 5. Irregular-flow concentration — repeatedly skipping GoldBod stages.
    for (sid, sname), n in irregular_by_seller.items():
        if n >= 3:
            add("irregular_flow", "high", "Irregular-flow concentration",
                f"{sname or sid} made {n} transfers outside the GoldBod flow "
                "(e.g. skipping tiers).", [sname or str(sid)])

    # 6. Shared-identifier ring — operators sharing phone/organization.
    by_phone = defaultdict(list)
    by_org = defaultdict(list)
    for p in participants:
        if p.get("phone"):
            by_phone[p["phone"].strip()].append(p["username"])
        if p.get("organization"):
            by_org[p["organization"].strip().lower()].append(p["username"])
    for phone, users in by_phone.items():
        if len(set(users)) >= 2:
            add("shared_identifiers", "high", "Shared phone number",
                f"{len(set(users))} operators share phone {phone} — possible shell ring.",
                sorted(set(users)))
    for org, users in by_org.items():
        if len(set(users)) >= 3:
            add("shared_identifiers", "medium", "Shared organization",
                f"{len(set(users))} operators share organization '{org}'.", sorted(set(users)))

    # 7. Volume outlier — a miner declaring far more than peers.
    vols = [(p["username"], p.get("total_gross_g") or 0) for p in participants
            if p.get("role") == "miner"]
    grams = sorted(v for _, v in vols if v > 0)
    if len(grams) >= 4:
        median = grams[len(grams) // 2]
        for name, v in vols:
            if median > 0 and v >= median * 4:
                add("volume_outlier", "medium", "Production-volume outlier",
                    f"{name} declared {v:,.0f} g — about {v / median:.1f}x the median "
                    "miner. Verify against physical capacity.", [name])

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    anomalies.sort(key=lambda a: order.get(a["severity"], 9))
    return anomalies


# ---------------------------------------------------------------------------
# AI supervisory layer (vision section 16): specialist agents feed a
# Recommendation agent. Output is advisory only — a human always decides.
# ---------------------------------------------------------------------------

def orchestrate_agents(*, anomalies, licences, transfers, hotspot_regions,
                       stuck_deliveries) -> dict:
    """Run the specialist agents over pre-gathered signals and synthesise
    prioritised, human-in-the-loop recommendations."""
    agents = {"fraud": [], "compliance": [], "risk": [],
              "sustainability": [], "logistics": []}

    for a in anomalies:
        target = "fraud" if a["kind"] in (
            "circular_ownership", "flipping", "broken_chain") else "risk"
        agents[target].append({"severity": a["severity"], "title": a["title"],
                               "detail": a["detail"]})

    for lic in licences:
        if lic["status"] in ("suspended", "revoked"):
            agents["compliance"].append({"severity": "high",
                "title": f"{lic['status'].title()} licence still active in trade",
                "detail": f"{lic['holder']} holds a {lic['status']} licence."})
        elif lic["status"] == "expired":
            agents["compliance"].append({"severity": "medium",
                "title": "Expired licence", "detail": f"{lic['holder']}'s licence has expired."})

    irregular = [t for t in transfers if t.get("irregular")]
    if len(irregular) >= 3:
        agents["compliance"].append({"severity": "medium",
            "title": "Cluster of irregular transfers",
            "detail": f"{len(irregular)} out-of-flow transfers detected."})

    for region in hotspot_regions:
        agents["sustainability"].append({"severity": "medium",
            "title": "Illegal-mining hotspot near production",
            "detail": f"Region {region} shows illegal-mining activity."})

    if stuck_deliveries:
        agents["logistics"].append({"severity": "low",
            "title": "Deliveries in transit too long",
            "detail": f"{stuck_deliveries} bonded shipment(s) exceed expected transit time."})

    # Recommendation agent: synthesise the highest-priority actions.
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recs = []
    for domain, findings in agents.items():
        for f in findings:
            action = {
                "fraud": "Open an intelligence case and freeze the lot pending investigation.",
                "compliance": "Route to enhanced due diligence / suspend trading rights.",
                "risk": "Apply enhanced monitoring to this actor/lot.",
                "sustainability": "Dispatch an environmental officer for inspection.",
                "logistics": "Contact the carrier and verify custody.",
            }[domain]
            recs.append({"agent": domain, "severity": f["severity"],
                         "finding": f["title"], "detail": f["detail"],
                         "recommended_action": action, "requires_human": True})
    recs.sort(key=lambda r: order.get(r["severity"], 9))

    counts = {d: len(v) for d, v in agents.items()}
    return {"agent_findings": counts, "recommendations": recs[:30],
            "total": len(recs)}


def maybe_llm_summary(recommendations: list) -> str | None:
    """Optional Claude enrichment: if ANTHROPIC_API_KEY is set, ask Claude to
    write an executive brief of the recommendations. Safe no-op without a key."""
    import os
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or not recommendations:
        return None
    try:
        import json
        import urllib.request
        top = recommendations[:12]
        prompt = ("You are the GoldBod intelligence briefing agent. In 4-6 sentences, "
                  "summarise the priority actions for the CEO from these findings. "
                  "Be factual and advisory only.\n\n" + json.dumps(top))
        body = json.dumps({"model": "claude-3-5-sonnet-latest", "max_tokens": 400,
                           "messages": [{"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages", data=body,
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read())
        return "".join(b.get("text", "") for b in data.get("content", []))
    except Exception:
        return None
