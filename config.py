"""
Provider / model configuration.
Add your API keys to a .env file in the project root:

    ANTHROPIC_API_KEY=...
    OPENAI_API_KEY=...
    GOOGLE_API_KEY=...
    DASHSCOPE_API_KEY=...   # for Qwen
"""

import os
from pathlib import Path

PROVIDERS = {
    "claude": {
        "models": [
            "claude-opus-4-5",
            "claude-sonnet-4-5",
            "claude-haiku-4-5-20251001",
        ],
        "default": "claude-sonnet-4-5",
        "env_key": "ANTHROPIC_API_KEY",
    },
    "openai": {
        "models": ["gpt-4o", "gpt-4o-mini", "o4-mini"],
        "default": "gpt-4o-mini",
        "env_key": "OPENAI_API_KEY",
    },
    "gemini": {
        "models": ["gemini/gemini-3-flash-preview", "gemini/gemini-3.1-flash-lite-preview"],
        "default": "gemini/gemini-3.1-flash-lite-preview",
        "env_key": "GOOGLE_API_KEY",
    },
    "qwen": {
        # Qwen via DashScope OpenAI-compatible endpoint
        "models": ["openai/qwen-plus", "openai/qwen-max", "openai/qwen-turbo"],
        "default": "openai/qwen-plus",
        "env_key": "DASHSCOPE_API_KEY",
        "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
}

def _get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer, got: {value!r}") from exc


def _load_output_template(name: str) -> str:
    template_name = name.strip().lower().replace("_", "-")
    template_path = Path(__file__).with_name("templates") / f"{template_name}.md.tpl"
    if not template_path.exists():
        available = sorted(path.stem.replace(".md", "") for path in template_path.parent.glob("*.md.tpl"))
        raise ValueError(
            f"Unknown OUTPUT_TEMPLATE {name!r}. Available templates: {available}"
        )
    return template_path.read_text(encoding="utf-8").strip()


DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "qwen")
if DEFAULT_PROVIDER not in PROVIDERS:
    raise ValueError(f"DEFAULT_PROVIDER must be one of {list(PROVIDERS)}, got: {DEFAULT_PROVIDER!r}")

DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "Simplified-Chinese")
OUTPUT_TEMPLATE = os.getenv("OUTPUT_TEMPLATE", "obsidian")
SINGLE_PASS_CONTENT_LIMIT = _get_int_env("SINGLE_PASS_CONTENT_LIMIT", 12000)

PROMPT_ROLE = "Role: You are an expert research analyst skilled in synthesizing complex information."
LANGUAGE_RULE = f"All visible output content must use the configured output language: **{DEFAULT_LANGUAGE}**."

TITLE_RULES = """\
Rules for `title`:
- Generate a real title based on the article content.
- Do not output placeholder text such as `<title>`.
"""

TAG_RULES = f"""\
Rules for `tags`:
- Output 3-5 reusable, topic-level tags.
- Tags must use the configured output language: **{DEFAULT_LANGUAGE}**.
- Tags must be generalizable across many notes, not overly specific to this single article.
- Tags must reflect the article's core subject matter.
- Avoid overlapping, synonymous, or parent-child tags in the same note.
- Avoid title-like phrases, author names, years, or one-off event labels unless they are central topics of the article.
"""

SUMMARY_OUTPUT_FORMAT = f"""\
Output strictly in this Markdown format using the `{OUTPUT_TEMPLATE}` template:

{_load_output_template(OUTPUT_TEMPLATE)}
"""

FACTUAL_REQUIREMENTS = """\
- Be factual, concise, and grounded in the source.
- Do not invent facts, numbers, quotations, or claims that are not supported by the source.
- If the source does not provide a detail, do not fill it in.
"""

FINAL_NOTE_REQUIREMENTS = """\
- Keep `TL;DR` to 2-3 sentences.
- Write as many `Key Points` as needed to cover the article faithfully, usually 3-6.
- Prefer fewer points when the article has a single central thesis.
- Use more points only when the article contains multiple distinct arguments, mechanisms, or findings.
- Do not pad the list to reach a target count.
- Each point should state both the idea and why it matters.
- Keep `Commentary` analytical but source-grounded. Leave it blank if there is no meaningful implication or limitation to add.
"""

SUMMARY_CORE_REQUIREMENTS = f"""\
Requirements:
{FACTUAL_REQUIREMENTS}
- Capture the article's core thesis, supporting arguments, evidence, and limitations when present.
{FINAL_NOTE_REQUIREMENTS}
"""

CHUNK_REQUIREMENTS = """\
Requirements:
- Only include information supported by this chunk.
- Prefer precise statements over broad paraphrase.
- Keep the summary compact and avoid repetition.
- Do not infer article-wide conclusions from one chunk alone.
"""

FINAL_SUMMARY_REQUIREMENTS = f"""\
Requirements:
- Synthesize the whole article rather than concatenating chunk summaries.
- Merge repeated ideas and remove duplication.
- Preserve important conclusions, evidence, limitations, counterpoints, and later-section details.
- Do not invent facts, numbers, quotations, or claims that are not supported by the chunk summaries.
{FINAL_NOTE_REQUIREMENTS}
"""

SUMMARY_PROMPT = f"""\
{PROMPT_ROLE}
Task: Given the following article content, produce a concise summary note. {LANGUAGE_RULE}

{SUMMARY_CORE_REQUIREMENTS}

{TITLE_RULES}

{TAG_RULES}

{SUMMARY_OUTPUT_FORMAT}

Article content:
{{content}}
"""

CHUNK_SUMMARY_PROMPT = f"""\
{PROMPT_ROLE}
Task: Read one chunk from a longer article and produce a compact factual summary. {LANGUAGE_RULE}
Focus on the chunk's main claims, evidence, definitions, results, and caveats. Do not invent details.

{CHUNK_REQUIREMENTS}

Return Markdown in this format:

### Chunk {{chunk_number}}/{{chunk_total}}
- Main points:
- Evidence or examples:
- Caveats or open questions:

Article source: {{source}}
Date: {{date}}

Chunk content:
{{content}}
"""

FINAL_SUMMARY_PROMPT = f"""\
{PROMPT_ROLE}
Task: You are given chunk summaries from a longer article. Merge them into one final summary note. {LANGUAGE_RULE}
The final note must reflect the whole article rather than over-weighting the opening sections.

{FINAL_SUMMARY_REQUIREMENTS}

{TITLE_RULES}

{TAG_RULES}

{SUMMARY_OUTPUT_FORMAT}

Chunk summaries:
{{content}}
"""
