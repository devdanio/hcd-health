import csv
import json
from pathlib import Path
from typing import Dict, List, Optional

LEADS_PATH = Path("thrive-chat-leads-with-utms.json")
PATIENTS_PATH = Path(
    "pipeline/client-data/thrive/normalized/chirotouch/new-patients-02-28-2026.patients.jsonld"
)
OUTPUT_PATH = Path("thrive-patients-from-paid-chat.csv")


def sanitize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    trimmed = phone.strip()
    if not trimmed:
        return None

    has_plus = trimmed.startswith("+")
    has_double_zero = trimmed.startswith("00")
    digits = "".join(ch for ch in trimmed if ch.isdigit())

    if has_plus or has_double_zero:
        if len(digits) < 8 or len(digits) > 15:
            return None
        return f"+{digits}"

    if len(digits) == 10:
        return f"+1{digits}"

    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"

    return None


def load_patients_by_phone(path: Path) -> Dict[str, List[dict]]:
    patients_by_phone: Dict[str, List[dict]] = {}
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            normalized = sanitize_phone(record.get("phone"))
            if not normalized:
                continue
            patients_by_phone.setdefault(normalized, []).append(record)
    return patients_by_phone


def main() -> None:
    leads = json.loads(LEADS_PATH.read_text())
    patients_by_phone = load_patients_by_phone(PATIENTS_PATH)

    fieldnames = [
        "lead_name",
        "lead_phone_raw",
        "lead_phone_normalized",
        "lead_posthog_id",
        "lead_contact_created",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_keyword",
        "landing_page",
        "first_seen",
        "patient_firstName",
        "patient_lastName",
        "patient_email",
        "patient_phone_raw",
        "patient_phone_normalized",
        "firstApt",
        "lastApt",
        "cashCollectedCents",
        "insuranceBalanceCents",
        "patientBalanceCents",
        "externalId",
    ]

    with OUTPUT_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for lead in leads:
            lead_phone_raw = lead.get("phone")
            lead_phone_normalized = sanitize_phone(lead_phone_raw)
            if not lead_phone_normalized:
                continue

            matches = patients_by_phone.get(lead_phone_normalized)
            if not matches:
                continue

            for patient in matches:
                patient_phone_raw = patient.get("phone")
                patient_phone_normalized = sanitize_phone(patient_phone_raw)
                row = {
                    "lead_name": lead.get("name"),
                    "lead_phone_raw": lead_phone_raw,
                    "lead_phone_normalized": lead_phone_normalized,
                    "lead_posthog_id": lead.get("posthog_id"),
                    "lead_contact_created": lead.get("contact_created"),
                    "utm_source": lead.get("utm_source"),
                    "utm_medium": lead.get("utm_medium"),
                    "utm_campaign": lead.get("utm_campaign"),
                    "utm_content": lead.get("utm_content"),
                    "utm_keyword": lead.get("utm_keyword"),
                    "landing_page": lead.get("landing_page"),
                    "first_seen": lead.get("first_seen"),
                    "patient_firstName": patient.get("firstName"),
                    "patient_lastName": patient.get("lastName"),
                    "patient_email": patient.get("email"),
                    "patient_phone_raw": patient_phone_raw,
                    "patient_phone_normalized": patient_phone_normalized,
                    "firstApt": patient.get("firstApt"),
                    "lastApt": patient.get("lastApt"),
                    "cashCollectedCents": patient.get("cashCollectedCents"),
                    "insuranceBalanceCents": patient.get("insuranceBalanceCents"),
                    "patientBalanceCents": patient.get("patientBalanceCents"),
                    "externalId": patient.get("externalId"),
                }
                writer.writerow(row)


if __name__ == "__main__":
    main()
