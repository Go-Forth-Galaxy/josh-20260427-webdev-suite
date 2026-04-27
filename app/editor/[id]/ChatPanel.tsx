"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import type { Project } from "@/lib/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  changed?: string[]; // which files the assistant changed, if any
  error?: string | null;
  pending?: boolean;
};

type Props = {
  projectId: string;
  onProjectUpdated: (next: Project) => void;
};

const SUGGESTIONS = [
  "Make the hero headline larger and bolder",
  "Change the primary color to a teal/emerald palette",
  "Add a pricing section with 3 tiers",
  "Make the cards have a subtle gradient border on hover",
];

export default function ChatPanel({ projectId, onProjectUpdated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    const userId = `u-${Date.now()}`;
    const pendingId = `a-${Date.now()}`;
    const history = messages
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: msg },
      { id: pendingId, role: "assistant", content: "Thinking…", pending: true },
    ]);
    setInput("");
    setSending(true);

    try {
      const resp = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: msg,
          history,
        }),
      });
      const j = await resp.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
                content: j.reply || (j.error ? `Error: ${j.error}` : "No response."),
                changed: j.changed ?? [],
                error: j.error ?? null,
              }
            : m,
        ),
      );
      if (j.project) onProjectUpdated(j.project);
    } catch (e) {
      const msgText = e instanceof Error ? e.message : String(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
                content: `Network error: ${msgText}`,
                error: "network",
              }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center gap-1.5 shrink-0">
        <Sparkles className="w-3 h-3 text-indigo-400" /> AI Assistant
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-sm text-slate-400 leading-relaxed">
              Describe a change in plain English and I'll edit your HTML, CSS, or JS.
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">
                Try one of these
              </div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="block w-full text-left text-xs bg-slate-950 border border-slate-800 hover:border-indigo-500 hover:bg-slate-900 rounded-md px-2.5 py-2 text-slate-300 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <div
              className={
                "w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] " +
                (m.role === "user"
                  ? "bg-indigo-600 text-white"
                  : m.error
                    ? "bg-rose-900 text-rose-200"
                    : "bg-slate-800 text-indigo-300")
              }
            >
              {m.role === "user" ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={
                  "text-sm whitespace-pre-wrap break-words " +
                  (m.error ? "text-rose-300" : "text-slate-200")
                }
              >
                {m.pending ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking…
                  </span>
                ) : (
                  m.content
                )}
              </div>
              {m.changed && m.changed.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.changed.map((f) => (
                    <span
                      key={f}
                      className="text-[10px] uppercase tracking-wider bg-emerald-900/40 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded"
                    >
                      {f} updated
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="border-t border-slate-800 p-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the AI to change something…"
            rows={2}
            disabled={sending}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 resize-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="text-[10px] text-slate-500 mt-1 px-0.5">
          Enter to send · Shift+Enter for newline
        </div>
      </form>
    </div>
  );
}
