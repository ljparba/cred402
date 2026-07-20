/**
 * Drag-and-drop upload zone (mockup 2, left). Keyboard-operable (Enter/Space
 * opens the picker), announces drag state, validates type/size client-side for
 * fast feedback (the server re-validates authoritatively), and surfaces the
 * chosen file. Accepts PDF, PNG, JPG.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileCheck2, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatBytes } from "@/components/lib/format";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 5 * 1024 * 1024;
const OK_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function UploadDropzone({
  onFile,
  disabled,
  selected,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  selected?: { name: string; size: number } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((file: File): string | null => {
    const okType =
      OK_TYPES.includes(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
    if (!okType) return "Unsupported file type. Use PDF, PNG, or JPG.";
    if (file.size > MAX_BYTES) return `File too large (${formatBytes(file.size)}). Max 5 MB.`;
    return null;
  }, []);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const err = validate(file);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile, validate],
  );

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a certificate. Drag a file here or press Enter to browse."
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handle(e.dataTransfer.files?.[0]);
        }}
        animate={{
          borderColor: dragging ? "var(--color-brand)" : "var(--color-border)",
          scale: dragging ? 1.01 : 1,
        }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-[color:rgba(6,12,26,0.5)] px-6 py-10 text-center transition-colors",
          dragging && "bg-[color:rgba(0,180,255,0.06)]",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-brand/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handle(e.target.files?.[0])}
        />

        <motion.div
          animate={dragging ? { y: -4 } : { y: 0 }}
          className="grid h-20 w-20 place-items-center rounded-full border border-dashed border-brand/50 bg-[color:rgba(0,180,255,0.06)]"
        >
          {selected ? (
            <FileCheck2 className="h-9 w-9 text-ok" />
          ) : (
            <UploadCloud className="h-9 w-9 text-brand-2" />
          )}
        </motion.div>

        {selected ? (
          <div>
            <p className="text-lg font-semibold text-ink">{selected.name}</p>
            <p className="text-sm text-ink-dim">{formatBytes(selected.size)} · ready to scan</p>
          </div>
        ) : (
          <div>
            <p className="text-xl font-semibold text-ink">Drop your certificate here</p>
            <p className="mt-1 text-sm text-ink-dim">PDF, PNG, JPG supported · max 5 MB</p>
          </div>
        )}

        <div className="flex w-full items-center gap-3 text-xs text-ink-faint">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" size="md" disabled={disabled} type="button" className="pointer-events-none">
          <FileCheck2 className="h-4 w-4" /> Choose File
        </Button>

        <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <Lock className="h-3.5 w-3.5" /> Hashed server-side · files are never stored
        </p>
      </motion.div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-[color:rgba(239,68,68,0.4)] bg-[color:rgba(239,68,68,0.08)] px-3 py-2 text-sm text-danger-soft"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
