"""
LLM summarization via litellm (unified interface for all providers).
"""

import os
import re
from datetime import date

import litellm
from litellm import completion

from config import (
    CHUNK_SUMMARY_PROMPT,
    DEFAULT_PROVIDER,
    FINAL_SUMMARY_PROMPT,
    PROVIDERS,
    SINGLE_PASS_CONTENT_LIMIT,
    SUMMARY_PROMPT,
)

litellm.suppress_debug_info = True


def _split_paragraphs(content: str) -> list[str]:
    return [part.strip() for part in re.split(r"\n\s*\n+", content) if part.strip()]


def _split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?。！？])\s+", text)
    return [sentence.strip() for sentence in sentences if sentence.strip()]


def _is_section_heading(paragraph: str) -> bool:
    line = paragraph.strip()
    if not line or "\n" in line:
        return False
    if re.match(r"^#{1,6}\s+\S", line):
        return True
    if re.match(r"^[-=]{3,}$", line):
        return False
    if len(line) > 120:
        return False
    if re.search(r"[.!?。！？]$", line):
        return False
    words = line.split()
    if not words:
        return False
    if len(words) <= 12 and sum(ch.isupper() for ch in line if ch.isalpha()) >= max(3, len(line) // 4):
        return True
    return len(words) <= 12 and line == line.title()


def _pack_units(units: list[str], max_chars: int, separator: str = "\n\n") -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for unit in units:
        unit = unit.strip()
        if not unit:
            continue
        if current and current_len >= max_chars:
            chunks.append(separator.join(current))
            current = [unit]
            current_len = len(unit)
            continue
        added_len = len(unit) if not current else len(unit) + len(separator)
        current.append(unit)
        current_len += added_len

    if current:
        chunks.append(separator.join(current))

    return chunks


def _split_long_paragraph(paragraph: str, max_chars: int) -> list[str]:
    if len(paragraph) <= max_chars:
        return [paragraph]
    sentences = _split_sentences(paragraph)
    if len(sentences) <= 1:
        return [paragraph]
    return _pack_units(sentences, max_chars, separator=" ")


def _split_sections(paragraphs: list[str]) -> list[tuple[str | None, list[str]]]:
    sections: list[tuple[str | None, list[str]]] = []
    current_heading: str | None = None
    current_body: list[str] = []

    for paragraph in paragraphs:
        if _is_section_heading(paragraph):
            if current_heading is not None or current_body:
                sections.append((current_heading, current_body))
            current_heading = paragraph
            current_body = []
        else:
            current_body.append(paragraph)

    if current_heading is not None or current_body:
        sections.append((current_heading, current_body))

    return sections


def _expand_section_chunks(heading: str | None, paragraphs: list[str], max_chars: int) -> list[str]:
    if not paragraphs:
        return [heading] if heading else []

    section_units: list[str] = []
    for paragraph in paragraphs:
        section_units.extend(_split_long_paragraph(paragraph, max_chars))

    chunks: list[str] = []
    current_body: list[str] = []

    for unit in section_units:
        candidate_body = current_body + [unit]
        candidate_chunk = "\n\n".join(([heading] if heading else []) + candidate_body)
        if current_body and len(candidate_chunk) > max_chars and len(
            "\n\n".join(([heading] if heading else []) + current_body)
        ) >= max_chars:
            chunks.append("\n\n".join(([heading] if heading else []) + current_body))
            current_body = [unit]
        else:
            current_body = candidate_body

    if current_body:
        chunks.append("\n\n".join(([heading] if heading else []) + current_body))

    return chunks


def _chunk_text(content: str, max_chars: int) -> list[str]:
    paragraphs = _split_paragraphs(content)
    if not paragraphs:
        return [content.strip()] if content.strip() else [""]

    sections = _split_sections(paragraphs)
    section_chunks: list[str] = []
    for heading, body in sections:
        section_chunks.extend(_expand_section_chunks(heading, body, max_chars))

    return _pack_units(section_chunks, max_chars)


def _complete(model_name: str, prompt: str, extra: dict) -> str:
    response = completion(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        **extra,
    )
    return response.choices[0].message.content.strip()


def summarize(
    content: str,
    source: str,
    provider: str = DEFAULT_PROVIDER,
    model: str | None = None,
) -> str:
    """
    Summarize content using the specified provider/model.
    Returns a markdown string.
    """
    provider = provider.lower()
    if provider not in PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'. Choose from: {list(PROVIDERS)}")

    cfg = PROVIDERS[provider]
    model_name = model or cfg["default"]

    # Inject API key and optional base URL
    api_key = os.getenv(cfg["env_key"])
    if not api_key:
        raise EnvironmentError(
            f"Missing environment variable: {cfg['env_key']}\n"
            f"Add it to your .env file."
        )

    extra = {}
    if provider == "gemini":
        # Force LiteLLM onto Gemini API instead of Vertex AI auth.
        if not model_name.startswith("gemini/"):
            model_name = f"gemini/{model_name}"
        extra["api_key"] = api_key
    if "api_base" in cfg:
        extra["api_base"] = cfg["api_base"]
        extra["api_key"] = api_key  # litellm needs it explicitly for custom bases

    prompt = SUMMARY_PROMPT.format(
        source=source,
        date=date.today().isoformat(),
        content=content[:SINGLE_PASS_CONTENT_LIMIT],
    )
    paragraphs = _split_paragraphs(content)
    section_count = sum(1 for paragraph in paragraphs if _is_section_heading(paragraph))
    chunks = _chunk_text(content, SINGLE_PASS_CONTENT_LIMIT)
    use_chunking = len(content) > SINGLE_PASS_CONTENT_LIMIT and len(chunks) > 1

    if use_chunking:
        chunk_summaries = []
        total_chunks = len(chunks)
        if section_count > 0:
            print(f"   Chunked summarization enabled: {total_chunks} chunks (section-aware, {section_count} sections detected)")
        else:
            print(f"   Chunked summarization enabled: {total_chunks} chunks (paragraph-only mode)")
        for index, chunk in enumerate(chunks, start=1):
            print(f"   Summarizing chunk {index}/{total_chunks}...")
            chunk_prompt = CHUNK_SUMMARY_PROMPT.format(
                chunk_number=index,
                chunk_total=total_chunks,
                source=source,
                date=date.today().isoformat(),
                content=chunk,
            )
            chunk_summaries.append(_complete(model_name, chunk_prompt, extra))

        prompt = FINAL_SUMMARY_PROMPT.format(
            source=source,
            date=date.today().isoformat(),
            content="\n\n".join(chunk_summaries),
        )
        print("   Merging chunk summaries...")

    return _complete(model_name, prompt, extra)
