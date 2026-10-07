from __future__ import annotations

import ipaddress
import urllib.robotparser
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from soupsieve.util import SelectorSyntaxError
from workers import Response, WorkerEntrypoint, fetch

USER_AGENT = "CrawlerConsole/1.1 (+Cloudflare Python Worker)"
HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.7",
}
MAX_HTML_BYTES = 2_500_000
MAX_ROBOTS_BYTES = 256_000
MAX_REDIRECTS = 4


class ScrapeError(Exception):
    pass


def normalize_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise ScrapeError("請輸入網址。")
    if "://" not in url:
        url = "https://" + url

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ScrapeError("只允許 http:// 或 https:// 網址。")
    if not parsed.hostname:
        raise ScrapeError("網址缺少有效的主機名稱。")
    if parsed.username or parsed.password:
        raise ScrapeError("網址不可包含帳號或密碼。")
    return url


def validate_target_url(raw_url: str) -> str:
    url = normalize_url(raw_url)
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").rstrip(".").lower()

    if hostname in {"localhost", "localhost.localdomain"} or hostname.endswith(".local"):
        raise ScrapeError("基於安全性，不允許存取 localhost 或 .local 網址。")

    try:
        ip = ipaddress.ip_address(hostname.strip("[]"))
    except ValueError:
        ip = None

    if ip is not None and not ip.is_global:
        raise ScrapeError("基於安全性，不允許存取私有、保留或本機網路位址。")

    if hostname in {"metadata.google.internal", "metadata.aws.internal"}:
        raise ScrapeError("基於安全性，不允許存取雲端 metadata 位址。")

    return url


async def read_limited(response, max_bytes: int) -> bytes:
    content_length = response.headers.get("Content-Length")
    if content_length:
        try:
            if int(content_length) > max_bytes:
                raise ScrapeError(f"目標頁面過大，限制為約 {max_bytes // 1_000_000} MB。")
        except ValueError:
            pass

    body = bytes(await response.bytes())
    if len(body) > max_bytes:
        raise ScrapeError(f"目標頁面過大，限制為約 {max_bytes // 1_000_000} MB。")
    return body


async def fetch_once(url: str, max_bytes: int):
    try:
        response = await fetch(url, headers=HEADERS, redirect="manual")
    except Exception as exc:
        raise ScrapeError("連線失敗，請確認網址可從公開網路存取。") from exc
    body = await read_limited(response, max_bytes)
    return response, body


async def robots_allows(target_url: str) -> tuple[bool, str]:
    parsed = urlparse(target_url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    current = validate_target_url(robots_url)

    try:
        for _ in range(3):
            response, body = await fetch_once(current, MAX_ROBOTS_BYTES)
            status = int(response.status)
            if 300 <= status < 400:
                location = response.headers.get("Location")
                if not location:
                    return True, "robots.txt 重新導向無效；未套用禁止規則。"
                current = validate_target_url(urljoin(current, location))
                continue
            if status == 404:
                return True, "robots.txt 不存在（404），未發現禁止規則。"
            if status >= 400:
                return True, f"robots.txt 回傳 HTTP {status}，本工具未套用禁止規則。"

            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(current)
            parser.parse(body.decode("utf-8", errors="replace").splitlines())
            allowed = parser.can_fetch(USER_AGENT, target_url)
            return allowed, "robots.txt 允許此路徑。" if allowed else "robots.txt 禁止此 User-Agent 抓取此路徑。"
    except ScrapeError:
        return True, "robots.txt 無法讀取；仍會繼續，但正式使用前應自行確認網站政策。"

    return True, "robots.txt 重新導向次數過多；未套用禁止規則。"


async def fetch_html(raw_url: str, obey_robots: bool = True):
    current = validate_target_url(raw_url)
    notes: list[str] = []

    for _ in range(MAX_REDIRECTS + 1):
        if obey_robots:
            allowed, note = await robots_allows(current)
            notes.append(note)
            if not allowed:
                raise ScrapeError("robots.txt 不允許抓取此網址。請尊重網站的爬蟲政策。")

        response, body = await fetch_once(current, MAX_HTML_BYTES)
        status = int(response.status)

        if 300 <= status < 400:
            location = response.headers.get("Location")
            if not location:
                raise ScrapeError("網站回傳了無效的重新導向。")
            current = validate_target_url(urljoin(current, location))
            continue

        if status >= 400:
            raise ScrapeError(f"目標網站回傳 HTTP {status}。")

        content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type and content_type not in {"text/html", "application/xhtml+xml"}:
            raise ScrapeError(f"此工具只處理 HTML；目標回傳 {content_type}。")

        return current, status, body, " ".join(dict.fromkeys(notes)) if obey_robots else "未檢查 robots.txt。"

    raise ScrapeError("重新導向次數過多。")


def clean_text(value: str) -> str:
    return " ".join(value.split())


def extract_items(html: bytes | str, base_url: str, selector: str, limit: int) -> list[dict]:
    selector = (selector or "").strip()
    if not selector:
        raise ScrapeError("請輸入 CSS Selector，例如 article、a 或 .card。")

    try:
        soup = BeautifulSoup(html, "html.parser")
        nodes = soup.select(selector)
    except SelectorSyntaxError as exc:
        raise ScrapeError("CSS Selector 格式不正確。") from exc

    items = []
    for node in nodes[:limit]:
        heading = node.select_one("h1, h2, h3, h4, h5, h6")
        link_node = node if node.name == "a" else node.select_one("a[href]")
        image_node = node if node.name == "img" else node.select_one("img[src]")

        text = clean_text(node.get_text(" ", strip=True))
        title = clean_text(heading.get_text(" ", strip=True)) if heading else ""
        if not title and link_node:
            title = clean_text(link_node.get_text(" ", strip=True))
        if not title:
            title = text[:100]

        href = urljoin(base_url, str(link_node.get("href"))) if link_node and link_node.get("href") else ""
        image = urljoin(base_url, str(image_node.get("src"))) if image_node and image_node.get("src") else ""

        items.append({
            "title": title or "（無標題）",
            "text": text[:1200],
            "url": href,
            "image": image,
            "tag": node.name or "unknown",
        })
    return items


async def scrape(payload: dict) -> dict:
    try:
        limit = int(payload.get("limit", 20))
    except (TypeError, ValueError) as exc:
        raise ScrapeError("最多筆數必須是數字。") from exc

    if not 1 <= limit <= 50:
        raise ScrapeError("最多筆數必須介於 1 到 50。")

    selector = str(payload.get("selector", "")).strip()
    target, status, body, robots_message = await fetch_html(
        str(payload.get("url", "")),
        obey_robots=bool(payload.get("obey_robots", True)),
    )
    items = extract_items(body, target, selector, limit)

    return {
        "url": target,
        "status_code": status,
        "selector": selector,
        "count": len(items),
        "items": items,
        "robots_message": robots_message,
    }


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        path = urlparse(request.url).path

        if path == "/health":
            return Response.json({
                "ok": True,
                "service": "crawler-console",
                "runtime": "cloudflare-python-worker",
            })

        if path == "/api/scrape":
            if request.method != "POST":
                return Response.json({"ok": False, "error": "Method Not Allowed"}, status=405)
            try:
                payload = await request.json()
                result = await scrape(payload)
                return Response.json({"ok": True, **result})
            except ScrapeError as exc:
                return Response.json({"ok": False, "error": str(exc)}, status=400)
            except Exception:
                return Response.json({"ok": False, "error": "伺服器發生未預期錯誤。"}, status=500)

        if path.startswith("/api/"):
            return Response.json({"ok": False, "error": "Not Found"}, status=404)

        return await self.env.ASSETS.fetch(request)
