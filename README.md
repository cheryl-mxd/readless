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
- `WEB_PORT` - host port for the Next.js frontend when using `docker compose`
- `API_PORT` - optional host port for direct API debugging when using `docker compose`
- `API_INTERNAL_URL` - internal API target used by the Next.js `/api` proxy, typically `http://api:8000`
- `READLESS_WEB_ORIGINS` - comma-separated browser origins allowed to call the API directly

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

## Interface (FastAPI)

`readless` also ships with a small FastAPI server for building a frontend UI or integrating with other tools.

### Start the server

```bash
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

### CORS

Set `READLESS_WEB_ORIGINS` (comma-separated) to allow browser clients:

```bash
READLESS_WEB_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

When you use the Next.js web app through its built-in `/api` proxy, the browser talks to the frontend origin and Next forwards requests to the API container internally. In that setup, you usually only need `READLESS_WEB_ORIGINS` for direct browser-to-API calls or custom deployments.

### Endpoints

- `GET /api/health` - health check
- `GET /api/providers` - available providers/models + templates + languages (and default content limit)
- `POST /api/summarize/url` - summarize a URL (JSON)
- `POST /api/summarize/url/stream` - summarize a URL with streaming NDJSON events
- `POST /api/summarize/pdf` - summarize a PDF upload (multipart/form-data)
- `POST /api/summarize/pdf/stream` - summarize a PDF upload with streaming NDJSON events

## Docker

### Start API only

```bash
docker build -t readless-api .
docker run --rm -p 8000:8000 --env-file .env readless-api
```

Health check:

```bash
curl http://localhost:8000/api/health
```

### Start API + Web UI (docker compose)

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- Browser-facing API entrypoint: `http://localhost:3000/api/...`
- Optional direct API debugging: `http://localhost:8000`

Notes:

- In Web mode, provider API keys come only from the key entered in the frontend UI (request `apiKey`).
- The frontend now calls the backend through the Next.js `/api` proxy, so you do not need to set a public backend URL in the frontend.
- `docker compose` reads deployment settings from the root `.env`, so you can change `WEB_PORT`, `API_PORT`, `API_INTERNAL_URL`, and `READLESS_WEB_ORIGINS` in one place.
- For cloud deployments, users can keep opening `http://<server-ip>:<WEB_PORT>` and the frontend will proxy `/api` requests to the API container.

### Cloud deployment example

For a cloud server, keep the browser entrypoint on the frontend port and let Next.js proxy `/api` requests internally.

Default `.env` example:

```bash
WEB_PORT=3000
API_PORT=8000
API_INTERNAL_URL=http://api:8000
READLESS_WEB_ORIGINS=http://<server-ip>:3000
```

Then start the stack:

```bash
docker compose up --build -d
```

Access patterns:

- Open the app in your browser at `http://<server-ip>:3000`
- The frontend will call the backend through `http://<server-ip>:3000/api/...`
- If you want to debug the API directly, use `http://<server-ip>:8000`

This setup means you usually only need to update the root `.env` when the server IP or exposed ports change.

### If port 8000 is already in use

If the host port `8000` is occupied, you do not need to change the frontend entrypoint or the internal API URL. Only change the exposed API port in the root `.env`:

```bash
WEB_PORT=3000
API_PORT=8001
API_INTERNAL_URL=http://api:8000
READLESS_WEB_ORIGINS=http://<server-ip>:3000
```

In that case:

- Keep opening the app at `http://<server-ip>:3000`
- The frontend still calls the backend through `http://<server-ip>:3000/api/...`
- Only the direct API debugging address changes to `http://<server-ip>:8001`
