import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

INPUT_PATH = Path(
    "pipeline/client-data/thrive/raw/ghl/02-27-2026-210307.contacts.jsonld"
)
OUTPUT_PATH = Path("ghl-contacts-last-90-days-utm-campaigns.csv")


def parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Handle Zulu time (e.g., 2026-02-27T16:46:35.233Z)
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def iter_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def is_non_empty(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


def main() -> None:
    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=90)

    fieldnames = [
        "contact_id",
        "contact_name",
        "first_name",
        "last_name",
        "email",
        "phone",
        "date_added",
        "date_updated",
        "utm_campaign_id",
        "utm_campaign",
        "utm_source",
        "utm_medium",
        "utm_content",
        "utm_keyword",
        "page_url",
        "referrer",
        "attribution_index",
        "is_first",
        "is_last",
    ]

    best_by_phone: Dict[str, Dict[str, Any]] = {}
    best_key_by_phone: Dict[str, tuple] = {}

    for record in iter_jsonl(INPUT_PATH):
        date_added_raw = record.get("dateAdded")
        date_added = parse_iso_datetime(date_added_raw)
        if not date_added or date_added < cutoff:
            continue

        phone = record.get("phone")
        if not is_non_empty(phone):
            continue

        attributions = record.get("attributions") or []
        if not isinstance(attributions, list):
            continue

        for idx, attribution in enumerate(attributions):
            if not isinstance(attribution, dict):
                continue
            utm_campaign_id = attribution.get("utmCampaignId")
            if not is_non_empty(utm_campaign_id):
                continue

            row = {
                "contact_id": record.get("id"),
                "contact_name": record.get("contactName"),
                "first_name": record.get("firstName"),
                "last_name": record.get("lastName"),
                "email": record.get("email"),
                "phone": phone,
                "date_added": date_added_raw,
                "date_updated": record.get("dateUpdated"),
                "utm_campaign_id": utm_campaign_id,
                "utm_campaign": attribution.get("utmCampaign"),
                "utm_source": attribution.get("utmSource"),
                "utm_medium": attribution.get("utmMedium"),
                "utm_content": attribution.get("utmContent"),
                "utm_keyword": attribution.get("utmKeyword"),
                "page_url": attribution.get("pageUrl"),
                "referrer": attribution.get("referrer"),
                "attribution_index": idx,
                "is_first": attribution.get("isFirst"),
                "is_last": attribution.get("isLast"),
            }

            # Prefer latest dateAdded, then is_last, then attribution index
            key = (
                date_added,
                bool(attribution.get("isLast")),
                idx,
            )

            existing_key = best_key_by_phone.get(phone)
            if existing_key is None or key > existing_key:
                best_key_by_phone[phone] = key
                best_by_phone[phone] = row

    with OUTPUT_PATH.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for phone in sorted(best_by_phone.keys()):
            writer.writerow(best_by_phone[phone])


if __name__ == "__main__":
    main()
