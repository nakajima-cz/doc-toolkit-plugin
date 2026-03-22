---
name: project-setup
description: プロジェクトのオンボーディングを行い、コードベースを自動探索して `.claude/project-config.md` を生成するスキル。「プロジェクトをセットアップして」「project-setup」「オンボーディングして」「project-config を作って」「初期設定して」といった指示で発動する。新しいプロジェクトに .claude/ のskill/agentセットを導入した際に最初に実行する。
tools: Read, Glob, Grep, Write, Edit, Bash
---

# プロジェクトセットアップスキル

コードベースを自動探索し、`.claude/project-config.md` をプロジェクトに合わせて生成する。
全skill/agentが正しく動作するための前提条件を整える、最初に実行すべきスキルです。

## いつ使うか

- `.claude/` ディレクトリを新しいプロジェクトにコピーした直後
- `project-config.md` が `CONFIG_STATUS: UNCONFIGURED` の状態のとき
- 他のagent/skillから「project-setup を先に実行してください」と案内されたとき

## 探索ワークフロー

### Step 1: プロジェクトルートの確認

プロジェクトルートを特定する:

```bash
# git リポジトリのルートを取得
git rev-parse --show-toplevel
```

git 管理下でない場合は、カレントディレクトリをプロジェクトルートとする。

### Step 2: ディレクトリ構造の探索

プロジェクト全体の構造を把握する:

1. **トップレベルのディレクトリ・ファイル一覧を取得**
   ```bash
   ls -la
   ```

2. **主要な設定ファイルを探索**（存在するものだけ読み取る）

   | 探索対象 | 判定できる情報 |
   |---------|--------------|
   | `package.json` | フロントエンドフレームワーク（Next.js / Nuxt / React / Vue 等）、言語 |
   | `tsconfig.json` | TypeScript使用の有無 |
   | `Gemfile` | Ruby系（Rails / Sinatra 等） |
   | `requirements.txt` / `pyproject.toml` | Python系（FastAPI / Django 等） |
   | `go.mod` | Go |
   | `Cargo.toml` | Rust |
   | `template.yaml` / `serverless.yml` / `sam.json` | IaC / サーバーレス構成 |
   | `docker-compose.yml` / `Dockerfile` | コンテナ構成 |
   | `prisma/schema.prisma` | Prisma ORM |
   | `db/schema.rb` / `db/migrate/` | Rails ActiveRecord |
   | `*.sql` (ルート付近) | SQLスキーマ定義 |
   | `.env` / `.env.example` | 環境変数（ベースURL等のヒント） |

3. **ディレクトリ構造を2階層まで走査**
   ```bash
   find . -maxdepth 2 -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/vendor/*' -not -path '*/__pycache__/*' | sort
   ```

### Step 3: バックエンドの解析

バックエンドのディレクトリが特定できたら、以下を調査する:

1. **言語・フレームワークの特定**
   - Gemfile / package.json / requirements.txt 等から判定

2. **ルーティング定義ファイルの特定**
   - SAM: `template.yaml` 内の `Events:` セクション
   - Rails: `config/routes.rb`
   - Express: `routes/` ディレクトリ or `app.js`
   - FastAPI: `main.py` or `app/` 内の `@app.get` 等

3. **ハンドラのシグネチャを確認**
   - 代表的なハンドラファイルを1つ Read して確認

4. **共通ライブラリのパスを特定**
   - `layer/`, `lib/`, `shared/`, `common/`, `utils/` 等

5. **外部連携サービスの有無**

### Step 4: フロントエンドの解析

フロントエンドのディレクトリが特定できたら:

1. **フレームワークの特定**
   - `package.json` の `dependencies` から判定
   - Next.js: `next` パッケージ → Pages Router (`pages/`) or App Router (`app/`)
   - Nuxt: `nuxt` パッケージ
   - React SPA: `react-router` 等

2. **アプリ一覧の特定**
   - 複数のフロントエンドアプリがあるか（モノレポ構成）
   - 各アプリの役割（ユーザー向け / 管理画面 / パートナー向け 等）

3. **遷移パターンの特定**
   - Next.js Pages Router: `router.push`, `<Link href=`
   - Next.js App Router: `useRouter().push`, `<Link href=`
   - Nuxt: `navigateTo`, `<NuxtLink to=`
   - React Router: `useNavigate()`, `<Link to=`

4. **ディレクトリ構造の確認**
   - pages/ or app/ (ルーティング)
   - components/
   - api/ or services/ (APIクライアント)
   - store/ or state/ (状態管理)
   - schemas/ or validation/
   - types/

### Step 5: データベースの解析

1. **RDBMS / ORMの特定**
   - スキーマ定義ファイルの場所
   - マイグレーションディレクトリ
   - モデルファイルの場所と名前空間

2. **スキーマファイルの探索**
   ```
   Glob: **/*.sql, **/schema.prisma, **/schema.rb
   ```

### Step 6: 認証方式の解析

1. **バックエンド側**
   - JWT検証関数を Grep で検索（`jwt_verify`, `authenticate`, `auth_middleware` 等）
   - ロール一覧の推定

2. **フロントエンド側**
   - 認証ガードコンポーネントを Grep で検索（`AuthGuard`, `ProtectedRoute`, `middleware` 等）

### Step 7: ドキュメント出力先の推定

既存のドキュメントディレクトリを探索:

```
Glob: **/docs/**, **/specs/**, **/api-docs/**, **/investigations/**
```

既存のパターンがあればそれに従い、なければデフォルト構造を提案する。

### Step 8: ユーザーへの確認

探索結果をサマリーとして表示し、ユーザーに確認する:

```
## プロジェクト探索結果

### 検出された構成
- プロジェクト名: {検出 or 推定}
- バックエンド: {言語} + {フレームワーク}
- フロントエンド: {フレームワーク} ({ルーティング方式})
- DB: {RDBMS} + {ORM}
- 認証: {方式}

### 確認事項
- [ ] プロジェクト名は「{name}」で合っていますか？
- [ ] ドキュメント出力先は {path} でよいですか？
- [ ] 他に追加すべき情報はありますか？
```

ユーザーの確認・修正を反映した上で Step 9 に進む。

### Step 9: project-config.md の生成

`.claude/project-config.md` を探索結果に基づいて上書きする。

**重要**: 生成時に以下を行う:
1. `CONFIG_STATUS: UNCONFIGURED` を `CONFIG_STATUS: CONFIGURED` に変更する
2. 全セクションを実際のプロジェクト情報で埋める
3. 推定できなかった項目は `{要確認: 〇〇}` と記載し、ユーザーに後から埋めてもらう

### Step 10: doc-sync のカスタマイズ（該当する場合）

プロジェクトに doc-sync を使う場合:

1. `.claude/skills/doc-sync/references/path-mapping.md` をプロジェクトに合わせて更新
2. `.claude/skills/doc-sync/check-stale-docs.sh` の `SRC_DIR`、`BACKEND_MAP` をプロジェクトに合わせて更新

doc-sync が不要な場合はスキップする（ユーザーに確認）。

### Step 11: 完了報告

```
## プロジェクトセットアップ完了

✅ `.claude/project-config.md` を生成しました
  - CONFIG_STATUS: CONFIGURED

以下のskill/agentが使用可能になりました:

**ドキュメント生成**
- frontend-spec-doc: 画面機能仕様書の生成
- api-doc-generator: API設計書の生成
- backend-detail-doc: バックエンド詳細設計書の生成
- db-model-doc: DBモデルドキュメントの生成
- er-diagram-gen: ER図の生成
- screen-transition-gen: 画面遷移図の生成

**コード実装（設計書の自動更新付き）**
- backend-implement: バックエンドコードの新規作成・改修（code-first / doc-first 両対応）
- frontend-implement: フロントエンドコードの新規作成・改修（code-first / doc-first 両対応）
- feature-implement: フルスタック機能実装のオーケストレーター

**調査・メンテナンス**
- code-investigator: コードベースの横断調査
- doc-sync: ドキュメントの同期チェック・即時更新
- screenshot: スクリーンショット撮影

{要確認項目があれば一覧表示}
```

## 再実行時の動作

`project-config.md` が既に `CONFIGURED` の場合:

1. 既存の設定を Read して表示する
2. ユーザーに「再探索して上書きしますか？」と確認する
3. 承諾された場合のみ再探索を実行する

## 注意事項

- 探索は非破壊的に行う（ファイルの読み取りのみ。書き込みは `project-config.md` と doc-sync 関連のみ）
- 大規模モノレポの場合、探索範囲が広くなるため `maxdepth` を制限する
- 推定できない情報は無理に埋めず `{要確認}` とし、ユーザーの判断に委ねる
- `.env` ファイルの内容は読み取るが、シークレット値は `project-config.md` に記載しない
