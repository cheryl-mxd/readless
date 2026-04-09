"use client";

import { Copy, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type OutputSectionProps = {
  title: string;
  summary: string;
  isSubmitting: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  onSummaryChange: (value: string) => void;
  onCopy: () => Promise<void> | void;
  onDownload: () => void;
};

export function OutputSection({
  title,
  summary,
  isSubmitting,
  statusMessage,
  errorMessage,
  onSummaryChange,
  onCopy,
  onDownload,
}: OutputSectionProps) {
  const hasSummary = summary.trim().length > 0;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>Output</CardTitle>
          <CardDescription>
            The generated summary is returned as markdown.
          </CardDescription>
        </div>
        <CardAction className="hidden gap-2 sm:flex">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onCopy()}
            disabled={!hasSummary || isSubmitting}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onDownload}
            disabled={!hasSummary || isSubmitting}
          >
            <Download className="size-4" />
            Download
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={summary}
          placeholder="Your summary will appear here."
          className="min-h-72 resize-y bg-muted/20 font-mono text-sm"
          onChange={(event) => onSummaryChange(event.target.value)}
        />

        <div className="flex flex-col gap-3 sm:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onCopy()}
            disabled={!hasSummary || isSubmitting}
          >
            <Copy className="size-4" />
            Copy
          </Button>
          <Button
            type="button"
            onClick={onDownload}
            disabled={!hasSummary || isSubmitting}
          >
            <Download className="size-4" />
            Download
          </Button>
        </div>

        {title ? (
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="size-4" />
              <span className="truncate">{title}</span>
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        ) : null}

        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
