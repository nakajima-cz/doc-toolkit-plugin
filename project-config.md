# プロジェクト設定

<!-- CONFIG_STATUS: UNCONFIGURED -->
<!-- ↑ この行は project-setup skill が設定完了時に CONFIGURED に書き換えます。 -->
<!-- agents/skills はこのマーカーを確認し、UNCONFIGURED のままなら警告を表示します。 -->

> **このファイルについて**: 各skill/agentが参照するプロジェクト固有の設定です。
> 新しいプロジェクトに適用する際は、`project-setup` スキルを実行するか、手動で書き換えてください。
> skill/agent本体の修正は不要です。

---

## 1. プロジェクト概要

| 項目 | 値 |
|------|-----|
| プロジェクト名 | {プロジェクト名} |
| ソースリポジトリ | {リポジトリ名 or パス} |
| ドキュメントリポジトリ | {ドキュメントリポジトリ名 or パス（ソースと同一の場合は「同上」）} |
| リポジトリ間の位置関係 | {例: 兄弟ディレクトリ / 同一リポジトリ / サブモジュール} |

---

## 2. 技術スタック

### バックエンド

| 項目 | 値 |
|------|-----|
| 言語 | {例: Ruby / Python / Go / TypeScript} |
| フレームワーク | {例: AWS Lambda (SAM) / Rails / FastAPI / Express} |
| IaC / デプロイ定義 | {例: template.yaml (SAM) / serverless.yml / Dockerfile} |
| ルーティング定義ファイル | {例: backend/template.yaml, tickethub/src/} |
| ハンドラのシグネチャ | {例: `def handler(event:, context:)` / `def lambda_handler(event, context)`} |
| 共通ライブラリのパス | {例: backend/layer/, backend/lib/} |
| 外部連携 | {例: Sinatra (tickethub/src/), 外部API等} |

### フロントエンド

| 項目 | 値 |
|------|-----|
| フレームワーク | {例: Next.js (Pages Router) / Next.js (App Router) / Nuxt.js / React SPA} |
| 言語 | {例: TypeScript / JavaScript} |
| アプリ一覧 | {例: frontend/ (ユーザー向け), frontend-admin/ (管理者向け)} |

各アプリの共通ディレクトリ構造:

```
{app_dir}/
├── {pages_dir}/       # ルーティング定義（例: pages/, app/, src/routes/）
├── components/        # UIコンポーネント
├── {api_client_dir}/  # APIクライアント（例: api/, services/）
├── {state_dir}/       # 状態管理（例: store/, state/）
├── types/             # 型定義
├── {schema_dir}/      # バリデーションスキーマ（例: schemas/, validation/）
└── utils/             # ユーティリティ
```

### 遷移パターン（フロントエンド）

画面遷移の検出に使用するパターン:

| パターン種別 | 検索対象 |
|-------------|---------|
| プログラム遷移 | {例: `router.push`, `router.replace`, `navigate()`} |
| リンクコンポーネント | {例: `<Link href=`, `<NuxtLink to=`} |
| サーバーサイドリダイレクト | {例: `getServerSideProps` 内の redirect, middleware} |
| クライアントリダイレクト | {例: `useEffect` 内の遷移処理} |

---

## 3. 認証・認可

| 項目 | 値 |
|------|-----|
| 認証方式 | {例: JWT (Cognito), Session, OAuth} |
| 認証ガード（フロントエンド） | {例: AuthGuard コンポーネント} |
| 認証検証関数（バックエンド） | {例: user_jwt_verify, admin_jwt_verify, partner_jwt_verify} |
| ロール一覧 | {例: user, admin, partner} |

---

## 4. データベース

| 項目 | 値 |
|------|-----|
| RDBMS | {例: PostgreSQL / MySQL / SQLite} |
| ORM | {例: ActiveRecord / Prisma / SQLAlchemy / TypeORM} |
| スキーマ定義ファイル | {例: db_scheme.sql, prisma/schema.prisma} |
| マイグレーションディレクトリ | {例: backend/db/migrate/, prisma/migrations/} |
| モデルファイルの場所 | {例: backend/layer/db_model/ruby/lib/expo25/} |
| モデルの名前空間 | {例: Expo25::, App\\Models\\} |

---

## 5. ディレクトリマップ

```
{project_root}/
├── {backend_dir}/             # バックエンドソース
│   ├── {functions_dir}/       # API/バッチ関数群
│   ├── {iac_file}             # IaC定義
│   ├── {layer_dir}/           # 共通レイヤー
│   └── {lib_dir}/             # 共通ライブラリ
├── {frontend_app_1}/          # フロントエンド (アプリ1)
├── {frontend_app_2}/          # フロントエンド (アプリ2)
├── {db_schema_file}           # DBスキーマ定義
└── {external_service_dir}/    # 外部連携サービス
```

---

## 6. ドキュメント出力設定

### 出力先ルール

| ドキュメント種別 | 出力先パス | ファイル命名規則 |
|----------------|-----------|----------------|
| バックエンド API 詳細設計書 | {例: backend/api/{category}/} | {例: {function_name}.md} |
| バックエンド モデル設計書 | {例: backend/docs/models/} | {例: {ModelName}.md} |
| フロントエンド 画面機能仕様書 | {例: {app}/specs/{page_path}.md} | — |
| ER図 | {例: backend/er/} | {例: er-diagram.md, er-{domain}.md} |
| 画面遷移図 | {例: {app}/screen-transition.mermaid} | — |
| 調査レポート | {例: investigations/} | {例: investigation-{keyword}.md} |
| 共通関数ドキュメント | {例: {app}/specs/_shared/common_functions.md} | — |

### 画面ID体系

| 項目 | 値 |
|------|-----|
| IDプレフィックス | {例: SW-GP-DL- / SCR- / 未使用} |
| 採番方式 | {例: 手動採番 / 自動連番 / 「要採番」と記載} |

---

## 7. doc-sync 設定（ドキュメント同期を使用する場合）

### ソース → ドキュメント パスマッピング

> `doc-sync` スキルが使用する対応表です。
> `check-stale-docs.sh` もこの定義を参照します。

#### バックエンド

| ソースディレクトリ | ドキュメントディレクトリ | 備考 |
|------------------|----------------------|------|
| {例: backend/function/cart/} | {例: backend/api/cart/} | {備考} |

#### フロントエンド

| アプリ | ソース pages/ 配下 | ドキュメント先 | 除外パターン |
|--------|------------------|--------------|-------------|
| {例: frontend} | {screen_name}/ | {app}/screens/{screen_name}/ | {例: _app.tsx, _document.tsx, エラーページ} |

#### ER図

| ソース | ドキュメント先 |
|--------|--------------|
| {例: db_scheme.sql} | {例: backend/er/er-*.md} |

### 対象外（ドキュメント更新不要な変更）

- {例: *.scss — スタイルのみ}
- {例: *.test.ts — テストのみ}
- {例: package.json, yarn.lock — 依存関係のみ}

---

## 8. スクリーンショット設定（screenshot スキルを使用する場合）

| 項目 | 値 |
|------|-----|
| ベースURL | {例: http://localhost:3000} |
| 認証方式 | {例: セッションCookie / Bearer Token / 不要} |
| イベント定義ディレクトリ | {例: .claude/skills/screenshot/events/} |
| 出力先 | {例: {app}/specs/{page}/screenshots/} |
