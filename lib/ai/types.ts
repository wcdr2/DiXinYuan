import type { Locale } from "@/lib/types";

export type ChatRole = "user" | "assistant" | "system";
export type ReferenceType = "article" | "region" | "entity" | "source";

export interface ReferenceItem {
  type: ReferenceType;
  label: string;
  href?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  references?: ReferenceItem[];
  createdAt: number;
}

export interface AIChatRequestMessage {
  role: Extract<ChatRole, "user" | "assistant">;
  content: string;
}

export interface AIChatRequestBody {
  locale: Locale;
  messages: AIChatRequestMessage[];
  pathname: string;
  search: string;
}

export interface AIChatResponseBody {
  reply: string;
  references: ReferenceItem[];
  meta?: {
    contextHitCount: number;
  };
  error?: string;
}
