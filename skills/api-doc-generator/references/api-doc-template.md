# API設計書テンプレート

## ドキュメント全体構造

```markdown
# API設計書 - [プロジェクト名]

更新日: YYYY-MM-DD
対象バージョン: [バージョンまたはコミットハッシュ]

## 概要

[システム全体のAPI概要を1-2段落で記述]

## 共通仕様

### ベースURL
- ユーザー向け: `https://api.example.com/v1`
- 管理者向け: `https://admin-api.example.com/v1`
- パートナー向け: `https://partner-api.example.com/v1`

### 認証方式
[JWT認証の共通仕様を記述]

### 共通ヘッダー
| ヘッダー名 | 必須 | 説明 |
|-----------|------|------|
| Authorization | ○ | Bearer {token} |
| Content-Type | ○ | application/json |

### 共通エラーレスポンス
| ステータスコード | 意味 | レスポンス例 |
|----------------|------|-------------|
| 400 | バリデーションエラー | `{"error": "invalid_parameter", "message": "..."}` |
| 401 | 認証エラー | `{"error": "unauthorized"}` |
| 403 | 認可エラー | `{"error": "forbidden"}` |
| 500 | サーバーエラー | `{"error": "internal_server_error"}` |

## エンドポイント一覧

| # | メソッド | パス | 機能名 | 認証 | Lambda関数 |
|---|---------|------|--------|------|-----------|
| 1 | GET | /users/{id} | ユーザー取得 | user | {functions_dir}/account |
| 2 | POST | /cart/items | カート追加 | user | {functions_dir}/cart |
| ... | | | | | |

## エンドポイント詳細

---

### [機能カテゴリ名] （例: カート機能）

#### POST /cart/items

**概要**: カートにアイテムを追加する

**認証**: user（JWT必須）

**Lambda関数**: `{functions_dir}/cart/add_item`

**リクエスト**:

パスパラメータ: なし

クエリパラメータ: なし

リクエストボディ:
| フィールド | 型 | 必須 | 説明 | 制約 |
|-----------|-----|------|------|------|
| item_id | string | ○ | 商品ID | UUID形式 |
| quantity | integer | ○ | 数量 | 1以上 |
| options | object | - | オプション | |

リクエスト例:
{
  "item_id": "550e8400-e29b-41d4-a716-446655440000",
  "quantity": 2,
  "options": {}
}

**レスポンス**:

成功時 (200):
| フィールド | 型 | 説明 |
|-----------|-----|------|
| cart_id | string | カートID |
| items | array | カート内アイテム一覧 |
| total_amount | integer | 合計金額 |

レスポンス例:
{
  "cart_id": "cart_xxx",
  "items": [...],
  "total_amount": 5000
}

エラー時:
| ステータス | 条件 | レスポンス |
|-----------|------|-----------|
| 400 | item_idが不正 | `{"error": "invalid_item_id"}` |
| 404 | 商品が存在しない | `{"error": "item_not_found"}` |
| 409 | 在庫不足 | `{"error": "out_of_stock"}` |

**関連処理**:
- DB: `carts` テーブルへINSERT/UPDATE
- DB: `items` テーブルから在庫確認
- SQS: なし

**備考**: [ソースから読み取れない仕様や要確認事項]

---
```

## セクション記述ルール

1. エンドポイント一覧は機能カテゴリでグルーピングする
2. 各エンドポイント詳細は上記テンプレートの全項目を埋める。不明な項目は「要確認」と記載
3. リクエスト/レスポンス例はソースコードから推定可能な範囲で記載し、推測部分は `/* 推定 */` とコメントする
4. 関連処理セクションでは、DB操作・SQS送信・外部API呼び出しを明記する
5. バリデーション制約はソースのバリデーション処理から可能な限り抽出する
