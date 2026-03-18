# Mermaid ER図フォーマット

## 基本構文

Mermaid の erDiagram を使用する。

## 出力テンプレート

```mermaid
erDiagram
    %% ========== ユーザー系 ==========
    users {
        bigint id PK
        varchar email UK "メールアドレス"
        varchar name "氏名"
        varchar cognito_sub "Cognito SUB"
        integer status "0:仮登録 1:本登録 2:退会"
        timestamp created_at
        timestamp updated_at
    }

    accounts {
        bigint id PK
        bigint user_id FK "users.id"
        varchar provider "認証プロバイダ"
        timestamp created_at
    }

    %% ========== チケット系 ==========
    orders {
        bigint id PK
        bigint user_id FK "users.id"
        integer total_amount "合計金額"
        integer status "0:未決済 1:決済済 2:キャンセル"
        timestamp ordered_at
        timestamp created_at
    }

    tickets {
        bigint id PK
        bigint order_id FK "orders.id"
        bigint item_id FK "items.id"
        varchar ticket_code UK "チケットコード"
        integer status "0:未使用 1:使用済 2:無効"
        timestamp created_at
    }

    %% ========== 商品系 ==========
    items {
        bigint id PK
        bigint item_group_id FK "item_groups.id"
        varchar name "商品名"
        integer price "価格"
        integer stock "在庫数"
        integer status "0:非公開 1:公開 2:販売終了"
        timestamp created_at
    }

    item_groups {
        bigint id PK
        bigint group_id FK "groups.id"
        varchar name "グループ名"
        timestamp created_at
    }

    %% ========== リレーション ==========
    users ||--o{ accounts : "has"
    users ||--o{ orders : "places"
    orders ||--o{ tickets : "contains"
    items ||--o{ tickets : "issued as"
    item_groups ||--o{ items : "has"
    groups ||--o{ item_groups : "manages"

    %% 推定リレーション（FOREIGN KEY未定義）
    %% users ..o{ tickets : "owns (推定)"
```

## カーディナリティ表記

| 記法 | 意味 |
|------|------|
| `\|\|--\|\|` | 1対1 |
| `\|\|--o{` | 1対多 |
| `o{--o{` | 多対多（中間テーブル経由） |
| `\|\|--o\|` | 1対0..1 |

## カラム表記ルール

各カラムの記法:
```
データ型 カラム名 [制約] ["コメント"]
```

制約:
- `PK` — PRIMARY KEY
- `FK` — FOREIGN KEY（コメントに参照先を記載）
- `UK` — UNIQUE KEY

コメント:
- ENUM値やステータスの意味を記載: `"0:未使用 1:使用済 2:無効"`
- 参照先テーブル: `"users.id"`
- ビジネス上の説明（簡潔に）

## 共通カラムの扱い

`created_at`, `updated_at`, `deleted_at` は以下の基準で制御する:

- デフォルト: 含める（実際のスキーマに忠実）
- ユーザーが「簡潔にして」と指示した場合: 省略し、図の末尾に注記を追加:
  ```
  %% 注: 全テーブルに created_at, updated_at カラムが存在（図では省略）
  ```

## 分割出力時の構成

テーブル数が多い場合:

1. **全体概要図** (`er-overview.md`): テーブル名とリレーションのみ（カラム省略）
2. **ドメイン別詳細図** (`er-{domain}.md`): カラム含む完全な定義

全体概要図の例（Markdownファイルとして出力）:

ファイル先頭に `# ER図 {タイトル}` を付け、Mermaid図を ` ```mermaid ` コードブロックで包む。

## 出力ファイル

ファイルは `{backend_dir}/{er_dir}/` ディレクトリに `.md` 形式で配置する。
Mermaid図は必ずMarkdownの ` ```mermaid ` コードブロック内に記述する。

- 単一図: `{backend_dir}/{er_dir}/er-diagram.md`
- 分割時:
  - `{backend_dir}/{er_dir}/er-overview.md`（全体概要）
  - `{backend_dir}/{er_dir}/er-{domain}.md`（ドメイン別）

### ファイル構成テンプレート

```
# ER図 {タイトル}

```mermaid
erDiagram
    ...
```
```
