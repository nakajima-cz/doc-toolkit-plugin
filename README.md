# doc-toolkit

ソースコードから各種設計書を自動生成する Claude Code プラグイン。

## 含まれるスキル / エージェント

### セットアップ

| 名前 | 種別 | 説明 |
|------|------|------|
| `project-setup` | skill/agent | プロジェクトのオンボーディング。コードベースを探索し `.claude/project-config.md` を自動生成 |

### ドキュメント生成

| 名前 | 種別 | 説明 |
|------|------|------|
| `frontend-spec-doc` | skill/agent | フロントエンド画面機能仕様書の生成（イベント駆動型） |
| `api-doc-generator` | skill/agent | バックエンドAPI設計書の生成 |
| `backend-detail-doc` | skill/agent | バックエンド詳細設計書の生成（関数/メソッド単位） |
| `db-model-doc` | skill/agent | DBモデルドキュメントの生成 |
| `er-diagram-gen` | skill/agent | ER図の生成（Mermaid形式） |
| `screen-transition-gen` | skill/agent | 画面遷移図の生成（Mermaid形式） |

### コード実装（設計書の自動更新付き）

| 名前 | 種別 | 説明 |
|------|------|------|
| `backend-implement` | skill/agent | バックエンドコードの新規作成・改修。code-first（要件→コード）/ doc-first（設計書→コード）の両対応。実装後に関連設計書を自動更新 |
| `frontend-implement` | skill/agent | フロントエンドコードの新規作成・改修。code-first / doc-first 両対応。実装後に関連設計書を自動更新 |
| `feature-implement` | agent | フルスタック機能実装のオーケストレーター。バックエンド・フロントエンドを並列管理し、設計書を一括更新 |

### 調査・メンテナンス

| 名前 | 種別 | 説明 |
|------|------|------|
| `code-investigator` | skill/agent | コードベースの横断調査・レポート生成 |
| `doc-sync` | skill | ソース変更に基づくドキュメント陳腐化検出・自動更新（即時同期モード対応） |
| `screenshot` | skill | ローカル開発サーバーのスクリーンショット撮影 |

## インストール

### 1. マーケットプレイスとして登録（推奨）

Claude Code のセッション内で:

```
/plugins
→ Add marketplace
→ URL: https://raw.githubusercontent.com/{your-username}/doc-toolkit-plugin/main/marketplace.json
```

その後:

```
/plugins
→ doc-toolkit をインストール
```

### 2. ローカルから直接使用

```bash
claude --plugin-dir /path/to/doc-toolkit-plugin
```

## 使い方

### 初回セットアップ

プラグインをインストールしたら、プロジェクトディレクトリで:

```
project-setup を実行して
```

コードベースが自動的に探索され、`.claude/project-config.md` が生成されます。

### 各種ドキュメント生成

```
API設計書を作って              → api-doc-generator が起動
画面機能仕様書を作って          → frontend-spec-doc が起動
詳細設計書を作って              → backend-detail-doc が起動
ER図を作って                   → er-diagram-gen が起動
画面遷移図を作って              → screen-transition-gen が起動
〇〇を調べて                   → code-investigator が起動
ドキュメントを同期して          → doc-sync が起動
```

### コード実装（設計書自動更新付き）

```
APIを追加して                          → backend-implement が起動（実装→設計書更新）
バックエンドを改修して                  → backend-implement が起動（実装→設計書更新）
この設計書を元にバックエンドを実装して   → backend-implement が起動（doc-first モード）
画面を実装して                         → frontend-implement が起動（実装→設計書更新）
〇〇機能を実装して                     → feature-implement が起動（フルスタック実装）
```

## project-config.md について

このプラグインの全skill/agentは `.claude/project-config.md` を参照して動作します。
`project-setup` スキルで自動生成されますが、手動で編集することもできます。

未設定のまま各skill/agentを実行すると警告が表示されます。

## カスタマイズ

### doc-sync

`skills/doc-sync/references/path-mapping.md` と `check-stale-docs.sh` はプロジェクト固有の設定です。`project-setup` 実行時に自動設定されますが、必要に応じて手動調整してください。

### screenshot

`skills/screenshot/events/` ディレクトリにプロジェクト固有のイベント定義JSONを配置してください。

## ライセンス

MIT
