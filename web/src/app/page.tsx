"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

import { InputSection } from "@/components/input-section";
import { ErrorDialog } from "@/components/error-dialog";
import { OutputSection } from "@/components/output-section";
import { RunLogSection } from "@/components/run-log-section";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  copyToClipboard,
  DEFAULT_PROVIDERS,
  DEFAULT_TEMPLATE_CONTENTS,
  downloadMarkdown,
  fetchProviders,
  LanguageName,
  ProviderCatalog,
  ProviderName,
  summarizePdf,
  summarizeUrl,
  TemplateCatalog,
  TemplateName,
} from "@/lib/readless";

export default function Home() {
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<ProviderName>("qwen");
  const [model, setModel] = useState(DEFAULT_PROVIDERS.qwen.default);
  const [contentLimit, setContentLimit] = useState(12000);
  const [apiKey, setApiKey] = useState("");
  const [template, setTemplate] = useState<TemplateName>("default-template");
  const [customTemplate, setCustomTemplate] = useState("");
  const [language, setLanguage] =
    useState<LanguageName>("Simplified Chinese");
  const [summary, setSummary] = useState("");
  const [runLog, setRunLog] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [filename, setFilename] = useState("untitled");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunLogOpen, setIsRunLogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [dialogTitle, setDialogTitle] = useState("Request failed");
  const [dialogMessage, setDialogMessage] = useState("");
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [providerCatalog, setProviderCatalog] =
    useState<ProviderCatalog>(DEFAULT_PROVIDERS);
  const [templateContents, setTemplateContents] =
    useState<TemplateCatalog>(DEFAULT_TEMPLATE_CONTENTS);

  useEffect(() => {
    let isMounted = true;

    void fetchProviders()
      .then((config) => {
        if (isMounted) {
          setProviderCatalog(config.providers);
          setTemplateContents(config.templateContents);
          setModel((current) => current || config.providers.qwen.default);
          setContentLimit(config.defaultContentLimit);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStatusMessage("Backend settings unavailable. Using built-in defaults.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (value.trim()) {
      setSelectedFile(null);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      setUrl("");
    }
  };

  const handleProviderChange = (value: ProviderName) => {
    setProvider(value);
    setModel(providerCatalog[value]?.default ?? DEFAULT_PROVIDERS[value].default);
  };

  const handleCopy = async () => {
    if (!summary.trim()) {
      return;
    }

    await copyToClipboard(summary);
    setStatusMessage("Summary copied to clipboard.");
  };

  const appendRunLog = (line: string) => {
    const timestamp = new Date().toLocaleTimeString("en-GB", {
      hour12: false,
    });
    setRunLog((current) => [...current, `[${timestamp}] ${line}`]);
  };

  const handleDownload = () => {
    if (!summary.trim()) {
      return;
    }

    downloadMarkdown(filename, summary);
    setStatusMessage("Markdown downloaded.");
  };

  const openErrorDialog = (title: string, message: string) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setIsErrorDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!apiKey.trim()) {
      setStatusMessage(null);
      openErrorDialog("Missing API key", "Please enter an API key before generating a summary.");
      return;
    }

    if (!url.trim() && !selectedFile) {
      setStatusMessage(null);
      openErrorDialog("Missing input", "Please provide either a URL or a PDF file.");
      return;
    }

    if (template === "custom" && !customTemplate.trim()) {
      setStatusMessage(null);
      openErrorDialog("Missing custom template", "Please provide a custom template before submitting.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Generating summary...");
    setRunLog([]);
    setIsRunLogOpen(true);
    setIsErrorDialogOpen(false);

    try {
      const result = selectedFile
        ? await summarizePdf({
            file: selectedFile,
            provider,
            model,
            apiKey,
            template,
            language,
            contentLimit,
            customTemplate,
            onLog: appendRunLog,
          })
        : await summarizeUrl({
            url,
            provider,
            model,
            apiKey,
            template,
            language,
            contentLimit,
            customTemplate,
            onLog: appendRunLog,
          });

      setSummary(result.summary);
      setTitle(result.title);
      setFilename(result.filename);
      setStatusMessage(`Summary ready with ${result.provider} (${result.model}).`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate summary.";
      setStatusMessage(null);
      openErrorDialog("Summary request failed", message);
    } finally {
      setIsSubmitting(false);
      setIsRunLogOpen(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,1),rgba(248,250,252,1),rgba(244,244,245,1))] px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="space-y-4">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5" />
              AI reading assistant
            </div>
            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
              Readless
            </h1>
            <p className="text-lg font-medium text-foreground/80">
              Read less, know more — clip, summarize, and archive to Markdown.
            </p>
          </div>

        </section>

        <Separator />

        <InputSection
          url={url}
          selectedFile={selectedFile}
          onUrlChange={handleUrlChange}
          onFileSelect={handleFileSelect}
          isSubmitting={isSubmitting}
        />

        <SettingsPanel
          provider={provider}
          model={model}
          contentLimit={contentLimit}
          apiKey={apiKey}
          template={template}
          customTemplate={customTemplate}
          language={language}
          providerCatalog={providerCatalog}
          templateContents={templateContents}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
          onContentLimitChange={setContentLimit}
          onApiKeyChange={setApiKey}
          onTemplateChange={setTemplate}
          onCustomTemplateChange={setCustomTemplate}
          onLanguageChange={setLanguage}
          isSubmitting={isSubmitting}
          isOpen={isSettingsOpen}
          onToggle={() => setIsSettingsOpen((current) => !current)}
        />

        <div className="flex flex-col items-stretch gap-3 rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Generate summary</p>
            <p className="text-xs text-muted-foreground">
              Submit the current URL or PDF with the selected provider and
              template.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="min-w-40"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Summarizing...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        <RunLogSection
          runLog={runLog}
          isOpen={isRunLogOpen}
          isRunning={isSubmitting}
          onToggle={() => setIsRunLogOpen((current) => !current)}
        />

        <OutputSection
          title={title}
          summary={summary}
          isSubmitting={isSubmitting}
          statusMessage={statusMessage}
          errorMessage={null}
          onSummaryChange={setSummary}
          onCopy={handleCopy}
          onDownload={handleDownload}
        />
      </div>

      <ErrorDialog
        isOpen={isErrorDialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        onClose={() => setIsErrorDialogOpen(false)}
      />
    </main>
  );
}
