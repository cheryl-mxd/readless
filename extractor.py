"""
Content extraction from URLs and PDFs.
Strategy: trafilatura first, Jina Reader as fallback.
"""

from pathlib import Path

import requests
import trafilatura


def from_url(url: str) -> tuple[str, str]:
    """
    Extract (title, content) from a web URL.
    Falls back to Jina Reader if trafilatura returns too little text.
    """
    downloaded = trafilatura.fetch_url(url)
    content = trafilatura.extract(
        downloaded,
        include_comments=False,
        include_tables=True,
        favor_precision=True,
    )
    title = _extract_title(downloaded) or url

    if content and len(content) > 300:
        return title, content

    # Fallback: Jina Reader (free, no key required)
    print("  trafilatura returned little content, trying Jina Reader fallback...")
    jina_url = f"https://r.jina.ai/{url}"
    resp = requests.get(jina_url, timeout=30)
    resp.raise_for_status()
    return title, resp.text


def from_pdf(path: str) -> tuple[str, str]:
    """Extract (title, content) from a local PDF file."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise ImportError("pypdf is required for PDF support: pip install pypdf")

    reader = PdfReader(path)
    pages = [page.extract_text() or "" for page in reader.pages]
    content = "\n\n".join(pages).strip()
    title = reader.metadata.get("/Title", "") or Path(path).stem
    return title, content


def _extract_title(html: str | bytes | None) -> str:
    """Best-effort title extraction from raw HTML."""
    if not html:
        return ""
    try:
        meta = trafilatura.extract_metadata(html)
        return meta.title if meta and meta.title else ""
    except Exception:
        return ""
