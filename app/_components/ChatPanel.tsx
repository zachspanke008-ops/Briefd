"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply ?? "Sorry, I couldn't get a response." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Error reaching the server. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      )}

      {/* panel */}
      <div
        className={`fixed top-14 right-0 bottom-0 z-50 w-80 flex flex-col border-l border-zinc-800 bg-black transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
          <div>
            <p className="text-white text-sm font-medium">Finance Assistant</p>
            <p className="text-zinc-600 text-xs">Ask anything about your finances</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-zinc-600 text-xs">Try asking:</p>
              {[
                "What's my biggest expense?",
                "Am I on track with my budget?",
                "What's my burn rate trend?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-left text-xs text-zinc-500 border border-zinc-800 rounded-lg px-3 py-2 hover:border-zinc-700 hover:text-zinc-300 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-zinc-800 text-white rounded-br-sm"
                    : "bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl rounded-bl-sm px-3 py-3 flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* input */}
        <div className="border-t border-zinc-900 p-3 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about your finances…"
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-2 bg-white text-black rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
