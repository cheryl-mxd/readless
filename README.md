# readless

> Read less, know more — clip, summarize, and archive to Markdown.

`readless` is a CLI tool that ingests web pages, PDFs, and emails, summarizes them using an LLM of your choice, and saves the result as a structured Markdown note.

## Features

- 🌐 **Web pages** — via `trafilatura`, with Jina Reader fallback
- 📄 **PDF files** — local file extraction
- 🤖 **Multi-provider LLM** — Claude, OpenAI, Gemini, Qwen (switchable)
- ✂️ **Long-article chunking** — section-aware chunking with paragraph/sentence fallback
- 📝 **Structured Markdown output** — TL;DR, key points, tags, source link

## Installation

```bash
git clone https://github.com/<you>/readless.git
cd readless
pip install -e .
```

## Configuration

```bash
cp .env.example .env
# Fill in at least one API key
```

`.env` keys:

| Provider | Key |
|---|---|
| Claude | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Gemini | `GOOGLE_API_KEY` |
| Qwen | `DASHSCOPE_API_KEY` |

Optional `.env` defaults:

- `DEFAULT_PROVIDER` - default LLM provider, for example `qwen`
- `DEFAULT_LANGUAGE` - output language used by prompts
- `OUTPUT_TEMPLATE` - output template name, for example `obsidian` or `default-markdown`
- `SINGLE_PASS_CONTENT_LIMIT` - max content length for one-pass summarization and per-chunk splitting

## Usage

```bash
# Summarize a web page (default: Qwen)
readless url https://example.com/article

# Quote URLs that contain query parameters such as "&"
readless url "https://example.com/article?utm_source=newsletter&ref=mail"

# Switch provider / model
readless url https://example.com/article --provider openai --model gpt-4o-mini
readless url https://example.com/article --provider gemini

# Summarize a PDF
readless pdf ./paper.pdf

# List all available models
readless list-models
```

Output is saved to `./output/<title>.md` by default. Override with `--output <dir>`.

Long articles are automatically split using section-aware chunking when headings can be detected, with paragraph and sentence fallback for oversized sections or paragraphs.

## Output Format

Available templates:

- `obsidian` - frontmatter + note sections
- `default-markdown` - plain Markdown heading + metadata lines

`obsidian` example:

```markdown
---
title: Article Title
source: https://...
date: 2026-04-08
tags: [finance, llm, trading]
---

## TL;DR
...

## Key Points
- ...

## Commentary
...
```

`default-markdown` example:

```markdown
# Article Title

Source: https://...
Date: 2026-04-08
Tags: finance, llm, trading

## TL;DR
...

## Key Points
- ...

## Commentary
...
```
