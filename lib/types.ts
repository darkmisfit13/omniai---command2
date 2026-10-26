export type Importance = "quick" | "normal" | "critical";

export interface Proposal {
  path: string;
  new_content: string;
  reason: string;
  status: "pending" | "sent" | "discarded";
}

export interface WebSource {
  title: string;
  url: string;
}

export interface AnswerMetadata {
  runtime: "local" | "cloud";
  provider?: string;
  model?: string;
  routing_note?: string;
  sources?: WebSource[];
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  archived_at?: string | null;
}

export interface Message {
  id: string;
  conversation_id?: string;
  role: "user" | "pilot";
  content: string;
  importance?: Importance;
  council_answers?: Record<string, string>;
  answer_metadata?: AnswerMetadata;
  proposal?: Proposal;
  created_at: string;
}

export interface ApprovalItem {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  outcome: "allowed" | "blocked" | "approved" | "rejected";
  detail: string;
  created_at: string;
}

export type MediaKind = "image" | "video" | "audio";

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  source: "upload" | "generated";
  prompt: string | null;
  provider: string | null;
  model: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export type ProviderAlertReason = "quota" | "missing_key" | "error";

export interface ProviderAlert {
  id: string;
  pipeline: string;
  provider: string;
  reason: ProviderAlertReason;
  message: string;
  acknowledged: boolean;
  created_at: string;
}
