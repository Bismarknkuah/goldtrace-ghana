import hashlib
import json


def certificate_hash(cert) -> str:
    payload = {
        "certificate_number": cert.certificate_number,
        "batch": cert.batch.batch_code,
        "passport_hash": cert.batch.passport_hash,
        "destination": cert.destination_country,
        "fine_weight_g": str(cert.fine_weight_g),
        "fineness": cert.fineness,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()
