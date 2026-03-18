# DBモデルドキュメント テンプレート

## 出力フォーマット

```markdown
---
tags:
  - db-model
  - backend
  - [model-name]  (モデル名をケバブケースで記載。例: user-cart, ticket)
source: {backend_dir}/{model_dir}/{file_name}.{ext}
updated: YYYY-MM-DD
---

# {ClassName}

**テーブル名**: `{table_name}`
**クラス**: `{Namespace}::{ClassName}`
**継承**: `{ParentClass}`
**ファイル**: `{backend_dir}/{model_dir}/{file_name}.{ext}`

## 概要

{モデルの役割・目的を1〜3文で説明}

---

## 定数・設定

### enum

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `{CONSTANT}` | `{値}` | {説明} |

```ruby
# {backend_dir}/{model_dir}/{file}.{ext}:{行番号}
enum {name}: { {key}: {value}, ... }
```

### 定数

| 定数名 | 値 | 説明 |
|--------|-----|------|
| `{CONSTANT_NAME}` | `{value}` | {説明} |

---

## アソシエーション

| 種別 | 関連名 | クラス | オプション |
|------|--------|--------|-----------|
| `belongs_to` | `:{name}` | `{Namespace}::{Model}` | `optional: true` 等 |
| `has_many` | `:{name}` | `{Namespace}::{Model}` | `dependent: :destroy` 等 |
| `has_one` | `:{name}` | `{Namespace}::{Model}` | - |

---

## バリデーション

| カラム | バリデーション | 条件 |
|--------|--------------|------|
| `{column}` | `presence: true` | - |
| `{column}` | `uniqueness: { scope: :xxx }` | `if: :condition?` |

---

## コールバック

| タイミング | メソッド | 説明 |
|-----------|---------|------|
| `before_create` | `{method_name}` | {説明} |
| `after_save` | `{method_name}` | {説明} |

---

## スコープ

### `{scope_name}({引数})`

`{backend_dir}/{model_dir}/{file}.{ext}:{行番号}`

```ruby
scope :{name}, -> ({args}) { {条件} }
```

**説明**: {スコープの目的・条件}

---

## クラスメソッド

### `self.{method_name}({引数})`

`{backend_dir}/{model_dir}/{file}.{ext}:{行番号}`

**概要**: {メソッドの目的}

**引数**:
| 引数名 | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| `{name}` | `{型}` | `{default}` | {説明} |

**戻り値**: {型と説明}

**処理**:
1. {ステップ1の説明} (`{file}.{ext}:{行番号}`)
2. {ステップ2の説明} (`{file}.{ext}:{行番号}`)

**副作用**: {DB更新・外部API・Redis等があれば記載、なければ「なし」}

---

## インスタンスメソッド

### `{method_name}({引数})`

`{backend_dir}/{model_dir}/{file}.{ext}:{行番号}`

**概要**: {メソッドの目的}

**引数**:
| 引数名 | 型 | デフォルト | 説明 |
|--------|-----|-----------|------|
| `{name}` | `{型}` | `{default}` | {説明} |

**戻り値**: {型と説明}

**処理**:
1. {ステップ1の説明} (`{file}.{ext}:{行番号}`)
2. {ステップ2の説明} (`{file}.{ext}:{行番号}`)

**副作用**: {DB更新・外部API・Redis等があれば記載、なければ「なし」}

---

## privateメソッド

### `{method_name}({引数})`

`{backend_dir}/{model_dir}/{file}.{ext}:{行番号}`

**概要**: {メソッドの目的}

（引数・戻り値・処理は上記と同じ形式で記載）

---

## 使用箇所（主なAPI）

| API | 使用メソッド | 目的 |
|-----|------------|------|
| `GET /api/d/...` | `{method}` | {目的} |
| `POST /api/d/...` | `{method}` | {目的} |
```

---

## 記載上の注意

- **省略禁止**: privateメソッドも含めすべてのメソッドを記載する
- **行番号必須**: すべてのメソッド・スコープ・コールバックにファイルパス・行番号を付与
- **継承メソッド**: ApplicationRecordや抽象クラスから継承したメソッドは、当該モデルでオーバーライドしているもののみ記載
- **空セクション**: 該当なし（enum定義がない等）の場合は「なし」と明記し、セクション自体は省略しない
- **副作用の明示**: DB更新、Redis操作、SQS送信、外部API呼び出しは必ず明記
