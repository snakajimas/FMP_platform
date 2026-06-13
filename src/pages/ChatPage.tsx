import { useRef, useState, useEffect } from "react";
import { api, ChatMessage, ToolResult, PlannedCall } from "../lib/api";
import { getModel } from "../lib/models";

interface UiMessage extends ChatMessage {
  plan?: PlannedCall[];
  results?: ToolResult[];
}

const SUGGESTIONS = [
  "AAPLの直近の株価と時価総額を教えて",
  "NVIDIAの売上と純利益の推移を年次で要約して",
  "テクノロジーセクターで時価総額1000億ドル超の銘柄を探して",
  "MSFTとGOOGLのPERとROEを比較して",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const next: UiMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const history: ChatMessage[] = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chat(history, getModel());
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, plan: res.plan, results: res.results },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="mt-10 text-center">
            <h1 className="text-2xl font-semibold">FMPデータにAIで質問</h1>
            <p className="mt-2 text-sm text-gray-400">
              自然言語で質問すると、AIが必要なFMPデータを取得し、根拠付きで要約します。
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-border bg-panel p-3 text-left text-sm text-gray-300 hover:border-accent/50 hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            AIがFMPデータを取得・分析しています…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 border-t border-border bg-bg py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="銘柄や指標について質問する（例: TSLAの財務指標を要約して）"
            className="max-h-40 flex-1 resize-none rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black disabled:opacity-40"
          >
            送信
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500">
          本ツールは情報提供のみを目的とし、投資助言ではありません。
        </p>
      </form>
    </div>
  );
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const [showData, setShowData] = useState(false);
  const okResults = (message.results || []).filter((r) => r.ok);
  const errResults = (message.results || []).filter((r) => !r.ok);

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
          isUser ? "bg-accent/15 text-gray-100" : "border border-border bg-panel text-gray-200"
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>

        {!isUser && message.plan && message.plan.length > 0 && (
          <div className="mt-3 border-t border-border pt-2">
            <div className="flex flex-wrap gap-1.5">
              {message.plan.map((c, i) => (
                <span
                  key={i}
                  className="rounded bg-black/30 px-2 py-0.5 text-[11px] text-accent"
                  title={JSON.stringify(c.args)}
                >
                  {c.tool}({Object.values(c.args || {}).join(", ")})
                </span>
              ))}
            </div>
            {errResults.length > 0 && (
              <div className="mt-1 text-[11px] text-amber-400">
                取得失敗: {errResults.map((r) => `${r.tool} (${r.error})`).join(" / ")}
              </div>
            )}
            {okResults.length > 0 && (
              <button
                onClick={() => setShowData((s) => !s)}
                className="mt-1 text-[11px] text-gray-400 underline hover:text-gray-200"
              >
                {showData ? "生データを隠す" : "取得した生データを表示"}
              </button>
            )}
            {showData && (
              <pre className="mt-2 max-h-72 overflow-auto rounded bg-black/40 p-2 text-[11px] text-gray-400">
                {JSON.stringify(okResults, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
