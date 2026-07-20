/**
 * Verdict + check presentation metadata — the single source of truth for how
 * each verification outcome is coloured, labelled, and iconised across the UI.
 */
import {
  ShieldCheck,
  AlertTriangle,
  Ban,
  CalendarX,
  HelpCircle,
  Building2,
  type LucideIcon,
  Check,
  X,
  AlertCircle,
  MinusCircle,
} from "lucide-react";
import type { CheckStatus, Verdict } from "./api";

export interface VerdictMeta {
  label: string;
  /** Short human tagline shown under the badge. */
  tagline: string;
  icon: LucideIcon;
  /** Semantic colour family key (drives CSS classes). */
  tone: "ok" | "danger" | "warn" | "orange" | "neutral";
  /** Hex accent for inline SVG / glows. */
  accent: string;
}

export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  VALID: {
    label: "Valid",
    tagline: "Original file · anchored on Hedera",
    icon: ShieldCheck,
    tone: "ok",
    accent: "#22c55e",
  },
  TAMPERED: {
    label: "Tampered Detected",
    tagline: "Uploaded file does not match the anchored hash",
    icon: AlertTriangle,
    tone: "danger",
    accent: "#ef4444",
  },
  REVOKED: {
    label: "Revoked",
    tagline: "The issuer revoked this credential",
    icon: Ban,
    tone: "warn",
    accent: "#f59e0b",
  },
  EXPIRED: {
    label: "Expired",
    tagline: "Outside its valid time window",
    icon: CalendarX,
    tone: "warn",
    accent: "#f59e0b",
  },
  UNREGISTERED_ISSUER: {
    label: "Unregistered Issuer",
    tagline: "Not issued by a registered Cred402 issuer",
    icon: Building2,
    tone: "orange",
    accent: "#fb923c",
  },
  UNKNOWN: {
    label: "Unknown Credential",
    tagline: "No matching anchored record found",
    icon: HelpCircle,
    tone: "neutral",
    accent: "#94a3b8",
  },
};

/** Tailwind class fragments per tone (text, border, ambient bg). */
export const TONE_CLASSES: Record<VerdictMeta["tone"], { text: string; border: string; bg: string; glow: string }> = {
  ok: {
    text: "text-[var(--color-ok)]",
    border: "border-[color:rgba(34,197,94,0.4)]",
    bg: "bg-[color:rgba(34,197,94,0.08)]",
    glow: "glow-ok",
  },
  danger: {
    text: "text-[var(--color-danger)]",
    border: "border-[color:rgba(239,68,68,0.45)]",
    bg: "bg-[color:rgba(239,68,68,0.08)]",
    glow: "glow-danger",
  },
  warn: {
    text: "text-[var(--color-warn)]",
    border: "border-[color:rgba(245,158,11,0.4)]",
    bg: "bg-[color:rgba(245,158,11,0.08)]",
    glow: "",
  },
  orange: {
    text: "text-[var(--color-orange)]",
    border: "border-[color:rgba(251,146,60,0.4)]",
    bg: "bg-[color:rgba(251,146,60,0.08)]",
    glow: "",
  },
  neutral: {
    text: "text-[var(--color-neutral)]",
    border: "border-[color:rgba(148,163,184,0.35)]",
    bg: "bg-[color:rgba(148,163,184,0.08)]",
    glow: "",
  },
};

export interface CheckMeta {
  icon: LucideIcon;
  text: string;
  ring: string;
  dot: string;
}

export const CHECK_META: Record<CheckStatus, CheckMeta> = {
  PASS: { icon: Check, text: "text-[var(--color-ok)]", ring: "border-[color:rgba(34,197,94,0.45)]", dot: "bg-[var(--color-ok)]" },
  FAIL: { icon: X, text: "text-[var(--color-danger)]", ring: "border-[color:rgba(239,68,68,0.45)]", dot: "bg-[var(--color-danger)]" },
  WARN: { icon: AlertCircle, text: "text-[var(--color-warn)]", ring: "border-[color:rgba(245,158,11,0.45)]", dot: "bg-[var(--color-warn)]" },
  SKIP: { icon: MinusCircle, text: "text-[var(--color-neutral)]", ring: "border-[color:rgba(148,163,184,0.35)]", dot: "bg-[var(--color-neutral)]" },
};

/** Human labels for the six known check ids, in engine order. */
export const CHECK_ORDER = [
  "hash_integrity",
  "credential_known",
  "issuer_registered",
  "revocation",
  "expiration",
  "hcs_evidence",
] as const;
