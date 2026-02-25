// supabase/functions/accept-invite/index.ts
// 招待リンクのトークン検証 + アカウント作成

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { token, password, full_name } = await req.json();

    if (!token || !password || !full_name) {
      return errorResponse(400, "token, password, full_name は必須です");
    }

    if (password.length < 8) {
      return errorResponse(400, "パスワードは8文字以上で設定してください");
    }

    // ── 1. トークン検証
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .select("*, organizations(name, slug)")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      return errorResponse(404, "招待が見つかりません。リンクが無効または期限切れです");
    }

    // ── 2. 既存ユーザーチェック（同組織）
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", invitation.email)
      .eq("organization_id", invitation.organization_id)
      .single();

    if (existing) {
      return errorResponse(409, "このメールアドレスは既に登録済みです");
    }

    // ── 3. auth.users にユーザー作成
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: invitation.role,
        organization_id: invitation.organization_id,
      },
    });

    if (createError || !newUser.user) {
      return errorResponse(500, `アカウント作成に失敗しました: ${createError?.message}`);
    }

    // ── 4. profiles 登録
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        organization_id: invitation.organization_id,
        role: invitation.role,
        full_name,
        email: invitation.email,
        created_by: invitation.invited_by,
        is_active: true,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return errorResponse(500, `プロフィール登録に失敗しました: ${profileError.message}`);
    }

    // ── 5. 招待ステータス更新
    await supabaseAdmin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    // ── 6. アクティビティログ
    await supabaseAdmin.from("activity_logs").insert({
      organization_id: invitation.organization_id,
      actor_id: newUser.user.id,
      action: "invitation.accepted",
      target_id: invitation.id,
      target_type: "invitation",
      metadata: { role: invitation.role, email: invitation.email },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "アカウントが作成されました。ログインしてください。",
        email: invitation.email,
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
