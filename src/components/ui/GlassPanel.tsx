/**
 * Glass panel primitive — the recurring translucent card surface from the
 * mockups (subtle border, blur, soft drop shadow). Optional cyan glow for
 * active/scanner frames.
 */
import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function GlassPanel({
  className,
  children,
  glow = false,
  as: As = "div",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  glow?: boolean;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <As className={cn("glass rounded-2xl", glow && "glow-brand", className)} {...props}>
      {children}
    </As>
  );
}

/** Small uppercase section eyebrow with an accent bracket, as in the mockups. */
export function SectionLabel({
  children,
  className,
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-2",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
