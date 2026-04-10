import os
import tempfile
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from queue import Empty, Queue
from threading import Thread
import asyncio
import json

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from config import PROVIDERS, SINGLE_PASS_CONTENT_LIMIT, load_output_template
from extractor import from_pdf, from_url
from main import safe_filename
from schemas import ProviderInfo, ProvidersResponse, SummarizeResponse, SummarizeUrlRequest
from summarizer import summarize

load_dotenv()
class _QueueWriter:
    def __init__(self, event_queue: Queue):
        self.event_queue = event_queue
        self._buffer = ""

    def write(self, text: str) -> int:
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            line = line.rstrip()
            if line:
                self.event_queue.put({"type": "log", "message": line})
        return len(text)

    def flush(self) -> None:
        line = self._buffer.rstrip()
        if line:
            self.event_queue.put({"type": "log", "message": line})
        self._buffer = ""


def _friendly_llm_error(exc: Exception) -> str:
    status_code = getattr(exc, "status_code", None)
    exc_type = type(exc).__name__
    head = str(exc)[:600]

    if status_code == 503 or exc_type in {"ServiceUnavailableError"}:
        return "The LLM service is currently busy. Please try again later or switch provider/model."
    if status_code == 429 or exc_type in {"RateLimitError"}:
        return "The LLM request hit a rate limit or quota restriction. Please try again later."
    if status_code in {401, 403}:
        return "Authentication failed. Please verify the API key and requested model."

    return f"LLM request failed ({exc_type}{f', status={status_code}' if status_code else ''}). {head}"


def _summarize_content(
    *,
    content: str,
    source: str,
    title: str,
    provider: str,
    model: str | None,
    api_key: str,
    template: str,
    language: str,
    custom_template: str | None,
    content_limit: int | None,
    source_type: str,
) -> SummarizeResponse:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    try:
        summary = summarize(
            content=content,
            source=source,
            provider=provider,
            model=model,
            api_key=api_key,
            language=language,
            template=template,
            custom_template=custom_template,
            content_limit=content_limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=_friendly_llm_error(exc)) from exc

    return SummarizeResponse(
        title=title,
        filename=f"{safe_filename(title)}.md",
        summary=summary,
        sourceType=source_type,
        provider=provider,
        model=model or PROVIDERS[provider]["default"],
    )


def _emit_log(event_queue: Queue, message: str) -> None:
    event_queue.put({"type": "log", "message": message})


async def _stream_events(event_queue: Queue) -> StreamingResponse:
    async def event_generator():
        while True:
            try:
                item = event_queue.get(timeout=0.2)
            except Empty:
                await asyncio.sleep(0.05)
                continue

            yield json.dumps(item, ensure_ascii=False) + "\n"
            if item["type"] == "done":
                break

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


def _start_summary_worker(
    *,
    source_type: str,
    source: str,
    provider: str,
    model: str | None,
    api_key: str,
    template: str,
    language: str,
    custom_template: str | None,
    content_limit: int | None,
    event_queue: Queue,
    pdf_path: str | None = None,
) -> None:
    def worker() -> None:
        writer = _QueueWriter(event_queue)
        try:
            with redirect_stdout(writer), redirect_stderr(writer):
                _emit_log(event_queue, f"$ readless {source_type} {source}")

                if source_type == "url":
                    _emit_log(event_queue, f"🌐 Fetching: {source}")
                    title, content = from_url(source)
                else:
                    _emit_log(event_queue, f"📄 Reading PDF: {source}")
                    title, content = from_pdf(pdf_path or source)

                if title:
                    _emit_log(event_queue, f"   Title: {title}")
                _emit_log(event_queue, f"   Extracted {len(content)} chars")

                model_name = model or PROVIDERS[provider]["default"]
                _emit_log(event_queue, f"🤖 Summarizing with {provider} ({model_name})...")

                result = _summarize_content(
                    content=content,
                    source=source,
                    title=title,
                    provider=provider,
                    model=model,
                    api_key=api_key,
                    template=template,
                    language=language,
                    custom_template=custom_template,
                    content_limit=content_limit,
                    source_type=source_type,
                )

                _emit_log(event_queue, f"✅ Saved: {result.filename}")
                event_queue.put({"type": "result", "data": result.model_dump()})
        except Exception as exc:
            message = exc.detail if isinstance(exc, HTTPException) else _friendly_llm_error(exc)
            event_queue.put({"type": "error", "message": message})
        finally:
            writer.flush()
            if pdf_path:
                Path(pdf_path).unlink(missing_ok=True)
            event_queue.put({"type": "done"})

    Thread(target=worker, daemon=True).start()


app = FastAPI(title="Readless API")

web_origins = [
    origin.strip()
    for origin in os.getenv(
        "READLESS_WEB_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=web_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/providers", response_model=ProvidersResponse)
def list_providers() -> ProvidersResponse:
    return ProvidersResponse(
        providers={
            name: ProviderInfo(models=cfg["models"], default=cfg["default"])
            for name, cfg in PROVIDERS.items()
        },
        templates=["default-template", "obsidian", "custom"],
        languages=["English", "Simplified Chinese"],
        templateContents={
            "default-template": load_output_template("default-template"),
            "obsidian": load_output_template("obsidian"),
        },
        defaultContentLimit=SINGLE_PASS_CONTENT_LIMIT,
    )


@app.post("/api/summarize/url", response_model=SummarizeResponse)
def summarize_url(payload: SummarizeUrlRequest) -> SummarizeResponse:
    title, content = from_url(str(payload.url))
    return _summarize_content(
        content=content,
        source=str(payload.url),
        title=title,
        provider=payload.provider,
        model=payload.model,
        api_key=payload.apiKey,
        template=payload.template,
        language=payload.language,
        custom_template=payload.customTemplate,
        content_limit=payload.contentLimit,
        source_type="url",
    )


@app.post("/api/summarize/url/stream")
async def summarize_url_stream(payload: SummarizeUrlRequest) -> StreamingResponse:
    event_queue: Queue = Queue()
    _start_summary_worker(
        source_type="url",
        source=str(payload.url),
        provider=payload.provider,
        model=payload.model,
        api_key=payload.apiKey,
        template=payload.template,
        language=payload.language,
        custom_template=payload.customTemplate,
        content_limit=payload.contentLimit,
        event_queue=event_queue,
    )
    return await _stream_events(event_queue)


@app.post("/api/summarize/pdf", response_model=SummarizeResponse)
async def summarize_pdf(
    file: UploadFile = File(...),
    provider: str = Form(...),
    apiKey: str = Form(...),
    template: str = Form("default-template"),
    language: str = Form("Simplified Chinese"),
    model: str | None = Form(None),
    customTemplate: str | None = Form(None),
    contentLimit: int | None = Form(None),
) -> SummarizeResponse:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    if template == "custom" and not (customTemplate or "").strip():
        raise HTTPException(status_code=400, detail="customTemplate is required when template is 'custom'.")
    if Path(file.filename or "").suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(await file.read())
            temp_path = temp_file.name

        title, content = from_pdf(temp_path)
        return _summarize_content(
            content=content,
            source=file.filename or "uploaded.pdf",
            title=title,
            provider=provider,
            model=model,
            api_key=apiKey,
            template=template,
            language=language,
            custom_template=customTemplate,
            content_limit=contentLimit,
            source_type="pdf",
        )
    finally:
        await file.close()
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)


@app.post("/api/summarize/pdf/stream")
async def summarize_pdf_stream(
    file: UploadFile = File(...),
    provider: str = Form(...),
    apiKey: str = Form(...),
    template: str = Form("default-template"),
    language: str = Form("Simplified Chinese"),
    model: str | None = Form(None),
    customTemplate: str | None = Form(None),
    contentLimit: int | None = Form(None),
) -> StreamingResponse:
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")
    if template == "custom" and not (customTemplate or "").strip():
        raise HTTPException(status_code=400, detail="customTemplate is required when template is 'custom'.")
    if Path(file.filename or "").suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    await file.close()

    event_queue: Queue = Queue()
    _start_summary_worker(
        source_type="pdf",
        source=file.filename or "uploaded.pdf",
        provider=provider,
        model=model,
        api_key=apiKey,
        template=template,
        language=language,
        custom_template=customTemplate,
        content_limit=contentLimit,
        event_queue=event_queue,
        pdf_path=temp_path,
    )
    return await _stream_events(event_queue)
