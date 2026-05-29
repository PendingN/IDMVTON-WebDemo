# Repository Guidelines

## Project Overview
- This repository is IDM-VTON, a Python research/demo project for diffusion-based virtual try-on.
- Core training and inference entrypoints live at the repo root: `train_xl.py`, `inference.py`, and `inference_dc.py`.
- Model/pipeline code is under `src/`; IP-Adapter helpers are under `ip_adapter/`.
- Local Gradio demo code is under `gradio_demo/`.
- The custom browser UI and Colab API bridge are under `web_demo/`.
- Large model artifacts and checkpoints are expected under `ckpt/`; avoid moving or rewriting them unless explicitly requested.

## Environment
- The documented environment is Conda-based:
  - `conda env create -f environment.yaml`
  - `conda activate idm`
- The environment targets Python 3.10, PyTorch 2.0.1, CUDA 11.8, Diffusers 0.25.0, Transformers 4.36.2, and Gradio 4.24.0.
- GPU/CUDA availability matters for full IDM-VTON inference and training. Lightweight web UI work may run locally without loading models.

## Common Commands
- Gradio demo:
  - `python gradio_demo/app.py`
- Local web UI:
  - `python web_demo/server.py --host 127.0.0.1 --port 7865`
  - Optional remote bridge URL: `python web_demo/server.py --host 127.0.0.1 --port 7865 --remote-url https://your-bridge-url`
- Colab/API bridge:
  - `python web_demo/colab_bridge.py --host 0.0.0.0 --port 7862`
- Training:
  - `accelerate launch train_xl.py --gradient_checkpointing --use_8bit_adam --output_dir=result --train_batch_size=6 --data_dir=DATA_DIR`
  - Or run `sh train_xl.sh` in a compatible shell.
- VITON-HD inference:
  - `accelerate launch inference.py --width 768 --height 1024 --num_inference_steps 30 --output_dir result --unpaired --data_dir DATA_DIR --seed 42 --test_batch_size 2 --guidance_scale 2.0`
  - Or run `sh inference.sh` in a compatible shell.

## Testing And Verification
- There is no dedicated test suite configured in the root project.
- For Python-only changes, at minimum run syntax checks on touched files, for example:
  - `python -m py_compile path/to/file.py`
- For web demo changes, start `web_demo/server.py` and verify the affected page in a browser.
- Full model inference can be slow and GPU-dependent; state clearly when it was not run.

## Coding Conventions
- Preserve the existing script-oriented style and avoid broad refactors in research model code.
- Keep edits narrowly scoped to the requested behavior.
- Prefer existing helpers and pipeline classes over duplicating model-loading or preprocessing logic.
- Avoid changing vendored or copied Detectron2 code under `gradio_demo/detectron2/` or `preprocess/humanparsing/mhp_extension/detectron2/` unless the task specifically targets it.
- Do not commit generated caches, notebook outputs, backups, datasets, or heavyweight model artifacts unless the user explicitly asks.

## Current Workspace Notes
- The worktree may already contain local user changes and generated files. Do not revert unrelated changes.
- `web_demo/` contains a Vietnamese README and a custom three-page commerce-oriented UI (`/`, `/shop`, `/try-on`).

## Frontend (focused guidance)
- **What counts as frontend here:** `gradio_demo/` (local Gradio app) and `web_demo/` (static UI + Colab bridge). Small scripts under `web_demo/server.py`, `web_demo/colab_bridge.py`, and `gradio_demo/app.py` are the main entrypoints.
- **Run local Gradio (full local inference):** requires `ckpt/` checkpoints and GPU for model loading.
  - Command: `python gradio_demo/app.py`.
- **Run web UI (proxy to Colab or remote bridge):** the local server serves static pages and proxies to a remote Colab API. Start Colab bridge remotely and then run local server.
  - Colab bridge (remote/Colab): `python web_demo/colab_bridge.py --host 0.0.0.0 --port 7862`.
  - Local UI (dev): `python web_demo/server.py --host 127.0.0.1 --port 7861 --remote-url https://your-bridge-url`.
- **Important UI files**
  - `web_demo/server.py` — local static server and config for Colab bridge URL.
  - `web_demo/colab_bridge.py` — API bridge used on Colab to expose `/api/tryon`.
  - `web_demo/static/` — static assets (JS, CSS, images) for the browser UI.
  - `web_demo/templates/` — HTML templates for the UI pages.
  - `gradio_demo/app.py` and `gradio_demo/tryon_core.py` — Gradio front-end and the local inference wrapper.
- **Frontend dev tips**
  - For UI layout or JS tweaks, modify `web_demo/static/` and `web_demo/templates/` and reload `server.py`.
  - Use the Colab bridge when you don't have a capable GPU locally — it avoids loading models on the local machine.
  - Ports: default bridge uses `7862` (Colab) and local UI `7861`/`7865`; avoid collisions in tests.
  - On Windows, run the Python entrypoints directly instead of `sh` scripts, or use WSL for shell scripts.
  - When changing API contract (`/api/tryon`), update both `web_demo/colab_bridge.py` and the frontend JS that posts to it.

If you'd like, I can now create a small `frontend.instructions.md` or add a dedicated skill for frontend tasks (hot-reload guidance, local mock server, or UI test checklist). Which would you prefer?
