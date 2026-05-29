# GitHub + Render Upload Guide

This package is cleaned and ready to push to GitHub, then deploy as a Render Web Service.

## Upload To GitHub

```powershell
cd path\to\IDM-VTON
git init
git add .
git commit -m "Prepare IDM-VTON web demo for Render"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## Deploy To Render

1. Create a new Render Web Service from the GitHub repository.
2. Render will use `render.yaml`.
3. Add environment variable `IDM_VTON_REMOTE_URL` if you want a default Colab/GPU bridge.
4. Deploy and open the Render URL.

The hosted web demo only serves the UI and proxies requests. IDM-VTON inference still needs a public GPU API bridge.

## Included Deploy Files

- `render.yaml`: Render service configuration.
- `Procfile`: fallback process command for Python web hosts.
- `requirements-web.txt`: minimal dependency file for the stdlib web server.
- `DEPLOY_RENDER.md`: detailed deployment notes.
