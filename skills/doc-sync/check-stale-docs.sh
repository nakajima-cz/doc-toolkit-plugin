#!/bin/bash
# check-stale-docs.sh
# ソースリポジトリとドキュメントリポジトリを比較し、
# 陳腐化・未生成のドキュメントを検出して出力する。
#
# ★ このスクリプトはプロジェクト固有の設定を含みます。
# ★ 新しいプロジェクトに適用する際は以下を修正してください:
#   - SRC_DIR: ソースリポジトリへのパス
#   - BACKEND_MAP: バックエンド関数ディレクトリ → ドキュメントディレクトリの対応表
#   - フロントエンドのページディレクトリパス
#   - ER図のスキーマファイルパス
#
# 出力フォーマット:
#   STALE <type> <src_path> -> <doc_path> (src: <ISO日時>, doc: <ISO日時>)
#   MISSING <type> <src_path> -> <doc_path>

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOC_DIR="$(cd "$SCRIPT_DIR/../../../" && pwd)"
SRC_DIR="$(cd "$DOC_DIR/../pia-green-expo" && pwd)"

if [ ! -d "$SRC_DIR" ]; then
  echo "ERROR: ソースプロジェクトが見つかりません: $SRC_DIR" >&2
  exit 1
fi

STALE_COUNT=0
MISSING_COUNT=0

# ========================
# ユーティリティ関数
# ========================

# git でファイル/ディレクトリの最終コミットの Unix タイムスタンプを取得
# マージコミットを除外（--no-merges）
# 取得できない場合は 0 を返す
get_src_ts() {
  local repo="$1"
  local path="$2"
  local ts
  ts=$(git -C "$repo" log -1 --format='%ct' --no-merges -- "$path" 2>/dev/null)
  echo "${ts:-0}"
}

# ドキュメント側は --no-merges なし（ドキュメントコミット自体がマージのこともある）
get_doc_ts() {
  local repo="$1"
  local path="$2"
  local ts
  ts=$(git -C "$repo" log -1 --format='%ct' -- "$path" 2>/dev/null)
  echo "${ts:-0}"
}

# Unix タイムスタンプを ISO 8601 形式に変換
ts_to_iso() {
  local ts="$1"
  if [ "$ts" = "0" ]; then
    echo "未生成"
  else
    date -r "$ts" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$ts"
  fi
}

# ========================
# 1. バックエンド API ドキュメント
# ========================
echo "=== [Backend API] バックエンド詳細設計書 ==="

declare -A BACKEND_MAP
BACKEND_MAP=(
  [account]=account
  [admin_group]=admin_group
  [agent]=agent
  [bat]=batch
  [cart]=cart
  [csv_down]=csv
  [faq]=faq
  [file]=file
  [group]=group
  [item]=item
  [item_group]=item_group
  [mail_template]=mail_template
  [manual_sync]=sync
  [message]=message
  [monitor]=utility
  [news]=news
  [page]=page
  [partner_order]=partner
  [send_mail]=notification
  [sqs]=sqs
  [sync_agent]=sync
  [ticket]=ticket
  [upload]=upload
  [user_order]=order
  [user_ticket_delivery]=ticket_delivery
  [user_ticket_delivery_expire]=ticket_delivery
  [expo_auth]=authentication
  [cognito_notify]=notification
)

for func_dir in "${!BACKEND_MAP[@]}"; do
  doc_category="${BACKEND_MAP[$func_dir]}"
  src_rel="backend/function/$func_dir"
  doc_rel="backend/api/$doc_category"

  [ -d "$SRC_DIR/$src_rel" ] || continue

  src_ts=$(get_src_ts "$SRC_DIR" "$src_rel")
  [ "$src_ts" != "0" ] || continue

  if [ ! -d "$DOC_DIR/$doc_rel" ]; then
    echo "MISSING backend $src_rel -> $doc_rel"
    MISSING_COUNT=$((MISSING_COUNT + 1))
    continue
  fi

  doc_ts=$(get_doc_ts "$DOC_DIR" "$doc_rel")

  if [ "$src_ts" -gt "$doc_ts" ]; then
    echo "STALE backend $src_rel -> $doc_rel (src: $(ts_to_iso "$src_ts"), doc: $(ts_to_iso "$doc_ts"))"
    STALE_COUNT=$((STALE_COUNT + 1))
  fi
done

echo ""

# ========================
# 2. フロントエンド 画面設計書 (user-facing)
# ========================
echo "=== [Frontend] 画面設計書 (ユーザー向け) ==="

if [ -d "$SRC_DIR/frontend/pages" ]; then
  for page_dir in $(ls "$SRC_DIR/frontend/pages/"); do
    [[ "$page_dir" =~ ^(_|index\.tsx$|403$|404$|500$|502$|503$) ]] && continue
    [ -d "$SRC_DIR/frontend/pages/$page_dir" ] || continue

    src_rel="frontend/pages/$page_dir"
    doc_rel="frontend/screens/$page_dir"

    src_ts=$(get_src_ts "$SRC_DIR" "$src_rel")
    [ "$src_ts" != "0" ] || continue

    if [ ! -d "$DOC_DIR/$doc_rel" ]; then
      echo "MISSING frontend $src_rel -> $doc_rel"
      MISSING_COUNT=$((MISSING_COUNT + 1))
      continue
    fi

    doc_ts=$(get_doc_ts "$DOC_DIR" "$doc_rel")

    if [ "$src_ts" -gt "$doc_ts" ]; then
      echo "STALE frontend $src_rel -> $doc_rel (src: $(ts_to_iso "$src_ts"), doc: $(ts_to_iso "$doc_ts"))"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  done
fi

echo ""

# ========================
# 3. フロントエンド 画面設計書 (管理者向け)
# ========================
echo "=== [Frontend-Admin] 画面設計書 (管理者向け) ==="

if [ -d "$SRC_DIR/frontend-admin/pages" ]; then
  for page_dir in $(ls "$SRC_DIR/frontend-admin/pages/"); do
    [[ "$page_dir" =~ ^(_|index\.tsx$|403$|404$|500$|502$|503$) ]] && continue
    [ -d "$SRC_DIR/frontend-admin/pages/$page_dir" ] || continue

    src_rel="frontend-admin/pages/$page_dir"
    doc_rel="frontend-admin/screens/$page_dir"

    src_ts=$(get_src_ts "$SRC_DIR" "$src_rel")
    [ "$src_ts" != "0" ] || continue

    if [ ! -d "$DOC_DIR/$doc_rel" ]; then
      echo "MISSING frontend-admin $src_rel -> $doc_rel"
      MISSING_COUNT=$((MISSING_COUNT + 1))
      continue
    fi

    doc_ts=$(get_doc_ts "$DOC_DIR" "$doc_rel")

    if [ "$src_ts" -gt "$doc_ts" ]; then
      echo "STALE frontend-admin $src_rel -> $doc_rel (src: $(ts_to_iso "$src_ts"), doc: $(ts_to_iso "$doc_ts"))"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  done
fi

echo ""

# ========================
# 4. フロントエンド 画面設計書 (パートナー向け)
# ========================
echo "=== [Frontend-Partners] 画面設計書 (パートナー向け) ==="

if [ -d "$SRC_DIR/frontend-partners/pages" ]; then
  # パートナーは全体をひとつの doc_rel として扱う
  partner_doc_rel="frontend-partners/screens"
  any_stale=0
  newest_src_ts=0

  for page_dir in $(ls "$SRC_DIR/frontend-partners/pages/"); do
    [[ "$page_dir" =~ ^(_|index\.tsx$|403$|404$|500$|502$|503$) ]] && continue
    [ -d "$SRC_DIR/frontend-partners/pages/$page_dir" ] || continue

    src_rel="frontend-partners/pages/$page_dir"
    src_ts=$(get_src_ts "$SRC_DIR" "$src_rel")
    [ "$src_ts" != "0" ] || continue

    if [ "$src_ts" -gt "$newest_src_ts" ]; then
      newest_src_ts="$src_ts"
    fi
  done

  if [ "$newest_src_ts" != "0" ]; then
    if [ ! -d "$DOC_DIR/$partner_doc_rel" ]; then
      echo "MISSING frontend-partners frontend-partners/pages/ -> $partner_doc_rel"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    else
      doc_ts=$(get_doc_ts "$DOC_DIR" "$partner_doc_rel")
      if [ "$newest_src_ts" -gt "$doc_ts" ]; then
        echo "STALE frontend-partners frontend-partners/pages/ -> $partner_doc_rel (src: $(ts_to_iso "$newest_src_ts"), doc: $(ts_to_iso "$doc_ts"))"
        STALE_COUNT=$((STALE_COUNT + 1))
      fi
    fi
  fi
fi

echo ""

# ========================
# 5. ER図
# ========================
echo "=== [DB] ER図 ==="

src_ts=$(get_src_ts "$SRC_DIR" "db_scheme.sql")

if [ "$src_ts" != "0" ]; then
  er_file=$(find "$DOC_DIR/backend/er" -name "er-*.md" 2>/dev/null | head -1)
  if [ -z "$er_file" ]; then
    echo "MISSING er db_scheme.sql -> backend/er/er-diagram.md"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  else
    er_rel="${er_file#$DOC_DIR/}"
    doc_ts=$(get_doc_ts "$DOC_DIR" "$er_rel")
    if [ "$src_ts" -gt "$doc_ts" ]; then
      echo "STALE er db_scheme.sql -> $er_rel (src: $(ts_to_iso "$src_ts"), doc: $(ts_to_iso "$doc_ts"))"
      STALE_COUNT=$((STALE_COUNT + 1))
    fi
  fi
fi

echo ""
echo "========================================"
echo "陳腐化: ${STALE_COUNT}件 / 未生成: ${MISSING_COUNT}件"
echo "========================================"
