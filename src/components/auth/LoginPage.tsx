// src/components/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      {/* noise */}
      <div className="fixed inset-0 opacity-30 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`
      }} />

      <div className="w-full max-w-sm mx-4 animate-fade-in">
        {/* ロゴ */}
        <div className="text-center mb-10">
          <h1 className="text-5xl tracking-[0.2em] text-yellow-400" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ORIGIN
          </h1>
          <p className="text-[10px] tracking-[0.35em] text-zinc-600 mt-2 uppercase">Admin Portal</p>
        </div>

        {/* フォームカード */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <h2 className="text-sm text-zinc-400 tracking-widest uppercase mb-6 font-mono">サインイン</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">
                パスワード
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-yellow-400 text-zinc-900 font-bold py-2.5 rounded-lg hover:bg-yellow-300 active:scale-[0.98] disabled:opacity-50 transition-all text-sm mt-2"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        </div>

        {/* フッター */}
        <p className="text-center text-[10px] text-zinc-700 mt-6 font-mono tracking-wider">
          ORIGIN ADMIN PORTAL · Powered by Supabase + Vercel
        </p>
      </div>
    </div>
  );
}
