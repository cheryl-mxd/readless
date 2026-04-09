"use client";

import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ErrorDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function ErrorDialog({
  isOpen,
  title,
  message,
  onClose,
}: ErrorDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close error dialog"
        className="fixed inset-0 z-[70] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/30 shadow-2xl">
          <CardHeader>
            <div className="space-y-1">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
                <AlertTriangle className="size-3.5" />
                Request Error
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                The current request could not be completed.
              </CardDescription>
            </div>
            <CardAction>
              <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">{message}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
