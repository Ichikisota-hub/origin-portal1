// supabase/functions/create-user/index.ts
// Creator 専用: Admin アカウント作成
// service_role はこの Edge Function のみで使用

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. 呼び出し元の JWT 検証（publishable key + user JWT）
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "認証情報がありません");
    }

    // anon クライアント（JWT 検証用）
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return errorResponse(401, "無効なセッションです");
    }

    // ── 2. 呼び出し元の権限確認
    const { data: callerProfile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("role, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile) {
      return errorResponse(403, "プロフィールが見つかりません");
    }

    if (callerProfile.role !== "creator") {
      return errorResponse(403, "Creator 権限が必要です");
    }

    // ── 3. リクエストボディ検証
    const { email, password, full_name, role } = await req.json();

    if (!email || !password || !full_name) {
      return errorResponse(400, "必須項目が不足しています: email, password, full_name");
    }

    // Creator は admin のみ作成可能（creator は作成不可）
    const allowedRoles = ["admin", "player"];
    if (!allowedRoles.includes(role)) {
      return errorResponse(400, `ロールは admin または player を指定してください`);
    }

    if (password.length < 8) {
      return errorResponse(400, "パスワードは8文字以上で指定してください");
    }

    // ── 4. service_role クライアント（ここのみで使用）
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // メール重複チェック
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("organization_id", callerProfile.organization_id)
      .single();

    if (existing) {
      return errorResponse(409, "このメールアドレスは既に使用されています");
    }

    // ── 5. auth.users にユーザー作成
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // メール確認スキップ（管理者作成のため）
      user_metadata: {
        full_name,
        role,
        organization_id: callerProfile.organization_id,
      },
    });

    if (createError || !newUser.user) {
      console.error("auth.admin.createUser error:", createError);
      return errorResponse(500, `ユーザー作成に失敗しました: ${createError?.message}`);
    }

    // ── 6. profiles テーブルに挿入
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        organization_id: callerProfile.organization_id,
        role,
        full_name,
        email,
        created_by: user.id,
        is_active: true,
      });

    if (insertError) {
      // ロールバック: auth ユーザー削除
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      console.error("profiles insert error:", insertError);
      return errorResponse(500, `プロフィール作成に失敗しました: ${insertError.message}`);
    }

    // ── 7. アクティビティログ
    await supabaseAdmin.from("activity_logs").insert({
      organization_id: callerProfile.organization_id,
      actor_id: user.id,
      action: "user.created",
      target_id: newUser.user.id,
      target_type: "profile",
      metadata: { role, email, full_name },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email,
          full_name,
          role,
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
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
