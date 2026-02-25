// supabase/functions/invite-player/index.ts
// Admin / Creator: メール招待送信
// Admin は admin / player を招待可能
// Creator は admin / player を招待可能

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. JWT 検証
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "認証情報がありません");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse(401, "無効なセッションです");

    // ── 2. 権限確認
    const { data: caller } = await supabaseUser
      .from("profiles")
      .select("role, organization_id, full_name")
      .eq("id", user.id)
      .single();

    if (!caller) return errorResponse(403, "プロフィールが見つかりません");
    if (!["creator", "admin"].includes(caller.role)) {
      return errorResponse(403, "Admin または Creator 権限が必要です");
    }

    // ── 3. リクエスト検証
    const { email, role, expires_hours = 72 } = await req.json();

    if (!email || !role) {
      return errorResponse(400, "email と role は必須です");
    }

    // Admin は creator を招待不可
    if (caller.role === "admin" && role === "creator") {
      return errorResponse(403, "Admin は Creator を招待できません");
    }

    const validRoles = ["admin", "player"];
    if (!validRoles.includes(role)) {
      return errorResponse(400, "ロールは admin または player を指定してください");
    }

    const validExpiry = [24, 48, 72, 168];
    if (!validExpiry.includes(expires_hours)) {
      return errorResponse(400, "有効期限は 24, 48, 72, 168 時間のいずれかです");
    }

    // ── 4. service_role クライアント
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 既存ユーザーチェック
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_active")
      .eq("email", email)
      .eq("organization_id", caller.organization_id)
      .single();

    if (existingProfile?.is_active) {
      return errorResponse(409, "このメールアドレスは既に組織のメンバーです");
    }

    // 既存の pending 招待チェック
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id, expires_at")
      .eq("email", email)
      .eq("organization_id", caller.organization_id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvite) {
      return errorResponse(409, "このメールアドレスへの招待がすでに保留中です");
    }

    // ── 5. 招待レコード作成
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert({
        organization_id: caller.organization_id,
        email,
        role,
        invited_by: user.id,
        expires_at: expiresAt,
        status: "pending",
      })
      .select()
      .single();

    if (inviteError || !invitation) {
      return errorResponse(500, `招待の作成に失敗しました: ${inviteError?.message}`);
    }

    // ── 6. Supabase Auth の招待メール送信
    // （または独自メールサービス使用）
    const inviteUrl = `${Deno.env.get("SITE_URL")}/invite/accept?token=${invitation.token}`;

    // Supabase Auth の inviteUserByEmail を使用する場合:
    // const { error: mailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    //   redirectTo: inviteUrl,
    //   data: { role, organization_id: caller.organization_id, invitation_token: invitation.token }
    // });

    // カスタムメール（Resend / SendGrid 等）を使う場合はここに実装
    // 今回は招待URLをレスポンスに含める（フロントで表示またはメール送信）
    console.log(`招待URL生成: ${inviteUrl} → ${email}`);

    // ── 7. アクティビティログ
    await supabaseAdmin.from("activity_logs").insert({
      organization_id: caller.organization_id,
      actor_id: user.id,
      action: "invitation.sent",
      target_type: "invitation",
      target_id: invitation.id,
      metadata: { email, role, expires_hours },
    });

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email,
          role,
          expires_at: expiresAt,
          invite_url: inviteUrl,
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("Unhandled error:", err);
    return errorResponse(500, "サーバーエラーが発生しました");
  }
});

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
