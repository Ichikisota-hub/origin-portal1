-- ============================================================
-- ORIGIN ADMIN PORTAL — Initial Schema
-- 完全組織分離 + RLS ポリシー
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('creator', 'admin', 'player');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- TABLE: organizations
-- ============================================================
CREATE TABLE public.organizations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: profiles
-- auth.users と 1:1 対応。組織IDで完全分離。
-- ============================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'player',
  full_name       TEXT,
  email           TEXT NOT NULL,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_seen_at    TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_email ON public.profiles(email);

-- ============================================================
-- TABLE: invitations
-- ============================================================
CREATE TABLE public.invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            user_role NOT NULL DEFAULT 'player',
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          invite_status NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_status ON public.invitations(status);

-- ============================================================
-- TABLE: activity_logs
-- 監査ログ
-- ============================================================
CREATE TABLE public.activity_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_id       UUID,
  target_type     TEXT,
  metadata        JSONB DEFAULT '{}',
  ip_address      INET,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_org ON public.activity_logs(organization_id);
CREATE INDEX idx_activity_actor ON public.activity_logs(actor_id);
CREATE INDEX idx_activity_created ON public.activity_logs(created_at DESC);

-- ============================================================
-- FUNCTION: updated_at 自動更新
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNCTION: 現在ユーザーの組織ID取得
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- FUNCTION: 現在ユーザーのロール取得
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- RLS 有効化
-- ============================================================
ALTER TABLE public.organizations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: organizations
-- Creator のみ組織情報を閲覧・更新可能
-- ============================================================
CREATE POLICY "org_select_own" ON public.organizations
  FOR SELECT USING (
    id = public.get_my_org_id()
  );

CREATE POLICY "org_update_creator_only" ON public.organizations
  FOR UPDATE USING (
    id = public.get_my_org_id()
    AND public.get_my_role() = 'creator'
  );

-- ============================================================
-- RLS POLICIES: profiles
-- ============================================================

-- 同組織メンバーは全員閲覧可能
CREATE POLICY "profiles_select_same_org" ON public.profiles
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
  );

-- Creator: 同組織の全プロフィール更新可能
CREATE POLICY "profiles_update_creator" ON public.profiles
  FOR UPDATE USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'creator'
  );

-- Admin: 同組織の player / admin のみ更新可能（creator は変更不可）
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'admin'
    AND role != 'creator'
  );

-- Creator のみ削除可能（プロフィールの論理削除は is_active = false）
CREATE POLICY "profiles_delete_creator" ON public.profiles
  FOR DELETE USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() = 'creator'
  );

-- INSERT は Edge Function (service_role) 経由のみ
-- （RLS を bypass するため SECURITY DEFINER 関数で制御）

-- ============================================================
-- RLS POLICIES: invitations
-- ============================================================

-- Creator / Admin: 同組織の招待を閲覧
CREATE POLICY "invitations_select_admin_creator" ON public.invitations
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('creator', 'admin')
  );

-- Creator / Admin: 招待作成（Edge Function 経由）
CREATE POLICY "invitations_insert_admin_creator" ON public.invitations
  FOR INSERT WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('creator', 'admin')
  );

-- Creator / Admin: 招待取消
CREATE POLICY "invitations_update_admin_creator" ON public.invitations
  FOR UPDATE USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('creator', 'admin')
  );

-- ============================================================
-- RLS POLICIES: activity_logs
-- Creator / Admin: 閲覧のみ
-- ============================================================
CREATE POLICY "activity_select_admin_creator" ON public.activity_logs
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('creator', 'admin')
  );

-- ============================================================
-- SEED: デモ組織とcreatorアカウント（開発用）
-- 本番では削除すること
-- ============================================================
-- INSERT INTO public.organizations (name, slug)
-- VALUES ('Frontier Sales Group', 'frontier-sales');
