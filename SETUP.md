# ORIGIN ADMIN PORTAL — セットアップ & デプロイガイド

## アーキテクチャ概要

```
フロントエンド (Vercel)
   ↓ JWT（anon key）
Supabase Auth + PostgreSQL（RLS）
   ↓ service_role（Edge Function 内のみ）
Edge Functions → auth.admin.createUser / inviteUserByEmail
```

---

## 権限設計

| 操作 | Creator | Admin | Player |
|------|:-------:|:-----:|:------:|
| 組織情報の編集 | ✓ | ✗ | ✗ |
| Admin 作成 | ✓ | ✗ | ✗ |
| Admin へ招待送信 | ✓ | ✗ | ✗ |
| Player へ招待送信 | ✓ | ✓ | ✗ |
| メンバー一覧閲覧 | ✓ | ✓ | ✗ |
| Admin を無効化 | ✓ | ✗ | ✗ |
| Player を無効化 | ✓ | ✓ | ✗ |
| Creator を無効化 | ✗ | ✗ | ✗ |

**組織は完全分離** — `organization_id` によって全テーブルの RLS が制御されます。
異なる組織のデータへのアクセスは DB レベルで遮断されます。

---

## Step 1: Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. `Project Settings > API` から以下を控える：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
   - **service_role secret** → Edge Function Secrets に設定（フロントには絶対に入れない）

---

## Step 2: DB マイグレーション実行

```bash
# Supabase CLI をインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref <your-project-ref>

# マイグレーション実行
supabase db push
```

または Supabase Dashboard の SQL Editor で
`supabase/migrations/001_initial_schema.sql` を直接実行。

---

## Step 3: Creator アカウントの手動作成

Creator アカウントは Supabase Dashboard から手動で作成します。

### 3-1. Auth ユーザー作成
`Authentication > Users > Add user` から：
- Email: `creator@yourcompany.com`
- Password: 強力なパスワード
- `Auto Confirm User`: ON

### 3-2. 組織を作成（SQL Editor）
```sql
INSERT INTO public.organizations (name, slug)
VALUES ('あなたの組織名', 'your-org-slug')
RETURNING id;
-- 返ってきた id を次のステップで使用
```

### 3-3. Creator プロフィールを作成（SQL Editor）
```sql
INSERT INTO public.profiles (id, organization_id, role, full_name, email)
VALUES (
  '<auth.users の id>',
  '<organizations の id>',
  'creator',
  '管理者氏名',
  'creator@yourcompany.com'
);
```

---

## Step 4: Edge Functions のデプロイ

```bash
# service_role キーを Supabase Secrets に登録
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase secrets set SITE_URL=https://your-app.vercel.app

# Edge Functions をデプロイ
supabase functions deploy create-user
supabase functions deploy invite-player
supabase functions deploy accept-invite
supabase functions deploy delete-member
```

---

## Step 5: Vercel デプロイ

```bash
# Vercel CLI
npm install -g vercel
vercel

# 環境変数を Vercel に設定
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_SITE_URL
```

または Vercel Dashboard > Settings > Environment Variables から設定。

---

## Step 6: Supabase Auth の設定

Dashboard > Authentication > URL Configuration：
- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: `https://your-app.vercel.app/invite/accept`

Dashboard > Authentication > Email Templates：
- 招待メールのテンプレートをカスタマイズ（任意）

### サインアップ制限（重要）
`Authentication > Providers > Email` で：
- **Enable Email Signup**: OFF にする（招待のみでアカウント作成）

---

## ローカル開発

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集して Supabase の値を設定

# 開発サーバー起動
npm run dev

# Edge Functions ローカル実行
supabase start
supabase functions serve --env-file .env.local
```

---

## セキュリティチェックリスト

- [ ] `service_role` キーはフロントの環境変数に含まれていない
- [ ] `VITE_SUPABASE_ANON_KEY` は anon key (publishable) のみ
- [ ] `.env.local` は `.gitignore` に追加済み
- [ ] Supabase の Email Signup が無効になっている
- [ ] RLS が全テーブルで有効になっている (`SELECT * FROM pg_tables` で確認)
- [ ] Edge Functions に `SUPABASE_SERVICE_ROLE_KEY` が Secrets として設定済み

---

## トラブルシューティング

### ログイン後に組織情報が取れない
→ `profiles` テーブルに該当 `auth.user.id` のレコードがあるか確認

### Edge Function が 403 を返す
→ JWT の `Authorization` ヘッダーが正しく送信されているか確認
→ 呼び出し元ユーザーのロールを `profiles` テーブルで確認

### 招待URLが機能しない
→ Supabase の `Redirect URLs` に `/invite/accept` が登録されているか確認
→ `SITE_URL` が Edge Function の Secrets に正しく設定されているか確認

### RLS エラー
→ `get_my_org_id()` と `get_my_role()` 関数が正しく動作しているか確認
→ `SELECT public.get_my_org_id();` を認証済みユーザーで実行してテスト
