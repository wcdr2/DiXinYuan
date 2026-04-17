import "server-only";

type LLMRole = "system" | "user" | "assistant";

export interface DeepSeekMessage {
  role: LLMRole;
  content: string;
}

interface DeepSeekChatOptions {
  messages: DeepSeekMessage[];
  temperature?: number;
  maxTokens?: number;
}

export class DeepSeekError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "DeepSeekError";
    this.status = status;
  }
}

function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? "";
  const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object" && "text" in item) {
          const value = item.text;
          return typeof value === "string" ? value : "";
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export function hasDeepSeekConfig() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export async function requestDeepSeekChat({
  messages,
  temperature = 0.25,
  maxTokens = 900,
}: DeepSeekChatOptions) {
  const { apiKey, baseUrl, model } = getDeepSeekConfig();

  if (!apiKey) {
    throw new DeepSeekError("Missing DeepSeek API key.", 503);
  }

  const endpoint = new URL("chat/completions", `${baseUrl}/`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: { message?: string };
        choices?: Array<{
          message?: {
            content?: unknown;
          };
        }>;
      }
    | null;

  if (!response.ok) {
    throw new DeepSeekError(
      payload?.error?.message?.trim() || `DeepSeek request failed with status ${response.status}.`,
      response.status,
    );
  }

  const reply = extractTextContent(payload?.choices?.[0]?.message?.content);
  if (!reply) {
    throw new DeepSeekError("DeepSeek returned an empty response.", 502);
  }

  return reply;
}
