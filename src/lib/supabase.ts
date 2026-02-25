// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '環境変数 VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// ── Edge Functions 呼び出しヘルパー ──

async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { data: null, error: '未ログインです' };

  const res = await fetch(
    `${supabaseUrl}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json();

  if (!res.ok || !json.success) {
    return { data: null, error: json.error ?? '不明なエラー' };
  }

  return { data: json as T, error: null };
}

// Creator: Admin / Player アカウント直接作成
export async function createUser(params: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'player';
}) {
  return callEdgeFunction<{ user: { id: string; email: string; role: string } }>(
    'create-user',
    params
  );
}

// Creator / Admin: 招待メール送信
export async function inviteUser(params: {
  email: string;
  role: 'admin' | 'player';
  expires_hours?: 24 | 48 | 72 | 168;
}) {
  return callEdgeFunction<{ invitation: { id: string; email: string; invite_url: string } }>(
    'invite-player',
    params
  );
}

// メンバー削除（論理削除）
export async function deactivateMember(targetUserId: string) {
  return callEdgeFunction<{ message: string }>(
    'delete-member',
    { target_user_id: targetUserId }
  );
}
