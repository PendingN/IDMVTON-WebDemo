# Deploy Web Demo To Render

Use this for the lightweight web demo only. GPU inference still runs on Colab, Hugging Face Space, RunPod, or another GPU API.

## 1. Push To GitHub

```powershell
git init
git add .
git commit -m "Prepare IDM-VTON web demo for Render"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## 2. Create Render Web Service

1. Open Render and create a new Web Service from the GitHub repository.
2. Render will detect `render.yaml`.
3. Set environment variable `IDM_VTON_REMOTE_URL` to your public Colab bridge URL.
4. Deploy.

Render provides `PORT` automatically. The server reads that value, so the start command does not need a fixed port.

## 3. Local Production-Like Run

```powershell
$env:PORT="7863"
$env:IDM_VTON_REMOTE_URL="https://your-colab-bridge.trycloudflare.com"
python -B web_demo/server.py --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:7863/try-on
```

If you leave `IDM_VTON_REMOTE_URL` empty, users can still paste the API URL in the `Kết nối API` panel.
