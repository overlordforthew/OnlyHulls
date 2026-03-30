"""Shared Playwright fetcher for JS-rendered boat listing sites.

Usage:
    from pw_fetch import PlaywrightFetcher

    with PlaywrightFetcher() as pf:
        html = pf.get("https://example.com")           # returns HTML string
        page = pf.get_page("https://example.com")      # returns Playwright Page
"""

from playwright.sync_api import sync_playwright, Page


class PlaywrightFetcher:
    def __init__(self):
        self._pw = None
        self._browser = None

    def __enter__(self):
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=[
                "--disable-gpu",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-extensions",
                "--disable-background-networking",
                "--disable-default-apps",
                "--no-first-run",
            ],
        )
        return self

    def __exit__(self, *args):
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()

    def get(self, url: str, wait_ms: int = 3000, timeout: int = 45000) -> str:
        """Navigate to URL, wait for JS, return rendered HTML string."""
        page = self._browser.new_page()
        try:
            page.goto(url, timeout=timeout, wait_until="domcontentloaded")
            page.wait_for_timeout(wait_ms)
            return page.content()
        except Exception as e:
            print(f"  [pw_fetch] Error fetching {url}: {e}")
            return ""
        finally:
            page.close()

    def get_page(self, url: str, wait_ms: int = 5000, timeout: int = 45000) -> Page:
        """Navigate to URL, wait for JS, return the Page object (caller must close)."""
        page = self._browser.new_page()
        try:
            page.goto(url, timeout=timeout, wait_until="domcontentloaded")
            page.wait_for_timeout(wait_ms)
            return page
        except Exception as e:
            print(f"  [pw_fetch] Error fetching {url}: {e}")
            return page
