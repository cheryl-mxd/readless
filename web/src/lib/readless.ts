"use client";

export type ProviderName = "qwen" | "openai" | "gemini" | "claude";
export type TemplateName = "default-template" | "obsidian" | "custom";
export type LanguageName = "English" | "Simplified Chinese";

export type ProviderCatalog = Record<
  ProviderName,
  {
    models: string[];
    default: string;
  }
>;

export type TemplateCatalog = Record<string, string>;
export type AppConfig = {
  providers: ProviderCatalog;
  templateContents: TemplateCatalog;
  defaultContentLimit: number;
};

export type SummaryResponse = {
  title: string;
  filename: string;
  summary: string;
  sourceType: "url" | "pdf";
  provider: ProviderName;
  model: string;
};

type StreamEvent =
  | { type: "log"; message: string }
  | { type: "result"; data: SummaryResponse }
  | { type: "error"; message: string }
  | { type: "done" };

export const PROVIDER_OPTIONS: ProviderName[] = [
  "qwen",
  "openai",
  "gemini",
  "claude",
];

export const TEMPLATE_OPTIONS: TemplateName[] = [
  "default-template",
  "obsidian",
  "custom",
];

export const LANGUAGE_OPTIONS: LanguageName[] = [
  "English",
  "Simplified Chinese",
];

export const DEFAULT_PROVIDERS: ProviderCatalog = {
  qwen: {
    models: ["openai/qwen-plus", "openai/qwen-max", "openai/qwen-turbo"],
    default: "openai/qwen-plus",
  },
  openai: {
    models: ["gpt-4o", "gpt-4o-mini", "o4-mini"],
    default: "gpt-4o-mini",
  },
  gemini: {
    models: [
      "gemini/gemini-3-flash-preview",
      "gemini/gemini-3.1-flash-lite-preview",
    ],
    default: "gemini/gemini-3.1-flash-lite-preview",
  },
  claude: {
    models: [
      "claude-opus-4-5",
      "claude-sonnet-4-5",
      "claude-haiku-4-5-20251001",
    ],
    default: "claude-sonnet-4-5",
  },
};

export const DEFAULT_TEMPLATE_CONTENTS: TemplateCatalog = {
  "default-template": `# <title>

> Source: {source}
> Date: {date}
> Tags: <tag1>, <tag2>, <tag3>

## TL;DR
<2-3 sentences summarizing the core value and findings.>

## Key Points
- **[Concept/Focus]**: Description of the point and its significance.
- **[Concept/Focus]**: Description of the point and its significance.
- ...

## Commentary
<Critically analyze implications, limitations, or unique insights. Leave blank if none.>`,
  obsidian: `---
title: "<title>"
source: {source}
date: {date}
tags: ["<tag1>", "<tag2>", "<tag3>"]
---

## TL;DR
<2-3 sentences summarizing the core value and findings.>

## Key Points
- **[Concept/Focus]**: Description of the point and its significance.
- **[Concept/Focus]**: Description of the point and its significance.
- ...

## Commentary
<Critically analyze implications, limitations, or unique insights. Leave blank if none.>`,
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

function getBackendUnavailableMessage(): string {
  return `Cannot reach the backend at ${API_BASE_URL}. Please make sure the FastAPI server is running.`;
}

function getStreamRouteNotFoundMessage(): string {
  return "The frontend is calling the new streaming API, but your backend does not expose that route yet. Please restart the FastAPI server so it loads the latest code.";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TypeError") {
      return getBackendUnavailableMessage();
    }
    return error.message;
  }
  return "Something went wrong while generating the summary.";
}

async function consumeSummaryStream(
  response: Response,
  onLog?: (message: string) => void,
): Promise<SummaryResponse> {
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(getStreamRouteNotFoundMessage());
    }

    try {
      const data = (await response.json()) as { detail?: string };
      throw new Error(data.detail ?? "Failed to generate summary.");
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Streaming is not available for this response.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: SummaryResponse | null = null;
  let streamError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const event = JSON.parse(trimmed) as StreamEvent;
      if (event.type === "log") {
        onLog?.(event.message);
      } else if (event.type === "result") {
        finalResult = event.data;
      } else if (event.type === "error") {
        streamError = event.message;
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer.trim()) as StreamEvent;
    if (event.type === "log") {
      onLog?.(event.message);
    } else if (event.type === "result") {
      finalResult = event.data;
    } else if (event.type === "error") {
      streamError = event.message;
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  if (!finalResult) {
    throw new Error("Summary stream completed without a result.");
  }

  return finalResult;
}

export async function fetchProviders(): Promise<AppConfig> {
  const response = await fetch(`${API_BASE_URL}/api/providers`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load provider settings.");
  }

  const data = (await response.json()) as {
    providers: ProviderCatalog;
    templateContents?: TemplateCatalog;
    defaultContentLimit?: number;
  };
  return {
    providers: data.providers,
    templateContents: data.templateContents ?? DEFAULT_TEMPLATE_CONTENTS,
    defaultContentLimit: data.defaultContentLimit ?? 12000,
  };
}

export async function summarizeUrl(input: {
  url: string;
  provider: ProviderName;
  model?: string;
  apiKey: string;
  template: TemplateName;
  language: LanguageName;
  customTemplate: string;
  contentLimit: number;
  onLog?: (message: string) => void;
}): Promise<SummaryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/summarize/url/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: input.url,
        provider: input.provider,
        model: input.model?.trim() || null,
        apiKey: input.apiKey,
        template: input.template,
        language: input.language,
        contentLimit: input.contentLimit,
        customTemplate:
          input.template === "custom" ? input.customTemplate : null,
      }),
    });
    return await consumeSummaryStream(response, input.onLog);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function summarizePdf(input: {
  file: File;
  provider: ProviderName;
  model?: string;
  apiKey: string;
  template: TemplateName;
  language: LanguageName;
  customTemplate: string;
  contentLimit: number;
  onLog?: (message: string) => void;
}): Promise<SummaryResponse> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("provider", input.provider);
  if (input.model?.trim()) {
    formData.append("model", input.model.trim());
  }
  formData.append("apiKey", input.apiKey);
  formData.append("template", input.template);
  formData.append("language", input.language);
  formData.append("contentLimit", String(input.contentLimit));

  if (input.template === "custom") {
    formData.append("customTemplate", input.customTemplate);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/summarize/pdf/stream`, {
      method: "POST",
      body: formData,
    });
    return await consumeSummaryStream(response, input.onLog);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}

export async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
