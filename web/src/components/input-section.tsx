"use client";

import { useRef } from "react";
import { FileText, Link as LinkIcon, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InputSectionProps = {
  url: string;
  selectedFile: File | null;
  onUrlChange: (value: string) => void;
  onFileSelect: (file: File | null) => void;
  isSubmitting: boolean;
};

export function InputSection({
  url,
  selectedFile,
  onUrlChange,
  onFileSelect,
  isSubmitting,
}: InputSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle>Input</CardTitle>
        <CardDescription>
          Paste a URL or upload a PDF to generate a markdown summary.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 min-[640px]:grid-cols-[minmax(0,2.3fr)_minmax(11.5rem,1fr)] min-[640px]:items-end">
        <div className="space-y-2">
          <Label htmlFor="article-url">Article URL</Label>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="article-url"
              type="url"
              inputMode="url"
              placeholder="https://example.com/article"
              className="pl-9"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="space-y-2 min-[640px]:border-l min-[640px]:border-border/70 min-[640px]:pl-5">
          <Label htmlFor="pdf-upload">PDF Upload</Label>
          <input
            ref={fileInputRef}
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
            disabled={isSubmitting}
          />

          <Button
            type="button"
            variant="outline"
            className="w-fit min-w-32 justify-start"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
          >
            <Upload className="size-4" />
            {selectedFile ? "Replace PDF" : "Choose PDF"}
          </Button>
        </div>

        {selectedFile ? (
          <div className="min-[640px]:col-span-2">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 px-2 text-muted-foreground"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                  onFileSelect(null);
                }}
                disabled={isSubmitting}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}

      </CardContent>
    </Card>
  );
}
