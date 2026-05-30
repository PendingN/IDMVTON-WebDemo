from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable


WEB_DEMO_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = WEB_DEMO_DIR / "data" / "idmvton.db"

PRODUCT_BLUEPRINTS = [
    {
        "slug": "compact-polo",
        "name": "Polo Dáng Gọn",
        "price": "890.000đ",
        "description": "Cổ polo đứng phom, chất vải mịn và bảng màu dễ mặc cho lịch làm việc lẫn cuối tuần.",
        "labels": ["Mực", "Sương", "Đá"],
        "colors": ["#243651", "#d9ddd8", "#d8d0c3"],
    },
    {
        "slug": "graphic-tee",
        "name": "Áo Thun Họa Tiết",
        "price": "720.000đ",
        "description": "Áo thun mềm, hình in sắc nét, tạo điểm nhấn vừa đủ cho những set đồ tối giản.",
        "labels": ["Đỏ", "Đen", "Nắng"],
        "colors": ["#ef4a4a", "#1c1c1c", "#ffd963"],
    },
    {
        "slug": "studio-shirt",
        "name": "Sơ Mi Studio",
        "price": "1.050.000đ",
        "description": "Sơ mi tối giản, đường cắt sạch và đủ trang trọng để mặc đi làm hoặc gặp khách.",
        "labels": ["Mây", "Navy", "Đất"],
        "colors": ["#f2eee8", "#334766", "#c98f7d"],
    },
    {
        "slug": "soft-knit",
        "name": "Áo Dệt Mềm",
        "price": "980.000đ",
        "description": "Chất dệt mềm, rủ nhẹ trên cơ thể và giữ cảm giác ấm áp mà không nặng nề.",
        "labels": ["Rêu", "Hồng", "Phấn"],
        "colors": ["#78896b", "#d89ea3", "#f4f1ea"],
    },
]

TREND_SOURCE_SEEDS = [
    {
        "slug": "pinterest-trends",
        "name": "Pinterest Trends",
        "source_type": "api",
        "region": "GLOBAL",
        "url": "https://developers.pinterest.com/docs/analytics-and-reports/trends/",
        "notes": "Official trend keyword API when OAuth access is configured.",
    },
    {
        "slug": "google-trends",
        "name": "Google Trends",
        "source_type": "api_or_csv",
        "region": "GLOBAL",
        "url": "https://developers.google.com/search/apis/trends",
        "notes": "Use official API access when available, otherwise import exported CSV manually.",
    },
    {
        "slug": "tiktok-creative-center",
        "name": "TikTok Creative Center",
        "source_type": "manual_review",
        "region": "VN",
        "url": "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag",
        "notes": "Use as a reviewed inspiration source; do not copy third-party media into the app.",
    },
]

STYLE_TREND_SEEDS = [
    {
        "slug": "summer-airy-linen",
        "season": "summer",
        "region": "VN",
        "title": "Linen sáng màu",
        "summary": "Áo sơ mi hoặc polo chất nhẹ, tông trắng ngà và xanh dịu cho ngày nóng.",
        "keywords": ["linen", "áo sơ mi linen", "quiet resort", "mùa hè"],
        "colors": [
            {"label": "Linen", "value": "#e6dfcf"},
            {"label": "Xanh sương", "value": "#b8c8c1"},
            {"label": "Than mực", "value": "#243651"},
        ],
        "score": 92,
        "source_label": "Seed từ nguồn trend, chờ đồng bộ API",
        "source_url": "https://developers.pinterest.com/docs/analytics-and-reports/trends/",
        "status": "published",
        "sort_order": 10,
    },
    {
        "slug": "summer-statement-graphic",
        "season": "summer",
        "region": "VN",
        "title": "Graphic tee nổi bật",
        "summary": "Áo thun họa tiết rõ, phối với quần basic để outfit vẫn gọn nhưng có điểm nhấn.",
        "keywords": ["graphic tee", "áo thun họa tiết", "street casual", "summer outfit"],
        "colors": [
            {"label": "Đỏ năng lượng", "value": "#ef4a4a"},
            {"label": "Đen", "value": "#1c1c1c"},
            {"label": "Nắng", "value": "#ffd963"},
        ],
        "score": 88,
        "source_label": "Seed từ nguồn trend, chờ đồng bộ API",
        "source_url": "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag",
        "status": "published",
        "sort_order": 20,
    },
    {
        "slug": "summer-soft-office",
        "season": "summer",
        "region": "VN",
        "title": "Office mềm nhẹ",
        "summary": "Sơ mi phom sạch, màu navy hoặc đất nhạt cho lịch đi làm nhưng vẫn thoáng.",
        "keywords": ["summer office", "sơ mi tối giản", "smart casual", "capsule wardrobe"],
        "colors": [
            {"label": "Mây", "value": "#f2eee8"},
            {"label": "Navy", "value": "#334766"},
            {"label": "Đất", "value": "#c98f7d"},
        ],
        "score": 84,
        "source_label": "Seed từ nguồn trend, chờ đồng bộ API",
        "source_url": "https://developers.google.com/search/apis/trends",
        "status": "published",
        "sort_order": 30,
    },
]

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price TEXT NOT NULL,
        description TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        image_url TEXT NOT NULL,
        asset_name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE(product_id, sort_order)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trend_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        source_type TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT 'GLOBAL',
        url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trend_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER,
        keyword TEXT NOT NULL,
        season TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT 'VN',
        score REAL NOT NULL DEFAULT 0,
        growth_label TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        raw_payload TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES trend_sources(id) ON DELETE SET NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS style_trends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        season TEXT NOT NULL,
        region TEXT NOT NULL DEFAULT 'VN',
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        keywords TEXT NOT NULL DEFAULT '[]',
        colors TEXT NOT NULL DEFAULT '[]',
        score REAL NOT NULL DEFAULT 0,
        source_label TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        published_at TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
]


def get_db_path() -> Path:
    configured = os.environ.get("IDM_VTON_DB_PATH", "").strip()
    return Path(configured).expanduser() if configured else DEFAULT_DB_PATH


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    target = db_path or get_db_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(target)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_database(
    cloth_assets: Iterable[Path | dict[str, str]] | None = None,
    db_path: Path | None = None,
) -> Path:
    target = db_path or get_db_path()
    with closing(connect(target)) as connection:
        create_schema(connection)
        seed_catalog(connection, cloth_assets or [])
        seed_trend_sources(connection)
        seed_style_trends(connection)
    return target


def create_schema(connection: sqlite3.Connection) -> None:
    for statement in SCHEMA_STATEMENTS:
        connection.execute(statement)
    connection.commit()


def seed_catalog(connection: sqlite3.Connection, cloth_assets: Iterable[Path | dict[str, str]]) -> None:
    for index, product in enumerate(PRODUCT_BLUEPRINTS):
        connection.execute(
            """
            INSERT OR IGNORE INTO products (slug, name, price, description, sort_order)
            VALUES (?, ?, ?, ?, ?)
            """,
            (product["slug"], product["name"], product["price"], product["description"], index),
        )

    variant_count = connection.execute("SELECT COUNT(*) FROM product_variants").fetchone()[0]
    if variant_count:
        connection.commit()
        return

    assets = [_normalize_asset(asset, "cloth") for asset in cloth_assets]
    grouped_assets = _chunk(assets, 3)
    for product_index, product in enumerate(PRODUCT_BLUEPRINTS):
        product_row = connection.execute("SELECT id FROM products WHERE slug = ?", (product["slug"],)).fetchone()
        if not product_row:
            continue
        product_assets = grouped_assets[product_index] if product_index < len(grouped_assets) else []
        for variant_index, asset in enumerate(product_assets):
            connection.execute(
                """
                INSERT OR IGNORE INTO product_variants
                    (product_id, label, color, image_url, asset_name, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    product_row["id"],
                    product["labels"][variant_index] if variant_index < len(product["labels"]) else f"Phiên bản {variant_index + 1}",
                    product["colors"][variant_index] if variant_index < len(product["colors"]) else "#d9d3c7",
                    asset["url"],
                    asset["name"],
                    variant_index,
                ),
            )
    connection.commit()


def seed_trend_sources(connection: sqlite3.Connection) -> None:
    for source in TREND_SOURCE_SEEDS:
        connection.execute(
            """
            INSERT OR IGNORE INTO trend_sources (slug, name, source_type, region, url, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                source["slug"],
                source["name"],
                source["source_type"],
                source["region"],
                source["url"],
                source["notes"],
            ),
        )
    connection.commit()


def seed_style_trends(connection: sqlite3.Connection) -> None:
    for trend in STYLE_TREND_SEEDS:
        connection.execute(
            """
            INSERT OR IGNORE INTO style_trends
                (slug, season, region, title, summary, keywords, colors, score, source_label,
                 source_url, status, sort_order, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (
                trend["slug"],
                trend["season"],
                trend["region"],
                trend["title"],
                trend["summary"],
                json.dumps(trend["keywords"], ensure_ascii=False),
                json.dumps(trend["colors"], ensure_ascii=False),
                trend["score"],
                trend["source_label"],
                trend["source_url"],
                trend["status"],
                trend["sort_order"],
            ),
        )
    connection.commit()


def get_catalog_payload(
    human_assets: Iterable[Path | dict[str, str]],
    hero_image: str = "/repo-assets/teaser2.png",
    db_path: Path | None = None,
) -> dict[str, Any]:
    with closing(connect(db_path)) as connection:
        product_rows = connection.execute(
            """
            SELECT id, slug, name, price, description
            FROM products
            WHERE active = 1
            ORDER BY sort_order, id
            """
        ).fetchall()
        products = []
        for product_row in product_rows:
            variant_rows = connection.execute(
                """
                SELECT id, label, color, image_url, asset_name
                FROM product_variants
                WHERE product_id = ?
                ORDER BY sort_order, id
                """,
                (product_row["id"],),
            ).fetchall()
            variants = [
                {
                    "id": f"{product_row['id']}-{variant_row['id']}",
                    "label": variant_row["label"],
                    "color": variant_row["color"],
                    "url": variant_row["image_url"],
                    "name": variant_row["asset_name"],
                }
                for variant_row in variant_rows
            ]
            if not variants:
                continue
            products.append(
                {
                    "id": product_row["slug"],
                    "name": product_row["name"],
                    "price": product_row["price"],
                    "description": product_row["description"],
                    "variants": variants,
                }
            )

    return {
        "heroImage": hero_image,
        "human": [_normalize_asset(asset, "human") for asset in human_assets],
        "products": products,
    }


def get_published_trends(
    season: str = "summer",
    region: str = "VN",
    limit: int = 8,
    db_path: Path | None = None,
) -> list[dict[str, Any]]:
    clean_season = (season or "summer").strip().lower()
    clean_region = (region or "VN").strip().upper()
    with closing(connect(db_path)) as connection:
        rows = _query_published_trends(connection, clean_season, clean_region, limit)
        if not rows and clean_region != "GLOBAL":
            rows = _query_published_trends(connection, clean_season, "GLOBAL", limit)
    return [_style_trend_to_dict(row) for row in rows]


def insert_trend_snapshot(
    *,
    source_slug: str,
    source_name: str,
    source_type: str,
    keyword: str,
    season: str,
    region: str,
    score: float = 0,
    growth_label: str = "",
    source_url: str = "",
    raw_payload: dict[str, Any] | None = None,
    status: str = "draft",
    db_path: Path | None = None,
) -> int:
    with closing(connect(db_path)) as connection:
        create_schema(connection)
        connection.execute(
            """
            INSERT OR IGNORE INTO trend_sources (slug, name, source_type, region, url)
            VALUES (?, ?, ?, ?, ?)
            """,
            (source_slug, source_name, source_type, region, source_url),
        )
        source_id = connection.execute("SELECT id FROM trend_sources WHERE slug = ?", (source_slug,)).fetchone()["id"]
        cursor = connection.execute(
            """
            INSERT INTO trend_snapshots
                (source_id, keyword, season, region, score, growth_label, source_url, raw_payload, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_id,
                keyword,
                season,
                region,
                float(score or 0),
                growth_label,
                source_url,
                json.dumps(raw_payload or {}, ensure_ascii=False),
                status,
            ),
        )
        connection.commit()
        return int(cursor.lastrowid)


def upsert_style_trend(
    *,
    slug: str,
    season: str,
    region: str,
    title: str,
    summary: str,
    keywords: list[str],
    colors: list[dict[str, str]] | None = None,
    score: float = 0,
    source_label: str = "",
    source_url: str = "",
    status: str = "published",
    db_path: Path | None = None,
) -> None:
    with closing(connect(db_path)) as connection:
        create_schema(connection)
        connection.execute(
            """
            INSERT INTO style_trends
                (slug, season, region, title, summary, keywords, colors, score, source_label,
                 source_url, status, sort_order, published_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100, CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP)
            ON CONFLICT(slug) DO UPDATE SET
                season = excluded.season,
                region = excluded.region,
                title = excluded.title,
                summary = excluded.summary,
                keywords = excluded.keywords,
                colors = excluded.colors,
                score = excluded.score,
                source_label = excluded.source_label,
                source_url = excluded.source_url,
                status = excluded.status,
                published_at = CASE
                    WHEN excluded.status = 'published' THEN COALESCE(style_trends.published_at, CURRENT_TIMESTAMP)
                    ELSE style_trends.published_at
                END,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                slug,
                season,
                region,
                title,
                summary,
                json.dumps(keywords, ensure_ascii=False),
                json.dumps(colors or [], ensure_ascii=False),
                float(score or 0),
                source_label,
                source_url,
                status,
                status,
            ),
        )
        connection.commit()


def _query_published_trends(
    connection: sqlite3.Connection,
    season: str,
    region: str,
    limit: int,
) -> list[sqlite3.Row]:
    return connection.execute(
        """
        SELECT slug, season, region, title, summary, keywords, colors, score,
               source_label, source_url, updated_at
        FROM style_trends
        WHERE status = 'published'
          AND lower(season) = ?
          AND upper(region) = ?
        ORDER BY sort_order, score DESC, id
        LIMIT ?
        """,
        (season, region, max(1, min(int(limit or 8), 24))),
    ).fetchall()


def _style_trend_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["slug"],
        "season": row["season"],
        "region": row["region"],
        "title": row["title"],
        "summary": row["summary"],
        "keywords": _loads_json(row["keywords"], []),
        "colors": _loads_json(row["colors"], []),
        "score": row["score"],
        "sourceLabel": row["source_label"],
        "sourceUrl": row["source_url"],
        "updatedAt": row["updated_at"],
    }


def _normalize_asset(asset: Path | dict[str, str], group: str) -> dict[str, str]:
    if isinstance(asset, Path):
        return {"name": asset.name, "url": f"/examples/{group}/{asset.name}"}
    name = asset.get("name", "")
    return {"name": name, "url": asset.get("url", f"/examples/{group}/{name}")}


def _chunk(items: list[dict[str, str]], size: int) -> list[list[dict[str, str]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def _loads_json(raw_value: str, fallback: Any) -> Any:
    try:
        return json.loads(raw_value)
    except (TypeError, json.JSONDecodeError):
        return fallback
