# Mermaid 画面遷移図フォーマット

## 基本構文

stateDiagram-v2 を使用する。flowchart ではなく stateDiagram を選択する理由は、画面（状態）間の遷移表現に適しているため。

## 出力テンプレート

```mermaid
stateDiagram-v2
    direction LR

    %% ページ定義（state名はページパスベース、表示名は日本語）
    state "トップページ\n/" as top
    state "イベント検索\n/events" as events
    state "イベント詳細\n/events/:id" as event_detail
    state "チケット選択\n/events/:id/tickets" as ticket_select
    state "カート\n/cart" as cart
    state "購入確認\n/cart/confirm" as cart_confirm
    state "購入完了\n/cart/complete" as cart_complete
    state "ログイン\n/login" as login
    state "マイページ\n/mypage" as mypage

    %% 遷移定義
    [*] --> top
    top --> events : イベントを探す
    top --> login : ログイン
    events --> event_detail : イベント選択
    event_detail --> ticket_select : チケットを選ぶ
    ticket_select --> cart : カートに追加
    cart --> cart_confirm : 購入手続きへ
    cart_confirm --> cart_complete : 決済完了
    login --> mypage : 認証成功
    login --> top : 認証失敗（リダイレクト）

    %% 認証ガード（条件付きリダイレクト）
    note right of mypage : 要認証\n未ログイン時はloginへリダイレクト
    note right of cart : 要認証
```

## 命名規則

### state名
- ページパスをスネークケースに変換: `/events/[id]/tickets` → `event_id_tickets`
- 短縮可（可読性優先）: `event_detail`, `ticket_select`

### 表示名
- 日本語のページ名 + パス（改行区切り）
- 例: `"チケット選択\n/events/:id/tickets"`

## 遷移ラベル

| 種別 | ラベル例 |
|------|---------|
| ユーザー操作 | `ボタンクリック`, `フォーム送信`, `リンク選択` |
| 条件分岐 | `認証成功`, `認証失敗`, `在庫あり` |
| リダイレクト | `未認証リダイレクト`, `完了後リダイレクト` |
| 自動遷移 | `3秒後自動遷移` |

ラベルは簡潔に。長くなる場合は注釈（note）で補足する。

## 機能カテゴリ別分割時の構造

ページ数が多い場合、複合状態（composite state）でグルーピングする:

```mermaid
stateDiagram-v2
    %% 全体概要図
    state "チケット購入フロー" as purchase {
        [*] --> event_search
        event_search --> event_detail
        event_detail --> ticket_select
        ticket_select --> cart
    }

    state "アカウント管理" as account {
        [*] --> login
        login --> mypage
        mypage --> profile_edit
    }

    state "管理者機能" as admin {
        [*] --> dashboard
        dashboard --> event_manage
    }

    %% カテゴリ間の遷移
    purchase --> account : ログイン要求
    account --> purchase : ログイン後に戻る
```

## 出力ファイル

- 単一図: `screen-transition.mermaid`
- 分割時:
  - `screen-transition-overview.mermaid`（全体概要）
  - `screen-transition-{category}.mermaid`（カテゴリ別）

ファイルは `{doc_output_dir}/` に配置する。
