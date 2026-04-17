import { NextResponse } from "next/server";
import { buildChatContext } from "@/lib/ai/context";
import { DeepSeekError, hasDeepSeekConfig, requestDeepSeekChat } from "@/lib/ai/deepseek";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { AIChatRequestBody, AIChatRequestMessage, AIChatResponseBody } from "@/lib/ai/types";
import { getDictionary } from "@/lib/site";
import type { Locale } from "@/lib/types";

const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 10;

function isLocale(value: unknown): value is Locale {
  return value === "zh" || value === "en";
}

function sanitizeMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const role = "role" in item ? item.role : undefined;
      const content = "content" in item ? item.content : undefined;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
        return null;
      }

      const normalized = content.trim().replace(/\s+/g, " ");
      if (!normalized) {
        return null;
      }

      return {
        role,
        content: normalized,
      } satisfies AIChatRequestMessage;
    })
    .filter((item): item is AIChatRequestMessage => Boolean(item))
    .slice(-MAX_HISTORY_MESSAGES);
}

function createErrorResponse(
  locale: Locale,
  error: string,
  status: number,
  meta?: AIChatResponseBody["meta"],
  references: AIChatResponseBody["references"] = [],
) {
  return NextResponse.json(
    {
      reply: "",
      references,
      meta,
      error,
    } satisfies AIChatResponseBody,
    { status },
  );
}

export async function POST(request: Request) {
  let body: Partial<AIChatRequestBody> | null = null;

  try {
    body = (await request.json()) as Partial<AIChatRequestBody>;
  } catch {
    return createErrorResponse("zh", "请求体格式无效。", 400);
  }

  const locale: Locale = isLocale(body?.locale) ? body.locale : "zh";
  const dict = getDictionary(locale).ai;
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  const search = typeof body?.search === "string" ? body.search : "";
  const messages = sanitizeMessages(body?.messages);
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  if (!pathname || messages.length === 0 || !latestUserMessage) {
    return createErrorResponse(locale, dict.errors.requestInvalid, 400);
  }

  if (latestUserMessage.length > MAX_INPUT_LENGTH) {
    return createErrorResponse(locale, dict.errors.tooLong, 400);
  }

  const context = buildChatContext({
    locale,
    messages,
    pathname,
    search,
  });

  if (context.meta.contextHitCount === 0) {
    return NextResponse.json({
      reply: dict.scopeFallback,
      references: [],
      meta: context.meta,
    } satisfies AIChatResponseBody);
  }

  if (!hasDeepSeekConfig()) {
    return createErrorResponse(locale, dict.errors.missingConfig, 503, context.meta, context.references);
  }

  try {
    const reply = await requestDeepSeekChat({
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            locale,
            currentPageLabel: context.currentPageLabel,
            contextHitCount: context.meta.contextHitCount,
          }),
        },
        {
          role: "system",
          content: context.promptContext,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    });

    return NextResponse.json({
      reply,
      references: context.references,
      meta: context.meta,
    } satisfies AIChatResponseBody);
  } catch (error) {
    if (error instanceof DeepSeekError) {
      return createErrorResponse(locale, dict.errors.serviceUnavailable, error.status, context.meta, context.references);
    }

    return createErrorResponse(locale, dict.errors.requestFailed, 500, context.meta, context.references);
  }
}
