# IDM-VTON Web Demo

Demo web cho luồng thương mại điện tử dùng IDM-VTON, gồm 3 trang:

- `/` : landing giới thiệu khả năng ứng dụng vào fashion commerce
- `/shop` : trang shopping chọn sản phẩm từ shop
- `/try-on` : trang thử đồ ảo với item từ shop hoặc garment upload riêng

## Cấu trúc

```text
web_demo/
├── server.py
├── colab_bridge.py
├── README.md
├── templates/
│   ├── index.html
│   ├── shop.html
│   └── tryon.html
└── static/
    ├── css/
    │   └── styles.css
    ├── images/
    └── js/
        ├── app.js
        ├── catalog.js
        ├── landing.js
        ├── shop.js
        └── tryon.js
```

## Chạy local

```bash
python web_demo/server.py --host 127.0.0.1 --port 7865
```

Nếu có Colab bridge đang chạy trên Colab:

```bash
python web_demo/server.py --host 127.0.0.1 --port 7865 --remote-url https://your-bridge-url
```

Trong Colab, chạy backend API:

```bash
python web_demo/colab_bridge.py --host 0.0.0.0 --port 7862
```

Expose port `7862` bằng Cloudflare Tunnel/ngrok rồi dán public URL vào khối `Kết nối API` trên trang `/try-on`. Ô nhập hỗ trợ URL gốc, URL có `/api/tryon`, `localhost:7862`, hoặc đoạn command có chứa link public; frontend sẽ tự chuẩn hóa trước khi gọi API. API bridge hỗ trợ `GET /api/health` và `POST /api/tryon`, trả `outputImage`, `maskPreview`, `seed` dạng JSON để frontend hiển thị ảnh trực tiếp.

## Chạy local trên port riêng và tunnel ra internet

Nếu bạn muốn chạy web demo ngay trên máy local nhưng vẫn mở cho người khác truy cập qua internet, dùng cấu hình này:

### 1. Chạy web demo local trên port `8763`

```bash
python web_demo/server.py --host 127.0.0.1 --port 8763 --remote-url https://your-colab-bridge.trycloudflare.com
```

Lệnh này giữ web UI chạy ở `http://127.0.0.1:8763` và gắn sẵn Colab API URL để frontend gọi sang bridge từ xa.

### 2. Tải `cloudflared.exe` vào thư mục tạm

Đặt `cloudflared.exe` vào thư mục temp trên máy bạn, rồi chạy tunnel từ port local đó ra internet.

### 3. Tunnel port local `8763` bằng Cloudflare

```bash
cloudflared.exe tunnel --url http://127.0.0.1:8763 --no-autoupdate

.\cloudflared.exe tunnel --url http://127.0.0.1:8763 --no-autoupdate
```

Cloudflare sẽ trả về public URL, ví dụ:

```text
https://your-public-web-demo.trycloudflare.com/
```

### 4. Luồng hoạt động

```text
Người dùng internet
    -> Cloudflare public URL
    -> máy bạn: http://127.0.0.1:8763
    -> web_demo/server.py
    -> Colab API: https://your-colab-bridge.trycloudflare.com/api/tryon
```

### 5. Lưu ý

- Đây là tunnel tạm thời, không cần đăng nhập Cloudflare.
- Link public sẽ đổi mỗi lần bạn chạy lại tunnel.
- Nếu đổi Colab bridge, nhớ cập nhật lại `--remote-url` tương ứng khi chạy `web_demo/server.py`.

## Deploy web demo lên Render

Ở root repo đã có `render.yaml`, `Procfile`, `requirements-web.txt` và `DEPLOY_RENDER.md`.

Luồng deploy:

```text
GitHub repo
    -> Render web service
    -> web_demo/server.py
    -> Colab/GPU API bridge
```

Render tự cấp biến môi trường `PORT`. Nếu muốn gắn sẵn API bridge, đặt biến `IDM_VTON_REMOTE_URL` trong Render. Nếu để trống, người dùng vẫn có thể dán link trong khối `Kết nối API` trên trang `/try-on`.
