/**
 * Cred402 demo data catalogue — the single source of truth for issuers,
 * credentials, and downloadable samples. Fully fictional/synthetic data.
 *
 * Consumed by:
 *   - scripts/generate-certificates.ts  (renders PDFs from these rows)
 *   - scripts/seed.ts                   (seeds the DB)
 *   - scripts/anchor-credentials.ts     (submits HCS issuance/revocation events)
 *
 * SHA-256 hashes are NOT here — they are produced when the PDFs are generated
 * and written to scripts/data/hashes.generated.json, then merged at seed time.
 * This keeps hashes provably derived from real files, never hand-typed.
 */

export interface CatalogIssuer {
  id: string;
  name: string;
  registered: boolean;
}

export interface CatalogCredential {
  id: string;
  issuerId: string;
  studentName: string;
  courseName: string;
  grade: string;
  issuedAt: string; // ISO
  expiresAt: string | null; // ISO or null
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  revokedAt: string | null; // ISO or null
}

export type SampleCategory =
  | "valid"
  | "tampered"
  | "expired"
  | "revoked"
  | "fake"
  | "unregistered";

export type Verdict =
  | "VALID"
  | "TAMPERED"
  | "REVOKED"
  | "EXPIRED"
  | "UNKNOWN"
  | "UNREGISTERED_ISSUER";

export interface CatalogSample {
  slug: string;
  /** Credential this file represents; null for the counterfeit/unknown sample. */
  credentialId: string | null;
  category: SampleCategory;
  label: string;
  description: string;
  /** Path under samples/, e.g. "valid/hedera-fundamentals.pdf". */
  filename: string;
  expectedVerdict: Verdict;
  /**
   * When true, this file is a post-issuance edit of its credential's original
   * PDF — same look, one field changed, so its hash diverges from the anchor.
   */
  tampered?: boolean;
  /** Field changed in the tampered variant (for the demo diff panel). */
  tamperedField?: string;
}

const DEMO = "ISS-CRED402-DEMO";
const UNREG = "ISS-NORTHGATE-OPEN";

export const issuers: CatalogIssuer[] = [
  { id: DEMO, name: "Cred402 Demo Institute", registered: true },
  { id: UNREG, name: "Northgate Open Academy", registered: false },
];

export const credentials: CatalogCredential[] = [
  {
    id: "CRED-2026-0001",
    issuerId: DEMO,
    studentName: "Alice Marchetti",
    courseName: "Hedera Developer Fundamentals",
    grade: "Distinction",
    issuedAt: "2026-01-15T00:00:00Z",
    expiresAt: "2029-01-15T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2026-0002",
    issuerId: DEMO,
    studentName: "Bruno Takahashi",
    courseName: "Blockchain Security Basics",
    grade: "Merit",
    issuedAt: "2026-02-03T00:00:00Z",
    expiresAt: "2029-02-03T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2026-0003",
    issuerId: DEMO,
    studentName: "Carla Nwosu",
    courseName: "Web Development Foundations",
    grade: "Pass",
    issuedAt: "2026-02-20T00:00:00Z",
    expiresAt: null,
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    // Flagship tamper pair — original. The tampered sample shares this id.
    id: "CRED-2026-0004",
    issuerId: DEMO,
    studentName: "Devon Alvarez",
    courseName: "Data Structures and Algorithms",
    grade: "Distinction",
    issuedAt: "2026-01-28T00:00:00Z",
    expiresAt: "2031-01-28T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2022-0005",
    issuerId: DEMO,
    studentName: "Elena Rossi",
    courseName: "Cybersecurity Awareness",
    grade: "Merit",
    issuedAt: "2019-06-01T00:00:00Z",
    expiresAt: "2022-06-01T00:00:00Z",
    status: "EXPIRED",
    revokedAt: null,
  },
  {
    id: "CRED-2025-0006",
    issuerId: DEMO,
    studentName: "Farid Hassan",
    courseName: "Digital Identity Essentials",
    grade: "Distinction",
    issuedAt: "2025-03-10T00:00:00Z",
    expiresAt: "2028-03-10T00:00:00Z",
    status: "REVOKED",
    revokedAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "CRED-2026-0007",
    issuerId: DEMO,
    studentName: "Grace Lindqvist",
    courseName: "Hedera Developer Fundamentals",
    grade: "Merit",
    issuedAt: "2026-03-05T00:00:00Z",
    expiresAt: "2029-03-05T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    // Issued by an UNREGISTERED issuer.
    id: "CRED-2026-0008",
    issuerId: UNREG,
    studentName: "Henry Osei",
    courseName: "Web Development Foundations",
    grade: "Pass",
    issuedAt: "2026-04-11T00:00:00Z",
    expiresAt: null,
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2026-0009",
    issuerId: DEMO,
    studentName: "Ingrid Bauer",
    courseName: "Blockchain Security Basics",
    grade: "Distinction",
    issuedAt: "2026-04-22T00:00:00Z",
    expiresAt: "2029-04-22T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2026-0010",
    issuerId: DEMO,
    studentName: "Jamal Reed",
    courseName: "Cybersecurity Awareness",
    grade: "Merit",
    issuedAt: "2026-05-09T00:00:00Z",
    expiresAt: "2029-05-09T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2026-0011",
    issuerId: DEMO,
    studentName: "Kseniya Popova",
    courseName: "Digital Identity Essentials",
    grade: "Pass",
    issuedAt: "2026-05-30T00:00:00Z",
    expiresAt: "2029-05-30T00:00:00Z",
    status: "ACTIVE",
    revokedAt: null,
  },
  {
    id: "CRED-2021-0012",
    issuerId: DEMO,
    studentName: "Liam O'Connor",
    courseName: "Web Development Foundations",
    grade: "Merit",
    issuedAt: "2018-09-14T00:00:00Z",
    expiresAt: "2021-09-14T00:00:00Z",
    status: "EXPIRED",
    revokedAt: null,
  },
];

export const samples: CatalogSample[] = [
  {
    slug: "valid-hedera-fundamentals",
    credentialId: "CRED-2026-0001",
    category: "valid",
    label: "Valid · Hedera Developer Fundamentals",
    description:
      "Genuine certificate. Uploaded hash matches the HCS-anchored issuance record. Active, registered issuer, not revoked, not expired.",
    filename: "valid/hedera-fundamentals.pdf",
    expectedVerdict: "VALID",
  },
  {
    slug: "valid-data-structures-original",
    credentialId: "CRED-2026-0004",
    category: "valid",
    label: "Valid · Data Structures (original of tamper pair)",
    description:
      "The ORIGINAL of the flagship tamper demo. Hash matches the anchor. Compare against the tampered version below — visually identical, hashes diverge.",
    filename: "valid/data-structures-original.pdf",
    expectedVerdict: "VALID",
  },
  {
    slug: "tampered-data-structures",
    credentialId: "CRED-2026-0004",
    category: "tampered",
    label: "Tampered · Data Structures (grade altered)",
    description:
      "Same certificate, edited after issuance: the grade was changed. Looks authentic, but its SHA-256 no longer matches the HCS anchor for CRED-2026-0004.",
    filename: "tampered/data-structures-tampered.pdf",
    expectedVerdict: "TAMPERED",
    tampered: true,
    tamperedField: "grade",
  },
  {
    slug: "expired-cybersecurity-awareness",
    credentialId: "CRED-2022-0005",
    category: "expired",
    label: "Expired · Cybersecurity Awareness",
    description:
      "Authentic and hash-matching, but past its expiry date (2022-06-01). Demonstrates the expiration check.",
    filename: "expired/cybersecurity-awareness.pdf",
    expectedVerdict: "EXPIRED",
  },
  {
    slug: "revoked-digital-identity",
    credentialId: "CRED-2025-0006",
    category: "revoked",
    label: "Revoked · Digital Identity Essentials",
    description:
      "Authentic and hash-matching, but a CREDENTIAL_REVOKED event was later recorded on HCS. Demonstrates the issuance→revocation timeline.",
    filename: "revoked/digital-identity.pdf",
    expectedVerdict: "REVOKED",
  },
  {
    slug: "unregistered-web-dev",
    credentialId: "CRED-2026-0008",
    category: "unregistered",
    label: "Unregistered issuer · Web Development Foundations",
    description:
      "Hash-matching certificate, but issued by 'Northgate Open Academy' — not a registered/trusted Cred402 issuer.",
    filename: "unregistered/web-dev-foundations.pdf",
    expectedVerdict: "UNREGISTERED_ISSUER",
  },
  {
    slug: "fake-counterfeit",
    credentialId: null,
    category: "fake",
    label: "Unknown · Counterfeit certificate",
    description:
      "A fabricated certificate whose credential ID resolves to nothing and has no HCS anchor. Demonstrates the 'unknown credential' result.",
    filename: "fake/counterfeit-certificate.pdf",
    expectedVerdict: "UNKNOWN",
  },
];
