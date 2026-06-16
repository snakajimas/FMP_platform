# scripts/

## fmp-jp-coverage.mjs — 日本株カバレッジ検証

FMP の「stable」API に対して、東証（TSE）主要銘柄で各エンドポイントを体系的に
叩き、**どこまで日本株データが取得できるか**をレポートします。契約プラン
（個人最上位 = Ultimate など）で実際に何が返ってくるかを実測する用途です。

### 実行

```bash
FMP_API_KEY=xxxx node scripts/fmp-jp-coverage.mjs
# 銘柄を指定する場合:
FMP_API_KEY=xxxx node scripts/fmp-jp-coverage.mjs 7203.T 6758.T
```

### 前提条件（重要）

1. **FMP_API_KEY** … 契約中のプランのキーを環境変数で渡す。
2. **ネットワーク egress 許可** … 実行環境から `financialmodelingprep.com` へ
   到達できること。Claude Code on the web の環境では、ホストが許可リストに
   ない場合 `🚧 EGRESS` と表示されます。環境設定の network egress 設定に
   `financialmodelingprep.com` を追加してください。
   参照: https://code.claude.com/docs/en/claude-code-on-the-web

### 出力の見方

| 表示 | 意味 |
|---|---|
| ✅ OK | データが返った（件数とサンプルを表示） |
| ⚪ EMPTY | エンドポイントは応答したが日本株では空 |
| 🔒 PLAN | プラン制限でロック（要上位プラン） |
| 🚧 EGRESS | 実行環境のネットワーク許可リスト未登録 |
| ❌ ERR/HTTP/JSON/NET | エラー（内容を併記） |

検証対象エンドポイント: discovery（検索・取引所/国一覧・銘柄リスト）、quote、
価格（EOD/イントラデイ）、profile、ファンダメンタルズ（PL/BS/CF・各種指標）、
コーポレートイベント（配当・分割・決算）、アナリスト/保有、スクリーナー
（exchange=TSE / country=JP）。
