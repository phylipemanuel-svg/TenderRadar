export type SourceStatus = "CONNECTED" | "NOT CONNECTED" | "MANUAL SEARCH REQUIRED" | "ERROR";
export type LiveStatus = "OPEN" | "CLOSING SOON" | "CLOSED" | "PIPELINE" | "MARKET ENGAGEMENT";
export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "NORMAL";
export type ChangeStatus = "NEW" | "UPDATED" | "UNCHANGED" | "CLOSED";
export type FitCategory =
  | "EXCEPTIONAL FIT"
  | "EXCELLENT FIT"
  | "STRONG FIT"
  | "POTENTIAL FIT"
  | "REVIEW / PARTNER"
  | "LOW FIT";
export type Decision = "NONE" | "SHORTLIST" | "IGNORE" | "BID" | "NO BID" | "REVIEW";
export type RegionId =
  | "wales"
  | "southwest"
  | "midlands"
  | "northwest"
  | "england"
  | "scotland"
  | "northernireland"
  | "uk";

export interface FitReason {
  points: number;
  label: string;
}

export interface FitResult {
  score: number;
  category: FitCategory;
  reasons: FitReason[];
  matchedServices: string[]; // keyword group labels that triggered
  matchedKeywords: string[];
  matchedCpv: string[];
  excluded?: string; // reason if an exclusion rule fired
}

export interface NoticeDocument {
  title: string;
  url: string;
  type?: string;
}

export interface Lot {
  id?: string;
  title?: string;
  value?: number | null;
  description?: string;
}

/** A normalised notice straight from a source, before scoring. */
export interface RawNotice {
  ocid: string | null;
  reference: string | null; // buyer's procurement reference / tender id
  noticeId: string | null; // source-specific notice identifier
  title: string;
  buyer: string;
  buyerClassification?: string | null;
  description: string;
  published: string | null; // ISO
  deadline: string | null; // ISO with time where available
  value: number | null;
  valueMin?: number | null;
  valueMax?: number | null;
  currency: string;
  vatBasis?: string | null;
  procurementMethod: string | null;
  procurementMethodDetails: string | null;
  stage: "planning" | "tender" | "award" | "unknown";
  rawStatus: string | null;
  isFramework: boolean;
  isDps: boolean;
  lots: Lot[];
  cpv: string[];
  regionCodes: string[];
  locationText: string;
  postcode?: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  durationText: string | null;
  extensionsText: string | null;
  url: string | null;
  documents: NoticeDocument[];
  sourceId: string;
  sourceLabel: string;
}

export interface Opportunity extends RawNotice {
  id: string; // dedupe key
  sources: string[]; // all source labels this notice was seen in
  region: RegionId | "unknown";
  regionLabel: string;
  buyerType: string;
  fit: FitResult;
  liveStatus: LiveStatus;
  daysRemaining: number | null;
  priority: Priority;
  changeStatus: ChangeStatus;
  changes: { field: string; from: string; to: string }[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  // user data joined from decisions table
  decision?: Decision;
  selected?: boolean;
  notes?: string;
  analysis?: ExternalAnalysis | null;
}

/** Structure produced by ChatGPT (or any external analyst) and imported back. */
export interface ExternalAnalysis {
  opportunity_id: string;
  strategic_fit?: number;
  what_buyer_is_procuring?: string;
  why_flotek_matches?: string;
  qualification_requirements?: string;
  capability_gaps?: string;
  commercial_attractiveness?: string;
  mandatory_accreditations?: string;
  bid_recommendation?: string; // BID | NO BID | QUALIFY
  recommended_next_action?: string;
  confidence?: string; // HIGH | MEDIUM | LOW
  rank?: number;
  imported_at?: string;
}

export interface KeywordGroup {
  id: string;
  label: string;
  terms: string[];
}

export interface CpvEntry {
  code: string; // 8 digits
  label: string;
  group: string; // keyword group id
}

export interface ScoringWeights {
  service: number;
  cpv: number;
  keyword: number;
  buyer: number;
  geography: number;
  value: number;
  framework: number;
  multiService: number;
}

export interface Settings {
  keywordGroups: KeywordGroup[];
  cpvLibrary: CpvEntry[];
  excludeKeywords: string[];
  weights: ScoringWeights;
  minScore: number;
  defaultRegions: RegionId[];
  lookbackDays: number;
  valueIdealMin: number;
  valueIdealMax: number;
  buyerPoints: Record<string, number>;
  feedUrls: Record<string, string>; // optional RSS/Atom feed URLs for feed-based sources
}

export interface SearchParams {
  regions: RegionId[];
  lookbackDays: number;
  sources: string[];
}

export interface SearchStats {
  checked: number;
  relevant: number;
  scoredAboveMin: number;
  strong: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  closedCount: number;
  perSource: Record<string, { checked: number; relevant: number; status: SourceStatus; message: string }>;
}

export interface SourceDefinition {
  id: string;
  label: string;
  kind: "api" | "feed" | "manual";
  website: string;
  description: string;
  allowedHosts: string[];
}
