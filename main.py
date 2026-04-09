"""
Auto-summarize CLI
Usage examples:
  python main.py url https://example.com/article
  python main.py url https://example.com/article --provider openai --model gpt-4o-mini
  python main.py pdf ./paper.pdf --provider gemini
  python main.py url https://example.com --output ./notes/
"""

import re
from pathlib import Path

import click
from dotenv import load_dotenv

load_dotenv()

from extractor import from_url, from_pdf
from summarizer import summarize
from config import PROVIDERS, DEFAULT_PROVIDER


def safe_filename(text: str) -> str:
    """Convert a title string to a safe filename."""
    text = re.sub(r"[^\w\s-]", "", text).strip()
    text = re.sub(r"[\s_-]+", "-", text)
    text = text.strip("-_")
    return text[:80] or "untitled"

def _friendly_llm_error(e: Exception) -> str:
    status_code = getattr(e, "status_code", None)
    exc_type = type(e).__name__
    head = str(e)[:600]

    if status_code == 503 or exc_type in {"ServiceUnavailableError"}:
        return (
            "The LLM service is currently busy (503 UNAVAILABLE / high demand). Please try again later.\n"
            "You can also switch to another model or provider (for example `--provider claude` or `--provider openai`)."
        )
    if status_code == 429 or exc_type in {"RateLimitError"}:
        return (
            "The LLM request hit a rate limit or quota restriction (429 Too Many Requests / quota exceeded).\n"
            "Please try again later, or switch to another provider or model."
        )
    if status_code == 401 or status_code == 403:
        return "Authentication failed (401/403). Please check that the corresponding API key is valid and has access to the requested model."

    return f"LLM request failed ({exc_type}{f', status={status_code}' if status_code else ''}).\n{head}"


def write_output(content: str, title: str, output_dir: str) -> Path:
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    filename = out / f"{safe_filename(title)}.md"
    filename.write_text(content, encoding="utf-8")
    return filename


@click.group()
def cli():
    """📝 Auto-summarize articles, emails, and PDFs into Markdown notes."""
    pass


def _common_options(f):
    f = click.option("--provider", "-p",
                     type=click.Choice(list(PROVIDERS), case_sensitive=False),
                     default=DEFAULT_PROVIDER, show_default=True,
                     help="LLM provider to use.")(f)
    f = click.option("--model", "-m", default=None,
                     help="Specific model (defaults to provider default).")(f)
    f = click.option("--output", "-o", default="./output",
                     help="Output directory for .md files.", show_default=True)(f)
    return f


@cli.command()
@click.argument("url")
@_common_options
def url(url, provider, model, output):
    """Summarize a web page from URL."""
    click.echo(f"🌐 Fetching: {url}")
    title, content = from_url(url)
    click.echo(f"   Title: {title}")
    click.echo(f"   Extracted {len(content)} chars")

    click.echo(f"🤖 Summarizing with {provider} ({model or PROVIDERS[provider]['default']})...")
    try:
        summary = summarize(content, source=url, provider=provider, model=model)
    except Exception as e:
        raise click.ClickException(_friendly_llm_error(e))

    out_path = write_output(summary, title, output)
    click.echo(f"✅ Saved: {out_path}")
    click.echo("\n" + summary)


@cli.command()
@click.argument("path", type=click.Path(exists=True))
@_common_options
def pdf(path, provider, model, output):
    """Summarize a local PDF file."""
    click.echo(f"📄 Reading PDF: {path}")
    title, content = from_pdf(path)
    click.echo(f"   Extracted {len(content)} chars")

    click.echo(f"🤖 Summarizing with {provider} ({model or PROVIDERS[provider]['default']})...")
    try:
        summary = summarize(content, source=path, provider=provider, model=model)
    except Exception as e:
        raise click.ClickException(_friendly_llm_error(e))

    out_path = write_output(summary, title, output)
    click.echo(f"✅ Saved: {out_path}")
    click.echo("\n" + summary)


@cli.command()
def list_models():
    """List all available providers and models."""
    for prov, cfg in PROVIDERS.items():
        default = cfg["default"]
        click.echo(f"\n{prov}  (key: {cfg['env_key']})")
        for m in cfg["models"]:
            marker = " ← default" if m == default else ""
            click.echo(f"  {m}{marker}")


if __name__ == "__main__":
    cli()
