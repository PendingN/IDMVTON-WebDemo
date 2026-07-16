import argparse
import json
import mimetypes
import os
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
GRADIO_DIR = ROOT_DIR / "gradio_demo"
STATIC_DIR = Path(__file__).resolve().parent / "static"
TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
PHOTO_DIR = Path(__file__).resolve().parent / "photo"
SEASON_DIR = Path(__file__).resolve().parent / "Season"
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
REMOTE_HEALTH_TIMEOUT = 10
MAX_REQUEST_BYTES = 20 * 1024 * 1024
KNOWN_API_SUFFIXES = ("/api/tryon", "/api/health")
REMOTE_URL_PATTERN = re.compile(r"https?://[^\s'\"<>]+", re.IGNORECASE)
mimetypes.add_type("text/javascript", ".mjs")


def get_int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name, "").strip()
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
    cloth_examples = sorted(path for path in cloth_dir.iterdir() if path.is_file())
    human_examples = sorted(path for path in human_dir.iterdir() if path.is_file())
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


class RemoteHTTPError(RuntimeError):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def proxy_remote_json(
    method: str,
    remote_url: str,
    body: bytes | None = None,
    content_type: str | None = None,
    timeout: int | None = None,
) -> dict:
    headers = {"Accept": "application/json"}
    if content_type:
        headers["Content-Type"] = content_type
    request = Request(remote_url, data=body, headers=headers, method=method)

    try:
        with urlopen(request, timeout=timeout or REMOTE_TIMEOUT) as response:
            payload = response.read()
            status_code = response.status
    except HTTPError as exc:
        payload = exc.read()
        try:
            error_payload = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            error_payload = {}
        raise RemoteHTTPError(
            exc.code,
            error_payload.get("error") or f"Remote server returned HTTP {exc.code}.",
        ) from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach remote Colab API: {exc.reason}") from exc

    try:
        decoded = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError("Remote Colab API did not return valid JSON.") from exc

    if status_code >= 400:
        raise RuntimeError(decoded.get("error") or f"Remote server returned HTTP {status_code}.")
    return decoded


def read_request_body(handler: BaseHTTPRequestHandler) -> bytes:
    raw_length = handler.headers.get("Content-Length")
    try:
        content_length = int(raw_length or "")
    except ValueError as exc:
        raise ValueError("A valid Content-Length header is required.") from exc
    if content_length < 0:
        raise ValueError("A valid Content-Length header is required.")
    if content_length > MAX_REQUEST_BYTES:
        raise OverflowError(f"Request body exceeds the {MAX_REQUEST_BYTES // (1024 * 1024)} MB limit.")
    return handler.rfile.read(content_length)


def normalize_tryon_payload(payload: dict) -> dict:
    seed = payload.get("seed", 42)
    before_image = payload.get("beforeImage")
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
    if not before_image:
        raise RemoteHTTPError(
            502,
            "Remote Colab API response is missing beforeImage. Update and restart the Colab bridge; deploy/restart the UI and bridge together.",
        )

    return {
        "seed": seed,
        "outputImage": output_image,
        "beforeImage": before_image,
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
    elif root_name == "photo":
        base_dir = PHOTO_DIR
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    elif root_name == "season":
        base_dir = SEASON_DIR
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    elif root_name == "examples":
        base_dir = GRADIO_DIR / "example"
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    elif root_name == "repo-assets":
        base_dir = ASSETS_DIR
        target = (base_dir / Path(*rel_path.parts[1:])).resolve()
    else:
        raise FileNotFoundError(raw_path)

    if not target.is_relative_to(base_dir.resolve()) or not target.is_file():
        raise FileNotFoundError(raw_path)
    return target


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "IDMVTONWebDemo/2.0"

    def do_GET(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path in PAGE_ROUTES:
            return self._serve_file(TEMPLATE_DIR / PAGE_ROUTES[parsed.path], "text/html; charset=utf-8")
        if parsed.path == "/api/health":
            return self._send_json({"status": "ok"})
        if parsed.path == "/api/config":
            return self._send_json({"defaultRemoteUrl": REMOTE_BASE_URL})
        if parsed.path == "/api/remote-health":
            try:
                remote_base = self._get_remote_base_url()
                remote_health_url = normalize_remote_endpoint(remote_base, "/api/health")
                remote_payload = proxy_remote_json(
                    "GET",
                    remote_health_url,
                    timeout=REMOTE_HEALTH_TIMEOUT,
                )
                return self._send_json(
                    {
                        "status": "ok",
                        "remoteUrl": remote_base,
                        "remote": remote_payload,
                    }
                )
            except RemoteHTTPError as exc:
                return self._send_error_json(exc.status, str(exc))
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
        if (
            parsed.path.startswith("/static/")
            or parsed.path.startswith("/examples/")
            or parsed.path.startswith("/photo/")
            or parsed.path.startswith("/season/")
            or parsed.path.startswith("/repo-assets/")
        ):
            try:
                resolved = _resolve_public_path(parsed.path)
            except FileNotFoundError:
                return self._send_error_json(HTTPStatus.NOT_FOUND, "Asset not found.")
            mime_type, _ = mimetypes.guess_type(resolved.name)
            return self._serve_file(resolved, mime_type or "application/octet-stream")

        self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

    def do_POST(self) -> None:
        global REMOTE_BASE_URL
        parsed = urlsplit(self.path)

        if parsed.path == "/api/config":
            if self.client_address[0] not in {"127.0.0.1", "::1"}:
                return self._send_error_json(HTTPStatus.FORBIDDEN, "Runtime bridge configuration is local-only.")
            if "application/json" not in self.headers.get("Content-Type", ""):
                return self._send_error_json(HTTPStatus.BAD_REQUEST, "Expected application/json payload.")
            try:
                payload = json.loads(read_request_body(self).decode("utf-8"))
                raw_url = payload.get("remoteUrl", "")
                if not isinstance(raw_url, str):
                    raise ValueError("Colab API URL must be a string.")
                remote_url = extract_remote_url(raw_url)
                normalize_remote_endpoint(remote_url, "/api/tryon")
                # ponytail: process-wide local setting; add authenticated per-user storage before exposing it publicly.
                REMOTE_BASE_URL = remote_url
                return self._send_json({"defaultRemoteUrl": REMOTE_BASE_URL})
            except OverflowError as exc:
                return self._send_error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc))
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
                return self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))

        if parsed.path != "/api/tryon":
            return self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Expected multipart/form-data payload.",
            )

        try:
            body = read_request_body(self)
            remote_base = self._get_remote_base_url()
            remote_tryon_url = normalize_remote_endpoint(remote_base, "/api/tryon")
            remote_payload = proxy_remote_json(
                "POST",
                remote_tryon_url,
                body=body,
                content_type=content_type,
            )
            return self._send_json(normalize_tryon_payload(remote_payload))
        except OverflowError as exc:
            return self._send_error_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc))
        except ValueError as exc:
            return self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except RemoteHTTPError as exc:
            return self._send_error_json(exc.status, str(exc))
        except Exception as exc:
            self.log_error("Remote inference failed: %s", exc)
            return self._send_error_json(
                HTTPStatus.BAD_GATEWAY,
                "Remote inference failed.",
            )

    def log_message(self, format: str, *args) -> None:
        print(f"[web-demo] {self.address_string()} - {format % args}")

    def _get_remote_base_url(self) -> str:
        remote_url = extract_remote_url(REMOTE_BASE_URL)
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

    def _send_error_json(self, status: HTTPStatus, message: str) -> None:
        self._send_json({"error": message}, status=status)


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

    server = ThreadingHTTPServer((args.host, args.port), DemoHandler)
    print(f"IDM-VTON web UI: http://{args.host}:{args.port}")
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
