-- ============================================================
-- 営業データテーブル（スプレッドシート同期用）
-- ============================================================

-- テーブル作成
CREATE TABLE public.sales_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 営業データ
  name            TEXT NOT NULL,
  working_hours   DECIMAL(5,2) DEFAULT 0,
  visits          INTEGER DEFAULT 0,
  primary_face_to_face INTEGER DEFAULT 0,
  face_to_face    INTEGER DEFAULT 0,
  meetings        INTEGER DEFAULT 0,
  appointments    INTEGER DEFAULT 0,
  contracts       INTEGER DEFAULT 0,
  acquired_projects INTEGER DEFAULT 0,
  area            TEXT,
  
  -- メタデータ
  report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  synced_from_sheet BOOLEAN DEFAULT FALSE,
  sheet_row_id    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_sales_reports_org ON public.sales_reports(organization_id);
CREATE INDEX idx_sales_reports_user ON public.sales_reports(user_id);
CREATE INDEX idx_sales_reports_date ON public.sales_reports(report_date DESC);
CREATE INDEX idx_sales_reports_sheet_row ON public.sales_reports(sheet_row_id);

-- 更新日時の自動更新
CREATE TRIGGER trg_sales_reports_updated_at
  BEFORE UPDATE ON public.sales_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- RLS ポリシー
-- ============================================================
ALTER TABLE public.sales_reports ENABLE ROW LEVEL SECURITY;

-- Creator: 全組織のデータを閲覧可能
CREATE POLICY "sales_reports_select_creator" ON public.sales_reports
  FOR SELECT USING (
    public.get_my_role() = 'creator'
  );

-- Admin: 自分の組織のデータのみ閲覧可能
CREATE POLICY "sales_reports_select_admin" ON public.sales_reports
  FOR SELECT USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('creator', 'admin')
  );

-- Player: 自分のデータのみ閲覧可能
CREATE POLICY "sales_reports_select_player" ON public.sales_reports
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Insert（モバイルアプリ・スプレッドシート同期から）
CREATE POLICY "sales_reports_insert_own" ON public.sales_reports
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.get_my_org_id()
  );

-- Update（自分のデータのみ）
CREATE POLICY "sales_reports_update_own" ON public.sales_reports
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- ============================================================
-- 集計ビュー（パフォーマンス最適化用）
-- ============================================================
CREATE OR REPLACE VIEW public.sales_summary AS
SELECT 
  organization_id,
  user_id,
  p.full_name,
  p.email,
  DATE_TRUNC('week', report_date) as week_start,
  SUM(working_hours) as total_working_hours,
  SUM(visits) as total_visits,
  SUM(primary_face_to_face) as total_primary_face_to_face,
  SUM(face_to_face) as total_face_to_face,
  SUM(meetings) as total_meetings,
  SUM(appointments) as total_appointments,
  SUM(contracts) as total_contracts,
  SUM(acquired_projects) as total_acquired_projects,
  COUNT(DISTINCT area) as areas_covered,
  COUNT(*) as report_count
FROM public.sales_reports sr
JOIN public.profiles p ON sr.user_id = p.id
GROUP BY organization_id, user_id, p.full_name, p.email, DATE_TRUNC('week', report_date);

-- RLS for view
ALTER VIEW public.sales_summary SET (security_invoker = true);
