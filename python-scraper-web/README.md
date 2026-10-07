# Crawler Console — Cloudflare Python Worker

這是放在 `Ray20123315/html` 的獨立爬蟲專案，部署根目錄是本資料夾。

## 架構

- 前端：單頁 HTML / CSS / JavaScript
- 後端：Cloudflare Python Worker
- HTML parser：Beautiful Soup
- HTTP：Cloudflare Workers 原生 async `fetch()`
- API：`POST /api/scrape`
- Health：`GET /health`

## 本機開發

需要 uv 與 Node.js：

```bash
uv sync
uv run pywrangler dev
```

## 部署

```bash
uv run pywrangler deploy
```

如果使用 Cloudflare Git integration，Root directory 設為：

```text
python-scraper-web
```

## 安全限制

會阻擋 localhost、.local、明確私有／保留 IP literal 與常見雲端 metadata hostname；逐跳檢查重新導向，預設讀取 robots.txt，HTML 上限約 2.5 MB。

這個版本只解析伺服器回傳的 HTML，不執行目標網站 JavaScript。使用前仍需遵守目標網站服務條款、robots.txt、著作權與資料使用規範。
