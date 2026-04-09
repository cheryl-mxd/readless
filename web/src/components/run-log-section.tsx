"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";

import { Button } from "@/components/ui/button";

type RunLogSectionProps = {
  runLog: string[];
  isOpen: boolean;
  isRunning: boolean;
  onToggle: () => void;
};

export function RunLogSection({
  runLog,
  isOpen,
  isRunning,
  onToggle,
}: RunLogSectionProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const renderedLines = useMemo(
    () =>
      runLog.map((line, index) => {
        let className = "text-zinc-200";

        if (line.includes("❌") || line.toLowerCase().includes("error")) {
          className = "text-red-300";
        } else if (line.includes("✅")) {
          className = "text-emerald-300";
        } else if (line.includes("🤖")) {
          className = "text-sky-300";
        } else if (line.includes("🌐") || line.includes("📄")) {
          className = "text-amber-200";
        } else if (line.startsWith("[")) {
          className = "text-zinc-200";
        }

        return (
          <div key={`${index}-${line}`} className={className}>
            {line}
          </div>
        );
      }),
    [runLog],
  );

  useEffect(() => {
    if (!isOpen || !isRunning || !scrollContainerRef.current) {
      return;
    }

    scrollContainerRef.current.scrollTop =
      scrollContainerRef.current.scrollHeight;
  }, [isOpen, isRunning, runLog]);

  if (runLog.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Terminal className="size-4" />
          <span>Run Log</span>
          <span className={isRunning ? "text-sky-600" : "text-emerald-600"}>
            {isRunning ? "Running" : "Completed"}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onToggle}>
          {isOpen ? (
            <>
              <ChevronDown className="size-4" />
              Collapse
            </>
          ) : (
            <>
              <ChevronRight className="size-4" />
              Expand
            </>
          )}
        </Button>
      </div>

      {isOpen ? (
        <div className="rounded-lg border border-border/70 bg-zinc-950 p-3 text-zinc-100 shadow-sm">
          <div
            ref={scrollContainerRef}
            className="max-h-64 overflow-y-auto rounded-md bg-black/30 p-3 font-mono text-xs leading-6"
          >
            <div className="space-y-1 whitespace-pre-wrap break-words">
              {renderedLines}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
