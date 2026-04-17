"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { AIChatResponseBody, ChatMessage, ReferenceItem } from "@/lib/ai/types";
import { getDictionary } from "@/lib/site";
import type { Locale } from "@/lib/types";

interface AIChatWidgetProps {
  locale: Locale;
}

const MAX_INPUT_LENGTH = 1000;

function createMessage(role: ChatMessage["role"], content: string, references?: ReferenceItem[]): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    references,
    createdAt: Date.now(),
  };
}

function normalizeErrorMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function AIChatWidget({ locale }: AIChatWidgetProps) {
  const copy = getDictionary(locale).ai;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    textareaRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [error, isOpen, isSubmitting, messages]);

  async function sendMessage(rawContent: string) {
    const content = rawContent.trim();

    if (!content) {
      setError(copy.errors.empty);
      return;
    }

    if (content.length > MAX_INPUT_LENGTH) {
      setError(copy.errors.tooLong);
      return;
    }

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          pathname,
          search: searchParams.toString(),
          messages: nextMessages.map((message) => ({
            role: message.role === "system" ? "assistant" : message.role,
            content: message.content,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as AIChatResponseBody | null;

      if (!response.ok || payload?.error) {
        throw new Error(normalizeErrorMessage(payload?.error, copy.errors.requestFailed));
      }

      const reply = payload?.reply?.trim();
      if (!reply) {
        throw new Error(copy.errors.requestFailed);
      }

      setMessages((current) => [
        ...current,
        createMessage("assistant", reply, payload?.references ?? []),
      ]);
    } catch (requestError) {
      setError(normalizeErrorMessage(requestError instanceof Error ? requestError.message : "", copy.errors.requestFailed));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    void sendMessage(draft);
  }

  return (
    <div className="ai-chat-widget">
      {isOpen ? (
        <button
          type="button"
          className="ai-chat-backdrop"
          aria-label={copy.close}
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {isOpen ? (
        <section className="ai-chat-panel" aria-label={copy.title}>
          <header className="ai-chat-panel__header">
            <div>
              <strong>{copy.title}</strong>
              <p>{copy.subtitle}</p>
            </div>
            <button type="button" className="ai-chat-panel__close" onClick={() => setIsOpen(false)} aria-label={copy.close}>
              ×
            </button>
          </header>

          <div className="ai-chat-panel__body">
            {messages.length === 0 ? (
              <div className="ai-chat-empty">
                <h3>{copy.emptyStateTitle}</h3>
                <p>{copy.emptyStateBody}</p>
                <div className="ai-chat-suggestion-block">
                  <span>{copy.suggestionTitle}</span>
                  <div className="ai-chat-suggestions">
                    {copy.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="ai-chat-suggestion"
                        onClick={() => {
                          void sendMessage(suggestion);
                        }}
                        disabled={isSubmitting}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="ai-chat-messages">
                {messages.map((message) => (
                  <article key={message.id} className={`ai-chat-message ai-chat-message--${message.role}`}>
                    <div className="ai-chat-message__bubble">
                      <p>{message.content}</p>
                    </div>
                    {message.references?.length ? (
                      <div className="ai-chat-message__references">
                        <span>{copy.references}</span>
                        <div className="ai-chat-reference-list">
                          {message.references.map((reference) =>
                            reference.href ? (
                              <Link key={`${message.id}-${reference.type}-${reference.label}`} href={reference.href} className="ai-chat-reference">
                                {reference.label}
                              </Link>
                            ) : (
                              <span key={`${message.id}-${reference.type}-${reference.label}`} className="ai-chat-reference ai-chat-reference--static">
                                {reference.label}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}

                {isSubmitting ? (
                  <div className="ai-chat-loading">
                    <span className="ai-chat-loading__dot" aria-hidden="true" />
                    <p>{copy.loading}</p>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}

            {error ? (
              <div className="ai-chat-error" role="alert">
                <strong>{copy.errorTitle}</strong>
                <p>{error}</p>
              </div>
            ) : null}
          </div>

          <form className="ai-chat-composer" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={draft}
              rows={3}
              maxLength={MAX_INPUT_LENGTH}
              placeholder={copy.inputPlaceholder}
              className="ai-chat-composer__textarea"
              onChange={(event) => setDraft(event.target.value)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !isComposingRef.current) {
                  event.preventDefault();
                  if (!isSubmitting) {
                    void sendMessage(draft);
                  }
                }
              }}
            />
            <div className="ai-chat-composer__footer">
              <span>{`${draft.trim().length}/${MAX_INPUT_LENGTH}`}</span>
              <button type="submit" className="ai-chat-send" disabled={isSubmitting}>
                {isSubmitting ? copy.sending : copy.send}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={isSubmitting ? "ai-chat-button is-busy" : "ai-chat-button"}
        aria-label={copy.open}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="ai-chat-button__label">{copy.button}</span>
        {isSubmitting ? <span className="ai-chat-button__dot" aria-hidden="true" /> : null}
      </button>
    </div>
  );
}
