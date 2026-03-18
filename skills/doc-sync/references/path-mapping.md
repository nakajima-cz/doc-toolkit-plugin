# ソースファイル → ドキュメント パスマッピング

> **このファイルはプロジェクト固有の設定です。**
> 新しいプロジェクトに適用する際は、以下の対応表を書き換えてください。
> `check-stale-docs.sh` 内の `BACKEND_MAP` も合わせて更新が必要です。

ソースファイルとドキュメントファイルの対応関係を定義する。

## プロジェクトパス

| 変数 | パス |
|---|---|
| SRC | `../pia-green-expo/` （ドキュメントプロジェクトの兄弟ディレクトリ） |
| DOC | `./` （ドキュメントプロジェクトルート） |

---

## 1. バックエンド API ドキュメント

**使用エージェント**: `backend-detail-doc`

| ソース (SRC/backend/function/) | ドキュメント (DOC/backend/api/) | 備考 |
|---|---|---|
| account/ | account/ | ユーザーアカウント |
| admin_group/ | admin_group/ | 管理者グループ |
| agent/ | agent/ | エージェント |
| bat/ | batch/ | バッチ処理 |
| cart/ | cart/ | カート |
| csv_down/ | csv/ | CSVダウンロード |
| faq/ | faq/ | FAQ |
| file/ | file/ | ファイル管理 |
| group/ | group/ | グループ |
| item/ | item/ | 商品 |
| item_group/ | item_group/ | 商品グループ |
| mail_template/ | mail_template/ | メールテンプレート |
| manual_sync/ | sync/ | 手動同期 |
| message/ | message/ | メッセージ |
| monitor/ | utility/ | モニター/ユーティリティ |
| news/ | news/ | ニュース |
| page/ | page/ | ページコンテンツ |
| partner_order/ | partner/ | パートナー注文 |
| send_mail/ | notification/ | メール送信 |
| sqs/ | sqs/ | SQSキュー処理 |
| sync_agent/ | sync/ | エージェント同期 |
| ticket/ | ticket/ | チケット |
| upload/ | upload/ | アップロード |
| user_order/ | order/ | ユーザー注文 |
| user_ticket_delivery/ | ticket_delivery/ | チケット配送 |
| user_ticket_delivery_expire/ | ticket_delivery/ | チケット配送期限 |
| expo_auth/ | authentication/ | 認証 |
| cognito_notify/ | notification/ | Cognito通知 |

**エージェントへの指示テンプレート**:
```
ドキュメント同期作業です。
SRC/backend/function/{func_dir}/ が更新されています（最終更新: {src_date}）。
DOC/backend/api/{doc_category}/ 配下の既存ドキュメントを、最新のソースコードに基づいて更新してください。
更新日: {src_date} 以降の変更が対象です。
```

---

## 2. フロントエンド 画面設計書

**使用エージェント**: `frontend-detail-doc`

### 2-1. ユーザー向け (frontend/)

| ソース (SRC/frontend/pages/) | ドキュメント (DOC/frontend/screens/) | 備考 |
|---|---|---|
| {screen_name}/ | {screen_name}/{screen_name}.md | 1:1 マッピング |

除外対象:
- `_app.tsx`, `_document.tsx` （Next.jsシステムファイル）
- `403/`, `404/`, `500/`, `502/`, `503/` （エラーページ）
- ファイル直下の `.tsx` （ルートファイル）

**エージェントへの指示テンプレート**:
```
ドキュメント同期作業です。
SRC/frontend/pages/{page_dir}/ が更新されています（最終更新: {src_date}）。
DOC/frontend/screens/{page_dir}/{page_dir}.md を、最新のソースコードに基づいて更新してください。
対象アプリ: frontend（ユーザー向け）
```

### 2-2. 管理画面 (frontend-admin/)

| ソース (SRC/frontend-admin/pages/) | ドキュメント (DOC/frontend-admin/screens/) | 備考 |
|---|---|---|
| {screen_name}/ | {screen_name}/{screen_name}.md | 1:1 マッピング |

**エージェントへの指示テンプレート**:
```
ドキュメント同期作業です。
SRC/frontend-admin/pages/{page_dir}/ が更新されています（最終更新: {src_date}）。
DOC/frontend-admin/screens/{page_dir}/{page_dir}.md を、最新のソースコードに基づいて更新してください。
対象アプリ: frontend-admin（管理画面）
```

### 2-3. 委託販売サイト (frontend-partners/)

| ソース (SRC/frontend-partners/pages/) | ドキュメント (DOC/frontend-partners/screens/) | 備考 |
|---|---|---|
| {screen_name}/ | {screen_name}/{screen_name}.md | 1:1 マッピング |

**エージェントへの指示テンプレート**:
```
ドキュメント同期作業です。
SRC/frontend-partners/pages/{page_dir}/ が更新されています（最終更新: {src_date}）。
DOC/frontend-partners/screens/{page_dir}/{page_dir}.md を、最新のソースコードに基づいて更新してください。
対象アプリ: frontend-partners（委託販売サイト）
```

---

## 3. ER図

**使用エージェント**: `er-diagram-gen`

| ソース | ドキュメント | 備考 |
|---|---|---|
| db_scheme.sql | backend/er/er-*.md | メインスキーマ |
| backend/db/migrate/ | backend/er/er-*.md | マイグレーション差分 |

**エージェントへの指示テンプレート**:
```
ドキュメント同期作業です。
db_scheme.sql が更新されています（最終更新: {src_date}）。
ER図を最新のスキーマに基づいて再生成してください。
```

---

## 4. 対象外（ドキュメント更新不要なファイル変更）

以下のファイル変更はドキュメント更新をトリガーしない：

- `*.scss`, `*.module.scss` — スタイル変更のみ
- `public/asset/lang/*.json` — 文言・多言語対応のみ
- `**/Gemfile`, `**/Gemfile.lock` — 依存関係のみ
- `**/package.json`, `**/yarn.lock` — 依存関係のみ
- `*.test.ts`, `*.spec.ts`, `**/tests/**` — テストのみ

※ check-stale-docs.sh はディレクトリ単位で日付比較するため、上記ファイルの変更も検出される。
  ただし、エージェントは実際の変更内容を確認し、ドキュメントに影響しない変更はスキップする。

---

## 5. 未対応（将来対応予定）

- `screen-transition-gen` — 大きな画面フロー変更時に手動で実行推奨
- `db-model-doc` — ActiveRecordモデルの変更時に手動で実行推奨
- `backend/layer/`, `backend/lib/` — 共通ライブラリの変更（影響範囲が広いため手動判断）
