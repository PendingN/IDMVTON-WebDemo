from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path
from urllib.request import urlopen

try:
    from .database import init_database, insert_trend_snapshot, upsert_style_trend
except ImportError:
    from database import init_database, insert_trend_snapshot, upsert_style_trend


def load_rows(input_path: str = "", url: str = "") -> list[dict]:
    if url:
        with urlopen(url, timeout=30) as response:
            raw = response.read().decode("utf-8-sig")
            content_type = response.headers.get("Content-Type", "")
        return parse_rows(raw, content_type=content_type, source_name=url)

    if not input_path:
        raise ValueError("Provide either --input or --url.")

    path = Path(input_path)
    raw = path.read_text(encoding="utf-8-sig")
    return parse_rows(raw, content_type="", source_name=path.name)


def parse_rows(raw: str, content_type: str, source_name: str) -> list[dict]:
    is_json = "json" in content_type or source_name.lower().endswith(".json")
    if is_json:
        payload = json.loads(raw)
        if isinstance(payload, dict):
            for key in ("items", "trends", "data", "results"):
                if isinstance(payload.get(key), list):
                    return [item for item in payload[key] if isinstance(item, dict)]
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        raise ValueError("JSON payload must be a list or contain items/trends/data/results.")

    return list(csv.DictReader(raw.splitlines()))


def pick(row: dict, *keys: str, default: str = "") -> str:
    for key in keys:
        value = row.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return default


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or "trend"


def parse_list(value: str) -> list[str]:
    if not value:
        return []
    try:
        payload = json.loads(value)
        if isinstance(payload, list):
            return [str(item).strip() for item in payload if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [item.strip() for item in re.split(r"[,;|]", value) if item.strip()]


def parse_colors(value: str) -> list[dict[str, str]]:
    colors = []
    for item in parse_list(value):
        if ":" in item:
            label, color = item.split(":", 1)
            colors.append({"label": label.strip(), "value": color.strip()})
        else:
            colors.append({"label": item, "value": item})
    return colors


def import_rows(args: argparse.Namespace) -> int:
    init_database()
    rows = load_rows(input_path=args.input, url=args.url)
    imported = 0
    for row in rows:
        keyword = pick(row, "keyword", "query", "term", "name", "hashtag", "title")
        if not keyword:
            continue
        score = pick(row, "score", "value", "growth", "rank", default="0")
        try:
            score_value = float(str(score).replace("%", "").replace(",", "."))
        except ValueError:
            score_value = 0
        insert_trend_snapshot(
            source_slug=args.source_slug,
            source_name=args.source_name,
            source_type=args.source_type,
            keyword=keyword,
            season=args.season,
            region=args.region,
            score=score_value,
            growth_label=pick(row, "growth_label", "growthText", "change", "rising"),
            source_url=pick(row, "source_url", "url", default=args.url),
            raw_payload=row,
            status=args.status,
        )
        if args.publish_style_cards:
            title = pick(row, "style_title", "title", "name", default=keyword)
            summary = pick(row, "summary", "description", "note", default=f"Trend candidate: {keyword}")
            related_keywords = parse_list(pick(row, "keywords", "related_keywords", "terms"))
            keywords = related_keywords if related_keywords else [keyword]
            source_url = pick(row, "source_url", "url", default=args.url)
            upsert_style_trend(
                slug=f"{args.season}-{args.region.lower()}-{slugify(title)}",
                season=args.season,
                region=args.region,
                title=title,
                summary=summary,
                keywords=keywords,
                colors=parse_colors(pick(row, "colors", "palette")),
                score=score_value,
                source_label=args.source_name,
                source_url=source_url,
                status="published",
            )
        imported += 1
    return imported


def main() -> None:
    parser = argparse.ArgumentParser(description="Import fashion trend candidates into the IDM-VTON SQLite DB.")
    parser.add_argument("--input", default="", help="Path to a CSV or JSON export.")
    parser.add_argument("--url", default="", help="URL returning CSV or JSON rows.")
    parser.add_argument("--source-slug", default="manual-trend-import")
    parser.add_argument("--source-name", default="Manual trend import")
    parser.add_argument("--source-type", default="csv_or_json")
    parser.add_argument("--season", default="summer")
    parser.add_argument("--region", default="VN")
    parser.add_argument("--status", default="draft", choices=["draft", "reviewed", "published"])
    parser.add_argument(
        "--publish-style-cards",
        action="store_true",
        help="Also promote imported rows into published style cards for /api/trends.",
    )
    args = parser.parse_args()

    imported = import_rows(args)
    print(f"Imported {imported} trend candidate(s).")


if __name__ == "__main__":
    main()
