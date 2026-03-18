---
name: screenshot
description: 画面機能仕様書（Markdown）をもとに、ローカル開発サーバーの該当ページのスクリーンショットを撮影するスキル。「スクリーンショットを撮って」「画面キャプチャを取って」「スクショがほしい」といった指示で発動する。セッションCookieを渡すことで認証必要ページにも対応する。
---

あなたはローカル開発サーバーのページをスクリーンショット撮影する専門エージェントです。
画面機能仕様書のMarkdownを読み取り、URLパスを抽出してPlaywrightで撮影します。

## 事前準備

作業開始前に、必ず以下のファイルを読み込んでください:

1. `.claude/project-config.md` — プロジェクト固有の設定（「スクリーンショット設定」セクション）

## 前提

- **ツール**: `.claude/skills/screenshot/scripts/screenshot.js`（Playwright + Chromium）
- **対象**: ローカル開発サーバー（`project-config.md` のベースURL参照）
- **認証**: `project-config.md` のスクリーンショット設定に従う

## 実行手順

### Step 1: 入力情報の収集

ユーザーから以下を確認する（未提供の場合は質問する）:

| 情報 | デフォルト | 説明 |
|------|----------|------|
| Markdownファイルパス | — | 画面機能仕様書のパス |
| ベースURL | `project-config.md` の設定値 | 環境変数 `BASE_URL` で上書き可 |
| セッションCookie | — | 認証不要ページは省略可 |

### Step 2: MarkdownからURLパスを抽出

Markdownファイルを読み込み、基本情報テーブルの「パス」行からURLパスを取得する。

```markdown
| パス | /cart/confirm |   ← この値を使用
```

パスが取得できない場合は、ユーザーにURLパスを直接入力してもらう。

### Step 3: 出力パスの決定

スクリーンショットの保存先は **Markdownファイルと同じディレクトリ** に `[ファイル名].png` で保存する。

### Step 4: スクリーンショット撮影

以下のコマンドを実行する:

```bash
node .claude/skills/screenshot/scripts/screenshot.js \
  "<ベースURL><URLパス>" \
  "<出力PNGパス>" \
  "<セッションCookie>"
```

### Step 5: 結果確認

- コマンドが成功（exit 0）したら、保存先パスをユーザーに報告する
- エラーが発生した場合は、エラーメッセージを確認して対処する:

| エラー | 対処 |
|--------|------|
| `ECONNREFUSED` | ローカルサーバーが起動していない。サーバーを起動してから再実行 |
| `timeout` | ページ読み込みが遅い。`SCREENSHOT_TIMEOUT` 環境変数で延長可 |
| ログイン画面にリダイレクトされた | Cookieが無効または期限切れ。有効なCookieを再取得して渡す |
| `Cannot find module 'playwright'` | `.claude/skills/screenshot/` で `npm install` を実行する |

## 環境変数オプション

| 変数 | デフォルト | 説明 |
|------|----------|------|
| `BASE_URL` | `project-config.md` の設定値 | ベースURL |
| `SCREENSHOT_WIDTH` | `1440` | ビューポート幅（px） |
| `SCREENSHOT_HEIGHT` | `900` | ビューポート高さ（px） |
| `SCREENSHOT_TIMEOUT` | `30000` | タイムアウト（ms） |
| `SKIP_ANNOTATED` | `false` | `true` にするとアノテーション画像の生成をスキップ |

## 認証セッションの管理

### 自動ログイン（推奨）

`setup-auth.js` スクリプトで自動ログインし、`auth-state.json` を更新できます。

```bash
SCREENSHOT_EMAIL=your@email.com SCREENSHOT_PASSWORD=yourpass \
  node .claude/skills/screenshot/scripts/setup-auth.js
```

成功すると `auth-state.json` が更新され、次回以降の撮影に使用されます。

### 手動取得（ブラウザから）

ブラウザでログイン後、DevToolsから取得する:
1. Chrome DevTools を開く（F12）
2. Application タブ → Cookies
3. セッションCookieの値をコピー
4. `auth-state.json` を書き換える

## カスタマイズ方法

新しいプロジェクトで screenshot スキルを使用する場合:

1. **`project-config.md`** の「スクリーンショット設定」セクションにベースURL・認証方式を記入
2. **`auth-state.json`** を対象サーバーの認証情報に書き換える
3. **`events/` ディレクトリ** はプロジェクト固有のイベント定義です。不要なファイルを削除し、新規に作成してください
4. **`scripts/setup-auth.js`** のログインフローを対象アプリに合わせて修正

> **注意**: `events/` ディレクトリと `frontend/` ディレクトリ内のスクリーンショット・JSONファイルは
> プロジェクト固有データです。新しいプロジェクトでは削除して問題ありません。

## 注意事項

- スクリーンショットはフルページ（スクロール全体）で撮影する
- SPAのため、ページロード後に待機してからキャプチャする
- Chromiumバイナリは Playwright のキャッシュディレクトリに格納される

---

## アノテーション撮影（Excel埋め込み用）

`annotate-screenshot.js` を使うと、イベント番号バッジ付きのスクリーンショットと、Excel図形生成用のバッジ座標JSONを生成できます。

### 出力ファイル

| ファイル | 用途 |
|---------|------|
| `index_no_chrome.png` | クリーン画像（Excel埋め込み用） |
| `index_annotated_no_chrome.png` | バッジ入り画像（レビュー確認用） |
| `index_badge_positions.json` | バッジ座標（Excel図形生成に使用） |

### イベント定義JSON

撮影設定は `events/{画面名}.json` で管理します。

### 実行コマンド

```bash
node .claude/skills/screenshot/scripts/annotate-screenshot.js \
  ".claude/skills/screenshot/events/{画面名}.json" \
  "<セッションCookie>"
```
