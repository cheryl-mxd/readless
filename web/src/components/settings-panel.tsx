"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PROVIDERS,
  LANGUAGE_OPTIONS,
  PROVIDER_OPTIONS,
  ProviderCatalog,
  ProviderName,
  TemplateCatalog,
  TEMPLATE_OPTIONS,
  TemplateName,
  LanguageName,
} from "@/lib/readless";

type SettingsPanelProps = {
  provider: ProviderName;
  model: string;
  contentLimit: number;
  apiKey: string;
  template: TemplateName;
  customTemplate: string;
  language: LanguageName;
  providerCatalog: ProviderCatalog;
  templateContents: TemplateCatalog;
  onProviderChange: (value: ProviderName) => void;
  onModelChange: (value: string) => void;
  onContentLimitChange: (value: number) => void;
  onApiKeyChange: (value: string) => void;
  onTemplateChange: (value: TemplateName) => void;
  onCustomTemplateChange: (value: string) => void;
  onLanguageChange: (value: LanguageName) => void;
  isSubmitting: boolean;
  isOpen: boolean;
  onToggle: () => void;
};

export function SettingsPanel({
  provider,
  model,
  contentLimit,
  apiKey,
  template,
  customTemplate,
  language,
  providerCatalog,
  templateContents,
  onProviderChange,
  onModelChange,
  onContentLimitChange,
  onApiKeyChange,
  onTemplateChange,
  onCustomTemplateChange,
  onLanguageChange,
  isSubmitting,
  isOpen,
  onToggle,
}: SettingsPanelProps) {
  const activeCatalog = providerCatalog[provider] ?? DEFAULT_PROVIDERS[provider];
  const templatePreview =
    template === "custom" ? customTemplate : templateContents[template] ?? "";

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "Collapse settings panel" : "Expand settings panel"}
        onClick={onToggle}
        className="fixed top-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition hover:bg-muted"
      >
        {isOpen ? (
          <PanelRightClose className="size-4" />
        ) : (
          <PanelRightOpen className="size-4" />
        )}
        Settings
      </button>

      {isOpen ? (
        <button
          type="button"
          aria-label="Close settings panel overlay"
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        />
      ) : null}

      <div
        className={`fixed top-20 right-4 z-50 w-[min(26rem,calc(100vw-2rem))] transition duration-200 sm:right-6 ${
          isOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0"
        }`}
      >
        <Card className="max-h-[calc(100vh-6rem)] overflow-y-auto border-border/70 bg-background/95 shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              API keys stay only in React state and disappear when the page reloads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="provider">LLM Provider</Label>
              <Select
                value={provider}
                onValueChange={(value) => onProviderChange(value as ProviderName)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">LLM Model</Label>
              <div className="flex flex-wrap gap-2">
                {activeCatalog.models.map((option) => {
                  const isActive = model === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onModelChange(option)}
                      disabled={isSubmitting}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <Input
                id="model"
                placeholder={activeCatalog.default}
                value={model}
                onChange={(event) => onModelChange(event.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Suggestions are loaded from the current provider. You can click one or type a custom model in the same field.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your provider API key"
                value={apiKey}
                onChange={(event) => onApiKeyChange(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-limit">Content Length Limit</Label>
              <Input
                id="content-limit"
                type="number"
                min={0}
                step={1000}
                value={contentLimit}
                onChange={(event) =>
                  onContentLimitChange(
                    Number.parseInt(event.target.value || "0", 10) || 1,
                  )
                }
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Controls how much content is processed in one pass before chunked summarization starts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={template}
                  onValueChange={(value) => onTemplateChange(value as TemplateName)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="template" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0 space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={language}
                  onValueChange={(value) => onLanguageChange(value as LanguageName)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-preview">
                {template === "custom" ? "Custom Template" : "Template Preview"}
              </Label>
              <Textarea
                id="template-preview"
                placeholder={
                  template === "custom"
                    ? "Write your custom markdown template here..."
                    : "Template preview will appear here."
                }
                value={templatePreview}
                onChange={(event) => onCustomTemplateChange(event.target.value)}
                className="min-h-36"
                disabled={isSubmitting || template !== "custom"}
                readOnly={template !== "custom"}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
