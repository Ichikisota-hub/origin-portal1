// src/components/pages/invites/AcceptInvitePage.tsx
// 招待リンクからのアカウント登録ページ
// /invite/accept?token=xxxxx でアクセス

import React, { useState, useEffect } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function AcceptInvitePage() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [step, setStep] = useState<'loading' | 'form' | 'success' | 'error'>('loading');
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string } | null>(null);
  const [form, setForm] = useState({ full_name: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStep('error');
      return;
    }
    // トークン情報の先行取得（メール表示用）
    // 実際には Edge Function でバリデーション
    setStep('form');
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('パスワードが一致しません');
      return;
    }
    if (form.password.length < 8) {
      setError('パスワードは8文字以上で設定してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          token,
          password: form.password,
          full_name: form.full_name,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? '登録に失敗しました');
      } else {
        setStep('success');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-zinc-300 font-mono mb-2">招待リンクが無効です</h2>
          <p className="text-sm text-zinc-600">リンクが期限切れか、すでに使用済みです。</p>
          <a href="/" className="mt-4 text-yellow-400 text-sm hover:underline block">ログインページへ</a>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-6 text-yellow-400">✓</div>
          <h2 className="text-xl text-zinc-200 font-mono tracking-widest mb-2">登録完了</h2>
          <p className="text-sm text-zinc-500 mb-6">アカウントが作成されました。ログインしてください。</p>
          <a
            href="/"
            className="inline-block bg-yellow-400 text-zinc-900 font-bold px-6 py-2.5 rounded-lg hover:bg-yellow-300 transition-colors text-sm"
          >
            ログインページへ
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl tracking-[0.2em] text-yellow-400" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ORIGIN
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-zinc-600 mt-1">招待を受け付けています</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-sm text-zinc-400 tracking-widest uppercase mb-6 font-mono">アカウント登録</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">氏名</label>
              <input
                required type="text" placeholder="山田 太郎"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">パスワード（8文字以上）</label>
              <input
                required type="password" placeholder="••••••••" minLength={8}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">パスワード（確認）</label>
              <input
                required type="password" placeholder="••••••••" minLength={8}
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full bg-yellow-400 text-zinc-900 font-bold py-2.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? '登録中...' : 'アカウントを作成する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
