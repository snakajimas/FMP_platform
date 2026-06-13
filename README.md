# FMP Analytics

Financial Modeling Prep (FMP) のデータを専門に扱う分析プラットフォーム。
**Cloudflare Workers (Static Assets)** 上で動作し、API キー（FMP / Perplexity）は
サーバー側の環境変数（secrets）に保持します（ブラウザにキーは出ません）。

## 機能

| 画面 | 内容 |
|---|---|
| 💬 AIチャット | 自然言語で質問 → AI(Perplexity)が必要な FMP エンドポイントを計画 → Worker が FMP からデータ取得 → AI が根拠付きで日本語要約 |
| 🔎 スクリーナー | `company-screener` を使った条件絞り込み（時価総額・株価・出来高・配当・セクター・ベータ等）。ソート可。各行からチャートへ遷移 |
| 📈 チャート | `historical-price-eod/full` のローソク足 + 出来高（Lightweight Charts）+ クォート/プロフィール表示 |

## アーキテクチャ

1つの Cloudflare Worker が API と SPA 配信を兼ねます。

```
ブラウザ (React SPA, dist/)
   │
   ▼
Cloudflare Worker (worker/index.ts)
   ├─ /api/*  ─►  Perplexity API (/chat/completions)
   │  (キー保持) ─►  FMP stable API (/quote, /company-screener, ...)
   └─ それ以外 ─►  ASSETS バインディングで dist/ を配信
                  (SPA fallback = not_found_handling)
```

AI フロー（`/api/chat`）は 3 ステップ:
1. **計画**: Perplexity が質問を解析し、呼ぶ FMP ツールを JSON で返す
2. **取得**: Worker が FMP ツール（最大5件）を実行
3. **要約**: 取得データを根拠に Perplexity が日本語で回答（投資助言はしない / 免責付き）

FMP ツール定義は [`worker/lib/fmp.ts`](worker/lib/fmp.ts) の `FMP_TOOLS`。
ここにエンドポイントを追加すればチャットAIが自動で使えるようになります。
API ルーティングは [`worker/index.ts`](worker/index.ts)。

## セットアップ

```bash
npm install
```

### キー設定（ローカル開発）

`.dev.vars.example` を `.dev.vars` にコピーしてキーを記入:

```
FMP_API_KEY=...
PERPLEXITY_API_KEY=...
PERPLEXITY_MODEL=sonar   # 任意
```

### ローカル実行

API + キー + SPA をまとめて動かすには `wrangler dev` を使います:

```bash
npm run build          # dist/ を生成（Worker が配信する静的アセット）
npm run worker:dev     # http://127.0.0.1:8787 で Worker (API + SPA)
```

フロントだけ HMR 開発したい場合は別ターミナルで:

```bash
npm run worker:dev     # 先に Worker を 8787 で起動
npm run dev            # http://localhost:5173（/api を 8787 にプロキシ）
```

## デプロイ（Cloudflare Workers）

```bash
npm run deploy         # build + wrangler deploy
```

本番のキーは secret として設定:

```bash
wrangler secret put FMP_API_KEY
wrangler secret put PERPLEXITY_API_KEY
```

（Cloudflare ダッシュボードの Workers プロジェクト → Settings → Variables and Secrets からでも設定可。
GitHub 連携でビルドする場合はビルドコマンド `npm run build`・デプロイコマンド `npx wrangler deploy` を指定）

## FMP 無料プランの注意

- 1 日あたり ~250 リクエスト、米国株中心、EOD（日足）履歴が中心。
- 一部エンドポイント（イントラデイ、アナリスト、保有比率など）は有料プラン限定。
- 本ツールは情報提供のみを目的とし、投資助言ではありません。Yahoo/FMP の利用規約は変わりうるため、正式公開前に利用条件を確認してください。
