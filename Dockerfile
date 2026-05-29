FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements-web.txt .
RUN python -m pip install --no-cache-dir -r requirements-web.txt

COPY . .

EXPOSE 10000

CMD ["python", "-B", "web_demo/server.py", "--host", "0.0.0.0"]
