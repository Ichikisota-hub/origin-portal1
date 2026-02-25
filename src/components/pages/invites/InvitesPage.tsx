// src/components/pages/invites/InvitesPage.tsx
// Admin / Creator: 招待管理ページ

import React, { useState, useEffect } from 'react';
import { supabase, inviteUser } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import type { Invitation } from '../../../types';
import { ROLE_LABEL } from '../../../types';

const STATUS_LABEL: Record<Invitation['status'], string> = {
  pending:  '承認待ち',
  accepted: '承認済み',
  expired:  '期限切れ',
  revoked:  '取消済み',
};

const STATUS_COLOR: Record<Invitation['status'], string> = {
  pending:  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  accepted: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  expired:  'text-zinc-500 bg-zinc-800 border-zinc-700',
  revoked:  'text-red-400 bg-red-400/10 border-red-400/20',
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '期限切れ';
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  return d > 0 ? `${d}日後に期限切れ` : `${h}時間後に期限切れ`;
}

export function InvitesPage() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'player' as 'admin' | 'player', expires_hours: 72 as 24 | 48 | 72 | 168 });
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const canInvite = ['creator', 'admin'].includes(user?.profile.role ?? '');

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', user?.profile.organization_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) setInvites(data as Invitation[]);
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg(null);

    const { error } = await inviteUser(form);
    setSubmitting(false);

    if (error) {
      setFormMsg({ type: 'error', text: error });
    } else {
      setFormMsg({ type: 'success', text: `${form.email} に招待を送信しました` });
      setForm(f => ({ ...f, email: '' }));
      await loadInvites();
      setTimeout(() => setShowForm(false), 2000);
    }
  }

  async function handleRevoke(inviteId: string) {
    if (!confirm('この招待を取り消しますか？')) return;
    setRevoking(inviteId);
    await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', inviteId)
      .eq('organization_id', user?.profile.organization_id);
    await loadInvites();
    setRevoking(null);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">読み込み中...</div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl tracking-widest text-zinc-100" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            INVITATIONS
          </h1>
          <p className="text-xs text-zinc-500 mt-1 tracking-wider">メンバー招待の管理</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-zinc-900 font-semibold text-sm rounded-lg hover:bg-yellow-300 transition-colors"
          >
            <span>+</span> 招待を送る
          </button>
        )}
      </div>

      {/* 招待フォーム */}
      {showForm && (
        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xs text-zinc-500 tracking-widest uppercase mb-4 font-mono">新しい招待</h3>
          <form onSubmit={handleInvite} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-48">
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">メールアドレス</label>
              <input
                required type="email" placeholder="member@company.co.jp"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">ロール</label>
              <select
                value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none appearance-none cursor-pointer"
              >
                {user?.profile.role === 'creator' && <option value="admin">Admin</option>}
                <option value="player">Player</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 tracking-widest uppercase block mb-1.5">有効期限</label>
              <select
                value={form.expires_hours} onChange={e => setForm(f => ({ ...f, expires_hours: Number(e.target.value) as any }))}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-yellow-400/50 outline-none appearance-none cursor-pointer"
              >
                <option value={24}>24時間</option>
                <option value={48}>48時間</option>
                <option value={72}>72時間</option>
                <option value={168}>7日間</option>
              </select>
            </div>
            <button type="submit" disabled={submitting}
              className="px-4 py-2 bg-yellow-400 text-zinc-900 font-semibold text-sm rounded-lg hover:bg-yellow-300 disabled:opacity-50 transition-colors">
              {submitting ? '送信中...' : '送信'}
            </button>
          </form>

          {formMsg && (
            <p className={`mt-3 text-sm font-mono ${formMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
              {formMsg.text}
            </p>
          )}
        </div>
      )}

      {/* 招待一覧 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-6 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">メール</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">ロール</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">ステータス</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">有効期限</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">送信日</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-600 text-sm">
                  招待履歴がありません
                </td>
              </tr>
            ) : invites.map(invite => (
              <tr key={invite.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-zinc-300">{invite.email}</td>
                <td className="px-4 py-4">
                  <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    {ROLE_LABEL[invite.role]}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 rounded border ${STATUS_COLOR[invite.status]}`}>
                    {STATUS_LABEL[invite.status]}
                  </span>
                </td>
                <td className="px-4 py-4 text-xs text-zinc-500 font-mono">
                  {invite.status === 'pending' ? timeLeft(invite.expires_at) : '—'}
                </td>
                <td className="px-4 py-4 text-xs text-zinc-600 font-mono">
                  {new Date(invite.created_at).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-4">
                  {invite.status === 'pending' && canInvite && (
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      disabled={revoking === invite.id}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono disabled:opacity-40"
                    >
                      {revoking === invite.id ? '...' : '取消'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-zinc-700 font-mono">
        {user?.profile.role === 'admin' && '▸ Admin: Player への招待が可能です。Admin の招待は Creator のみ行えます。'}
        {user?.profile.role === 'creator' && '★ Creator: Admin / Player への招待が可能です。'}
      </p>
    </div>
  );
}
