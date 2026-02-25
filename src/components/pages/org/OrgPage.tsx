// src/components/pages/org/OrgPage.tsx
// Creator 専用: 組織管理・Admin 作成ページ

import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, createUser, inviteUser } from '../../../lib/supabase';

type Tab = 'overview' | 'create-admin' | 'invite';

export function OrgPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  // Creator 以外はアクセス不可
  if (!user || user.profile.role !== 'creator') {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-zinc-400 text-sm">このページは Creator 専用です</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display tracking-widest text-zinc-100">ORGANIZATION</h1>
        <p className="text-xs text-zinc-500 mt-1 tracking-wider">
          {user.organization.name} · 組織管理（Creator 専用）
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-8 border-b border-zinc-800">
        {([
          { id: 'overview', label: '組織情報' },
          { id: 'create-admin', label: 'Admin 作成' },
          { id: 'invite', label: '招待送信' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-mono tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'text-yellow-300 border-yellow-400'
                : 'text-zinc-500 border-transparent hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OrgOverview />}
      {tab === 'create-admin' && <CreateAdminForm />}
      {tab === 'invite' && <InviteForm />}
    </div>
  );
}

// ── 組織情報 ──

function OrgOverview() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.organization.name ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name: name.trim() })
      .eq('id', user.organization.id);
    setSaving(false);
    if (error) {
      setMsg(`エラー: ${error.message}`);
    } else {
      setMsg('組織名を更新しました');
      setEditing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xs text-zinc-500 tracking-widest uppercase mb-4">基本情報</h2>
        <div className="grid gap-4">
          <InfoRow label="組織 ID" value={user?.organization.id ?? ''} mono />
          <InfoRow label="スラッグ" value={user?.organization.slug ?? ''} mono />
          <div>
            <label className="text-xs text-zinc-500 tracking-widest uppercase block mb-2">
              組織名
            </label>
            {editing ? (
              <div className="flex gap-3">
                <input
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none flex-1"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-yellow-400 text-zinc-900 text-sm font-semibold rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => { setEditing(false); setName(user?.organization.name ?? ''); }}
                  className="px-4 py-2 text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-zinc-200">{user?.organization.name}</span>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-zinc-600 hover:text-yellow-400 transition-colors font-mono"
                >
                  編集
                </button>
              </div>
            )}
          </div>
          <InfoRow label="作成日" value={new Date(user?.organization.created_at ?? '').toLocaleDateString('ja-JP')} />
        </div>
        {msg && (
          <p className="mt-3 text-xs text-yellow-400 font-mono">{msg}</p>
        )}
      </div>

      {/* セキュリティ情報 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xs text-zinc-500 tracking-widest uppercase mb-4">セキュリティ</h2>
        <div className="space-y-3">
          <SecurityRow icon="✓" label="Row Level Security" status="有効" ok />
          <SecurityRow icon="✓" label="Service Role Key" status="Edge Function 限定" ok />
          <SecurityRow icon="✓" label="JWT 認証" status="有効" ok />
          <SecurityRow icon="✓" label="組織データ分離" status="organization_id 基準" ok />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 tracking-widest uppercase mb-1">{label}</p>
      <p className={`text-sm text-zinc-300 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function SecurityRow({ icon, label, status, ok }: { icon: string; label: string; status: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>{icon}</span>
      <span className="text-sm text-zinc-400 flex-1">{label}</span>
      <span className={`text-xs font-mono ${ok ? 'text-emerald-400' : 'text-amber-400'}`}>{status}</span>
    </div>
  );
}

// ── Admin 直接作成フォーム ──

function CreateAdminForm() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'admin' as 'admin' | 'player' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const { error } = await createUser(form);
    setLoading(false);

    if (error) {
      setResult({ type: 'error', msg: error });
    } else {
      setResult({ type: 'success', msg: `${form.full_name}（${form.role}）のアカウントを作成しました` });
      setForm({ email: '', password: '', full_name: '', role: 'admin' });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-sm text-yellow-300/70">
        <p className="font-mono text-[11px] tracking-widest text-yellow-400 mb-1">CREATOR 専用操作</p>
        パスワードを含むアカウントを直接作成します。招待メール不要でアカウントを即時発行できます。
      </div>

      <FormField label="氏名">
        <input
          required
          type="text"
          placeholder="山田 太郎"
          value={form.full_name}
          onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
        />
      </FormField>

      <FormField label="メールアドレス">
        <input
          required
          type="email"
          placeholder="admin@company.co.jp"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
        />
      </FormField>

      <FormField label="初期パスワード（8文字以上）">
        <input
          required
          type="password"
          placeholder="••••••••"
          minLength={8}
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
        />
      </FormField>

      <FormField label="ロール">
        <div className="flex gap-3">
          {(['admin', 'player'] as const).map(r => (
            <label key={r} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              form.role === r
                ? 'border-yellow-400/40 bg-yellow-400/5 text-yellow-300'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
            }`}>
              <input
                type="radio"
                name="role"
                value={r}
                checked={form.role === r}
                onChange={() => setForm(f => ({ ...f, role: r }))}
                className="hidden"
              />
              <span className="text-sm font-mono">{r.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </FormField>

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          result.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {result.msg}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-yellow-400 text-zinc-900 font-semibold py-2.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors text-sm"
      >
        {loading ? '作成中...' : 'アカウントを作成する'}
      </button>
    </form>
  );
}

// ── 招待フォーム（Creator 向け） ──

function InviteForm() {
  const [form, setForm] = useState({ email: '', role: 'player' as 'admin' | 'player', expires_hours: 72 as 24 | 48 | 72 | 168 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; msg: string; url?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const { data, error } = await inviteUser(form);
    setLoading(false);

    if (error) {
      setResult({ type: 'error', msg: error });
    } else {
      setResult({
        type: 'success',
        msg: `${form.email} に招待を送信しました`,
        url: (data as any)?.invitation?.invite_url,
      });
      setForm(f => ({ ...f, email: '' }));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-5">
      <FormField label="招待先メールアドレス">
        <input
          required
          type="email"
          placeholder="member@company.co.jp"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
        />
      </FormField>

      <FormField label="ロール">
        <div className="flex gap-3">
          {(['admin', 'player'] as const).map(r => (
            <label key={r} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              form.role === r
                ? 'border-yellow-400/40 bg-yellow-400/5 text-yellow-300'
                : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
            }`}>
              <input type="radio" name="inv-role" value={r} checked={form.role === r}
                onChange={() => setForm(f => ({ ...f, role: r }))} className="hidden" />
              <span className="text-sm font-mono">{r.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="リンク有効期限">
        <select
          value={form.expires_hours}
          onChange={e => setForm(f => ({ ...f, expires_hours: Number(e.target.value) as any }))}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none appearance-none cursor-pointer"
        >
          <option value={24}>24時間</option>
          <option value={48}>48時間</option>
          <option value={72}>72時間（推奨）</option>
          <option value={168}>7日間</option>
        </select>
      </FormField>

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm space-y-2 ${
          result.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          <p>{result.msg}</p>
          {result.url && (
            <p className="text-xs font-mono text-emerald-300/60 break-all">{result.url}</p>
          )}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full bg-yellow-400 text-zinc-900 font-semibold py-2.5 rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors text-sm">
        {loading ? '送信中...' : '招待を送信する'}
      </button>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 tracking-widest uppercase block mb-2">{label}</label>
      {children}
    </div>
  );
}
