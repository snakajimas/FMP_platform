import { useRef, useState, useEffect } from "react";
import { AlertTriangle, Loader2, SendHorizontal, Sparkles } from "lucide-react";
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
    <div className="chat-page">
      <div className="chat-thread">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <h2>FMPデータにAIで質問</h2>
            <p>自然言語で質問すると、AIが必要なFMPデータを取得し、根拠付きで要約します。</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" type="button" onClick={() => send(s)}>
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
          <div className="chat-status">
            <Loader2 size={14} className="spin" /> AIがFMPデータを取得・分析しています…
          </div>
        )}
        {error && (
          <div className="notice error">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="composer-row">
          <textarea
            className="composer-input"
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
          />
          <button type="submit" className="composer-send" disabled={loading || !input.trim()}>
            <SendHorizontal size={15} /> 送信
          </button>
        </div>
        <p className="composer-note">
          本ツールは過去・公開データに基づく情報提供であり、投資助言ではありません。
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
    <div className={`msg ${isUser ? "user" : "assistant"}`}>
      <div className="msg-bubble">
        {message.content}

        {!isUser && message.plan && message.plan.length > 0 && (
          <div className="msg-tools">
            {message.plan.map((c, i) => (
              <span key={i} className="tool-chip" title={JSON.stringify(c.args)}>
                <Sparkles size={10} /> {c.tool}({Object.values(c.args || {}).join(", ")})
              </span>
            ))}
            {errResults.map((r, i) => (
              <span key={`e${i}`} className="tool-chip err">
                {r.tool}: {r.error}
              </span>
            ))}
          </div>
        )}

        {!isUser && okResults.length > 0 && (
          <>
            <button className="raw-toggle" onClick={() => setShowData((s) => !s)}>
              {showData ? "生データを隠す" : "取得した生データを表示"}
            </button>
            {showData && <pre className="raw-box">{JSON.stringify(okResults, null, 2)}</pre>}
          </>
        )}
      </div>
    </div>
  );
}
