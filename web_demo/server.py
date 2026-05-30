import argparse
import json
import mimetypes
import os
import re
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

try:
    from .database import get_catalog_payload, get_published_trends, init_database
except ImportError:
    from database import get_catalog_payload, get_published_trends, init_database


ROOT_DIR = Path(__file__).resolve().parents[1]
GRADIO_DIR = ROOT_DIR / "gradio_demo"
STATIC_DIR = Path(__file__).resolve().parent / "static"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
ASSETS_DIR = ROOT_DIR / "assets"
PAGE_ROUTES = {
    "/": "index.html",
    "/shop": "shop.html",
    "/shop/": "shop.html",
    "/try-on": "tryon.html",
    "/try-on/": "tryon.html",
}

REMOTE_BASE_URL = ""
REMOTE_TIMEOUT = 1800
KNOWN_API_SUFFIXES = ("/api/tryon", "/api/health")
REMOTE_URL_PATTERN = re.compile(r"https?://[^\s'\"<>]+", re.IGNORECASE)


def get_int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name, "").strip()
    if not raw_value:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def get_query_int(query: dict[str, list[str]], name: str, default: int) -> int:
    raw_value = query.get(name, [""])[0].strip()
    if not raw_value:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def extract_remote_url(raw_url: str) -> str:
    candidate = (raw_url or "").strip()
    if not candidate:
        return ""

    match = REMOTE_URL_PATTERN.search(candidate)
    if match:
        candidate = match.group(0)
    else:
        candidate = candidate.split()[0]
        if re.match(r"^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:/.*)?$", candidate, re.IGNORECASE):
            candidate = f"http://{candidate}"

    return candidate.strip("'\"").rstrip("),.;")


def list_example_assets() -> dict[str, list[Path]]:
    cloth_dir = GRADIO_DIR / "example" / "cloth"
    human_dir = GRADIO_DIR / "example" / "human"
    cloth_examples = sorted(path for path in cloth_dir.iterdir() if path.is_file()) if cloth_dir.exists() else []
    human_examples = sorted(path for path in human_dir.iterdir() if path.is_file()) if human_dir.exists() else []
    return {
        "cloth": cloth_examples,
        "human": human_examples,
    }


def normalize_remote_endpoint(raw_url: str, api_suffix: str) -> str:
    candidate = extract_remote_url(raw_url)
    if not candidate:
        raise ValueError("Colab API URL is empty.")

    parsed = urlsplit(candidate)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Colab API URL must include http:// or https://")

    normalized_path = parsed.path.rstrip("/")
    if normalized_path.endswith(api_suffix):
        final_path = normalized_path
    else:
        base_path = normalized_path
        for known_suffix in KNOWN_API_SUFFIXES:
            if base_path.endswith(known_suffix):
                base_path = base_path[: -len(known_suffix)]
                break

        if base_path:
            final_path = base_path + api_suffix
        else:
            final_path = api_suffix

    return urlunsplit((parsed.scheme, parsed.netloc, final_path, parsed.query, parsed.fragment))


def proxy_remote_json(
    method: str,
    remote_url: str,
    body: bytes | None = None,
    content_type: str | None = None,
) -> dict:
    headers = {"Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    request = Request(remote_url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=REMOTE_TIMEOUT) as response:
            payload = response.read()
            status_code = response.status
    except HTTPError as exc:
        payload = exc.read()
        try:
            error_payload = json.loads(payload.decode("utf-8"))
        except Exception:
            error_payload = {"error": payload.decode("utf-8", errors="replace") or str(exc)}
        raise RuntimeError(error_payload.get("error") or f"Remote server returned HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach remote Colab API: {exc.reason}") from exc

    try:
        decoded = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("Remote Colab API did not return valid JSON.") from exc

    if status_code >= 400:
        raise RuntimeError(decoded.get("error") or f"Remote server returned HTTP {status_code}.")
    return decoded


def normalize_tryon_payload(payload: dict) -> dict:
    seed = payload.get("seed", 42)
    output_image = (
        payload.get("outputImage")
        or payload.get("output_image")
        or payload.get("resultImage")
        or payload.get("result_image")
        or payload.get("image")
    )
    mask_preview = (
        payload.get("maskPreview")
        or payload.get("mask_preview")
        or payload.get("maskImage")
        or payload.get("mask_image")
        or payload.get("mask")
    )

    if not output_image:
        raise RuntimeError("Remote Colab API response is missing output image.")

    return {
        "seed": seed,
        "outputImage": output_image,
        "maskPreview": mask_preview or "",
    }


def _resolve_public_path(raw_path: str) -> Path:
    rel_path = Path(unquote(raw_path.lstrip("/")))
    if not rel_path.parts:
        raise FileNotFoundError(raw_path)

    root_name = rel_path.parts[0]
    if root_name == "static":
        base_dir = STATIC_DIR
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    elif root_name == "examples":
        base_dir = GRADIO_DIR / "example"
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    elif root_name == "repo-assets":
        base_dir = ASSETS_DIR
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    else:
        raise FileNotFoundError(raw_path)

    if not str(target).startswith(str(base_dir.resolve())) or not target.is_file():
        raise FileNotFoundError(raw_path)
    return target


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "IDMVTONWebDemo/2.0"

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)

        if parsed.path in PAGE_ROUTES:
            return self._serve_file(TEMPLATE_DIR / PAGE_ROUTES[parsed.path], "text/html; charset=utf-8")
        if parsed.path == "/api/health":
            return self._send_json({"status": "ok"})
        if parsed.path == "/api/config":
            return self._send_json({"defaultRemoteUrl": REMOTE_BASE_URL})
        if parsed.path == "/api/catalog":
            examples = list_example_assets()
            return self._send_json(get_catalog_payload(examples["human"]))
        if parsed.path == "/api/trends":
            season = query.get("season", ["summer"])[0]
            region = query.get("region", ["VN"])[0]
            limit = get_query_int(query, "limit", 8)
            return self._send_json(
                {
                    "season": season or "summer",
                    "region": region or "VN",
                    "items": get_published_trends(season=season, region=region, limit=limit),
                }
            )
        if parsed.path == "/api/remote-health":
            try:
                remote_base = self._get_remote_base_url(query)
                remote_health_url = normalize_remote_endpoint(remote_base, "/api/health")
                remote_payload = proxy_remote_json("GET", remote_health_url)
                return self._send_json(
                    {
                        "status": "ok",
                        "remoteUrl": remote_base,
                        "remote": remote_payload,
                    }
                )
            except Exception as exc:
                return self._send_error_json(HTTPStatus.BAD_GATEWAY, str(exc))
        if parsed.path == "/api/examples":
            examples = list_example_assets()
            return self._send_json(
                {
                    "human": [
                        {"name": path.name, "url": f"/examples/human/{path.name}"}
                        for path in examples["human"]
                    ],
                    "cloth": [
                        {"name": path.name, "url": f"/examples/cloth/{path.name}"}
                        for path in examples["cloth"]
                    ],
                    "heroImage": "/repo-assets/teaser2.png",
                }
            )
        if parsed.path.startswith("/static/") or parsed.path.startswith("/examples/") or parsed.path.startswith(
            "/repo-assets/"
        ):
            try:
                resolved = _resolve_public_path(parsed.path)
            except FileNotFoundError:
                return self._send_error_json(HTTPStatus.NOT_FOUND, "Asset not found.")
            mime_type, _ = mimetypes.guess_type(resolved.name)
            return self._serve_file(resolved, mime_type or "application/octet-stream")

        self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        query = parse_qs(parsed.query)

        if parsed.path != "/api/tryon":
            return self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Expected multipart/form-data payload.",
            )

        try:
            remote_base = self._get_remote_base_url(query)
            remote_tryon_url = normalize_remote_endpoint(remote_base, "/api/tryon")
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)

            remote_payload = proxy_remote_json(
                "POST",
                remote_tryon_url,
                body=body,
                content_type=content_type,
            )
            return self._send_json(normalize_tryon_payload(remote_payload))
        except Exception as exc:
            return self._send_error_json(
                HTTPStatus.BAD_GATEWAY,
                f"Remote inference failed: {exc}",
                details=traceback.format_exc(limit=8),
            )

    def log_message(self, format: str, *args) -> None:
        print(f"[web-demo] {self.address_string()} - {format % args}")

    def _get_remote_base_url(self, query: dict[str, list[str]]) -> str:
        remote_url = extract_remote_url(query.get("remote_url", [""])[0]) or extract_remote_url(REMOTE_BASE_URL)
        if not remote_url:
            raise ValueError("No Colab API URL configured.")
        return remote_url

    def _serve_file(self, path: Path, content_type: str) -> None:
        payload = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_error_json(
        self,
        status: HTTPStatus,
        message: str,
        details: str | None = None,
    ) -> None:
        payload = {"error": message}
        if details:
            payload["details"] = details
        self._send_json(payload, status=status)


def main() -> None:
    global REMOTE_BASE_URL
    global REMOTE_TIMEOUT

    parser = argparse.ArgumentParser(description="Run the IDM-VTON local web UI with remote Colab inference.")
    parser.add_argument("--host", default=os.environ.get("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=get_int_env("PORT", 7861))
    parser.add_argument(
        "--remote-url",
        default=os.environ.get("IDM_VTON_REMOTE_URL", ""),
        help="Base public URL of the Colab bridge.",
    )
    parser.add_argument(
        "--remote-timeout",
        type=int,
        default=get_int_env("IDM_VTON_REMOTE_TIMEOUT", 1800),
        help="Remote inference timeout in seconds.",
    )
    args = parser.parse_args()

    REMOTE_BASE_URL = extract_remote_url(args.remote_url)
    REMOTE_TIMEOUT = max(5, int(args.remote_timeout))
    db_path = init_database(list_example_assets()["cloth"])

    server = ThreadingHTTPServer((args.host, args.port), DemoHandler)
    print(f"IDM-VTON web UI: http://{args.host}:{args.port}")
    print(f"SQLite catalog DB: {db_path}")
    if REMOTE_BASE_URL:
        print(f"Default Colab API URL: {REMOTE_BASE_URL}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
