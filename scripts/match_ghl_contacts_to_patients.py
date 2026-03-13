import csv
import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Any

CONTACTS_CSV = Path(
    "/Users/dan/Desktop/highcountrydigital.io/app/ghl-contacts-last-90-days-utm-campaigns.csv"
)
PATIENTS_JSONL = Path(
    "/Users/dan/Desktop/highcountrydigital.io/app/pipeline/client-data/thrive/normalized/chirotouch/new-patients-02-28-2026.patients.jsonld"
)
OUTPUT_CSV = Path(
    "/Users/dan/Desktop/highcountrydigital.io/app/ghl-contacts-matched-patients.csv"
)


def sanitize_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    cleaned = email.strip().lower()
    return cleaned if cleaned else None


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


def iter_jsonl(path: Path) -> Iterable[dict]:
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def load_patients() -> Dict[str, List[dict]]:
    by_phone: Dict[str, List[dict]] = {}
    by_email: Dict[str, List[dict]] = {}

    for patient in iter_jsonl(PATIENTS_JSONL):
        phone = sanitize_phone(patient.get("phone"))
        email = sanitize_email(patient.get("email"))

        if phone:
            by_phone.setdefault(phone, []).append(patient)
        if email:
            by_email.setdefault(email, []).append(patient)

    return {"phone": by_phone, "email": by_email}


def main() -> None:
    patient_indexes = load_patients()
    by_phone = patient_indexes["phone"]
    by_email = patient_indexes["email"]

    with CONTACTS_CSV.open() as f:
        reader = csv.DictReader(f)
        contacts = list(reader)

    fieldnames = list(contacts[0].keys()) + [
        "match_type",
        "matched_value",
        "patient_firstName",
        "patient_lastName",
        "patient_email",
        "patient_phone",
        "patient_firstApt",
        "patient_lastApt",
        "patient_cashCollectedCents",
        "patient_insuranceBalanceCents",
        "patient_patientBalanceCents",
        "patient_externalId",
    ]

    with OUTPUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for contact in contacts:
            contact_phone = sanitize_phone(contact.get("phone"))
            contact_email = sanitize_email(contact.get("email"))

            matched = False

            if contact_phone and contact_phone in by_phone:
                for patient in by_phone[contact_phone]:
                    row = dict(contact)
                    row.update(
                        {
                            "match_type": "phone",
                            "matched_value": contact_phone,
                            "patient_firstName": patient.get("firstName"),
                            "patient_lastName": patient.get("lastName"),
                            "patient_email": patient.get("email"),
                            "patient_phone": patient.get("phone"),
                            "patient_firstApt": patient.get("firstApt"),
                            "patient_lastApt": patient.get("lastApt"),
                            "patient_cashCollectedCents": patient.get(
                                "cashCollectedCents"
                            ),
                            "patient_insuranceBalanceCents": patient.get(
                                "insuranceBalanceCents"
                            ),
                            "patient_patientBalanceCents": patient.get(
                                "patientBalanceCents"
                            ),
                            "patient_externalId": patient.get("externalId"),
                        }
                    )
                    writer.writerow(row)
                    matched = True

            if matched:
                continue

            if contact_email and contact_email in by_email:
                for patient in by_email[contact_email]:
                    row = dict(contact)
                    row.update(
                        {
                            "match_type": "email",
                            "matched_value": contact_email,
                            "patient_firstName": patient.get("firstName"),
                            "patient_lastName": patient.get("lastName"),
                            "patient_email": patient.get("email"),
                            "patient_phone": patient.get("phone"),
                            "patient_firstApt": patient.get("firstApt"),
                            "patient_lastApt": patient.get("lastApt"),
                            "patient_cashCollectedCents": patient.get(
                                "cashCollectedCents"
                            ),
                            "patient_insuranceBalanceCents": patient.get(
                                "insuranceBalanceCents"
                            ),
                            "patient_patientBalanceCents": patient.get(
                                "patientBalanceCents"
                            ),
                            "patient_externalId": patient.get("externalId"),
                        }
                    )
                    writer.writerow(row)


if __name__ == "__main__":
    main()
