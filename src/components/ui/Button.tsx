/**
 * Custom Cred402 button — no Radix/shadcn. Variants via class-variance-authority,
 * class merging via the shared cn(). Primary variant carries the electric-blue
 * gradient + glow seen in the mockups' CTAs.
 */
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const button = cva(
  "relative inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-xl transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--color-brand-2)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "text-white bg-[linear-gradient(180deg,#22a7ff,#0a6fe0)] shadow-[0_10px_30px_-10px_rgba(0,140,255,0.7)] hover:shadow-[0_14px_40px_-10px_rgba(0,160,255,0.85)] hover:brightness-110 border border-[color:rgba(120,210,255,0.5)]",
        outline:
          "text-ink border border-border-strong bg-[color:rgba(13,23,48,0.5)] hover:bg-[color:rgba(20,35,64,0.7)] hover:border-brand/60",
        ghost: "text-ink-dim hover:text-ink hover:bg-white/5",
        danger:
          "text-white bg-[linear-gradient(180deg,#f2545b,#c02730)] border border-[color:rgba(255,150,150,0.4)] hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.95rem]",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  children: ReactNode;
}

export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  return (
    <button className={cn(button({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
