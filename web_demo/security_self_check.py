import io
import json
import tempfile
from pathlib import Path
from types import SimpleNamespace
from urllib.error import HTTPError

import colab_bridge
import server


def handler(content_length: str, body: bytes = b""):
    return SimpleNamespace(headers={"Content-Length": content_length}, rfile=io.BytesIO(body))


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        server.STATIC_DIR = root / "static"
        sibling = root / "static-private"
        server.STATIC_DIR.mkdir()
        sibling.mkdir()
        (sibling / "secret.txt").write_text("secret", encoding="utf-8")
        try:
            server._resolve_public_path("/static/../static-private/secret.txt")
        except FileNotFoundError:
            pass
        else:
            raise AssertionError("static traversal escaped its public root")

    for read_body in (server.read_request_body, colab_bridge.parse_multipart_request):
        try:
            read_body(handler(str(server.MAX_REQUEST_BYTES + 1)))
        except OverflowError:
            pass
        else:
            raise AssertionError("oversized request was accepted")

    original_urlopen = server.urlopen
    error_body = io.BytesIO(json.dumps({"error": "invalid upload"}).encode())
    server.urlopen = lambda *args, **kwargs: (_ for _ in ()).throw(
        HTTPError("https://bridge.example/api/tryon", 400, "Bad Request", {}, error_body)
    )
    try:
        server.proxy_remote_json("POST", "https://bridge.example/api/tryon")
    except server.RemoteHTTPError as exc:
        assert exc.status == 400
        assert str(exc) == "invalid upload"
    else:
        raise AssertionError("upstream HTTP status was not preserved")
    finally:
        server.urlopen = original_urlopen

    server.REMOTE_BASE_URL = "https://bridge.example"
    assert server.DemoHandler._get_remote_base_url(None) == server.REMOTE_BASE_URL
    assert 0 < server.REMOTE_HEALTH_TIMEOUT < server.REMOTE_TIMEOUT

    original_remote_url = server.REMOTE_BASE_URL
    runtime_config = json.dumps({"remoteUrl": "https://runtime.example"}).encode()
    captured_config = {}
    runtime_handler = SimpleNamespace(
        path="/api/config",
        client_address=("127.0.0.1", 7861),
        headers={"Content-Type": "application/json", "Content-Length": str(len(runtime_config))},
        rfile=io.BytesIO(runtime_config),
        _send_json=lambda payload, status=None: captured_config.update(payload=payload, status=status),
        _send_error_json=lambda status, message: captured_config.update(error=message, status=status),
    )
    try:
        server.DemoHandler.do_POST(runtime_handler)
        assert captured_config["payload"] == {"defaultRemoteUrl": "https://runtime.example"}
        assert server.REMOTE_BASE_URL == "https://runtime.example"
    finally:
        server.REMOTE_BASE_URL = original_remote_url

    normalized = server.normalize_tryon_payload(
        {
            "seed": 7,
            "outputImage": "data:image/jpeg;base64,output",
            "beforeImage": "data:image/jpeg;base64,before",
            "maskPreview": "data:image/jpeg;base64,mask",
        }
    )
    assert normalized == {
        "seed": 7,
        "outputImage": "data:image/jpeg;base64,output",
        "beforeImage": "data:image/jpeg;base64,before",
        "maskPreview": "data:image/jpeg;base64,mask",
    }

    try:
        server.normalize_tryon_payload(
            {
                "seed": 7,
                "outputImage": "data:image/jpeg;base64,output",
                "maskPreview": "data:image/jpeg;base64,mask",
            }
        )
    except server.RemoteHTTPError as exc:
        assert exc.status == 502
        guidance = str(exc).lower()
        assert "update and restart" in guidance
        assert "deploy/restart the ui and bridge together" in guidance
    else:
        raise AssertionError("old bridge response without beforeImage was accepted")

    web_root = Path(__file__).parent
    browser_sources = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (
            web_root / "static/js/tryon.js",
            web_root / "static/js/catalog.js",
            web_root / "templates/tryon.html",
        )
    )
    server_source = (web_root / "server.py").read_text(encoding="utf-8")
    assert "remote_url=" not in browser_sources
    assert "remote_url=" not in server_source
    for stale_path in (
        "localStorage",
        "navigator.clipboard",
        "pasteRemoteButton",
        "clearRemoteButton",
        "REMOTE_URL_STORAGE_KEY",
        "data-remote-url",
    ):
        assert stale_path not in browser_sources
    assert "remoteUrlInput" in browser_sources
    assert 'fetch("/api/config", {' in browser_sources


if __name__ == "__main__":
    main()
