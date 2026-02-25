// supabase/functions/delete-member/index.ts
// メンバー削除（論理削除 is_active = false）
// Creator: 全メンバー削除可能
// Admin: player のみ削除可能（admin / creator は不可）

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "認証情報がありません");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return errorResponse(401, "無効なセッションです");

    const { data: caller } = await supabaseUser
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (!caller || !["creator", "admin"].includes(caller.role)) {
      return errorResponse(403, "権限がありません");
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) return errorResponse(400, "target_user_id は必須です");
    if (target_user_id === user.id) return errorResponse(400, "自分自身は削除できません");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 対象ユーザー確認（同組織内のみ）
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, role, full_name, email")
      .eq("id", target_user_id)
      .eq("organization_id", caller.organization_id)
      .eq("is_active", true)
      .single();

    if (!target) return errorResponse(404, "対象ユーザーが見つかりません");

    // 権限チェック
    if (target.role === "creator") {
      return errorResponse(403, "Creator アカウントは削除できません");
    }
    if (caller.role === "admin" && target.role === "admin") {
      return errorResponse(403, "Admin は他の Admin を削除できません");
    }

    // 論理削除
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", target_user_id)
      .eq("organization_id", caller.organization_id);

    if (deleteError) {
      return errorResponse(500, `削除に失敗しました: ${deleteError.message}`);
    }

    // Auth セッション無効化
    await supabaseAdmin.auth.admin.signOut(target_user_id);

    // アクティビティログ
    await supabaseAdmin.from("activity_logs").insert({
      organization_id: caller.organization_id,
      actor_id: user.id,
      action: "user.deactivated",
      target_id: target_user_id,
      target_type: "profile",
      metadata: { target_role: target.role, target_email: target.email },
    });

    return new Response(
      JSON.stringify({ success: true, message: `${target.full_name} を無効化しました` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return errorResponse(500, "サーバーエラーが発生しました");
  }
});

function errorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
