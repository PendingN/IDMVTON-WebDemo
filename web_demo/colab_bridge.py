import argparse
import base64
import io
import json
import traceback
from email.parser import BytesParser
from email.policy import default as default_policy
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
from urllib.parse import urlsplit


ROOT_DIR = Path(__file__).resolve().parents[1]
GRADIO_DIR = ROOT_DIR / "gradio_demo"

for path in (ROOT_DIR, GRADIO_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


INFERENCE_LOCK = threading.Lock()
WARMUP_STATE = {
    "status": "not_started",
    "error": "",
}


def image_to_data_url(image, quality: int = 88) -> str:
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=quality, optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def bool_from_value(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def safe_int(value: str, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_multipart_request(handler: BaseHTTPRequestHandler) -> dict[str, dict[str, object]]:
    content_type = handler.headers.get("Content-Type", "")
    content_length = int(handler.headers.get("Content-Length", "0"))
    body = handler.rfile.read(content_length)
    envelope = (
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("utf-8") + body
    )
    message = BytesParser(policy=default_policy).parsebytes(envelope)

    fields: dict[str, dict[str, object]] = {}
    for part in message.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        fields[name] = {
            "filename": part.get_filename(),
            "content_type": part.get_content_type(),
            "value": part.get_payload(decode=True),
        }
    return fields


def get_field_value(fields: dict[str, dict[str, object]], field_name: str, default: str = "") -> str:
    field = fields.get(field_name)
    if field is None:
        return default
    value = field.get("value", b"")
    if isinstance(value, bytes):
        return value.decode("utf-8").strip()
    return str(value).strip()


def load_uploaded_image(fields: dict[str, dict[str, object]], field_name: str, mode: str = "RGB"):
    from PIL import Image, ImageOps

    field = fields.get(field_name)
    if field is None or not field.get("filename"):
        return None

    payload = field.get("value", b"")
    if not payload:
        return None

    image = Image.open(io.BytesIO(payload))
    image = ImageOps.exif_transpose(image)
    return image.convert(mode)


def get_tryon_service():
    from tryon_core import get_tryon_service as load_service

    return load_service()


def preload_models() -> None:
    WARMUP_STATE["status"] = "loading"
    WARMUP_STATE["error"] = ""
    print("[colab-bridge] Preloading IDM-VTON models...")
    try:
        service = get_tryon_service()
        service.preload()
    except Exception as exc:
        WARMUP_STATE["status"] = "error"
        WARMUP_STATE["error"] = str(exc)
        print(f"[colab-bridge] Model preload failed: {exc}")
        traceback.print_exc(limit=8)
        return

    WARMUP_STATE["status"] = "ready"
    print("[colab-bridge] Model preload finished. API is ready for try-on requests.")


def start_model_preload() -> threading.Thread:
    preload_thread = threading.Thread(target=preload_models, name="model-preload", daemon=True)
    preload_thread.start()
    return preload_thread


class ColabBridgeHandler(BaseHTTPRequestHandler):
    server_version = "IDMVTONColabBridge/1.0"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            return self._send_json(
                {
                    "status": "ok",
                    "service": "colab-bridge",
                    "modelStatus": WARMUP_STATE["status"],
                    "modelReady": WARMUP_STATE["status"] == "ready",
                    "modelError": WARMUP_STATE["error"],
                }
            )
        return self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path != "/api/tryon":
            return self._send_error_json(HTTPStatus.NOT_FOUND, "Route not found.")

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self._send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Expected multipart/form-data payload.",
            )

        try:
            form = parse_multipart_request(self)
            human_image = load_uploaded_image(form, "human_image")
            garment_image = load_uploaded_image(form, "garment_image")
            mask_image = load_uploaded_image(form, "mask_image")

            if human_image is None or garment_image is None:
                return self._send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Both human image and garment image are required.",
                )

            auto_mask = bool_from_value(get_field_value(form, "auto_mask"), default=True)
            auto_crop = bool_from_value(get_field_value(form, "auto_crop"), default=False)
            denoise_steps = safe_int(get_field_value(form, "denoise_steps"), 30)
            seed = safe_int(get_field_value(form, "seed"), 42)
            garment_description = get_field_value(form, "garment_description", "")

            with INFERENCE_LOCK:
                service = get_tryon_service()
                result = service.run(
                    human_image=human_image,
                    garment_image=garment_image,
                    garment_description=garment_description,
                    auto_mask=auto_mask,
                    auto_crop=auto_crop,
                    denoise_steps=denoise_steps,
                    seed=seed,
                    manual_mask=mask_image,
                )

            return self._send_json(
                {
                    "seed": result["seed"],
                    "outputImage": image_to_data_url(result["output_image"]),
                    "maskPreview": image_to_data_url(result["mask_preview"], quality=82),
                }
            )
        except BrokenPipeError:
            print("[colab-bridge] Client disconnected before inference response finished sending.")
            return
        except ConnectionResetError:
            print("[colab-bridge] Client reset the connection before inference response finished sending.")
            return
        except Exception as exc:
            return self._send_error_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                f"Inference failed: {exc}",
                details=traceback.format_exc(limit=8),
            )

    def log_message(self, format: str, *args) -> None:
        print(f"[colab-bridge] {self.address_string()} - {format % args}")

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Connection", "close")
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

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the IDM-VTON Colab API bridge.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=7862)
    parser.add_argument(
        "--no-preload-models",
        action="store_true",
        help="Do not load IDM-VTON models until the first /api/tryon request.",
    )
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), ColabBridgeHandler)
    print(f"IDM-VTON Colab bridge: http://{args.host}:{args.port}")
    if args.no_preload_models:
        print("[colab-bridge] Model preload disabled. First try-on request will load the models.")
    else:
        start_model_preload()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
