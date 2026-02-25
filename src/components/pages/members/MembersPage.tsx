// src/components/pages/members/MembersPage.tsx
import React, { useState, useEffect } from 'react';
import { supabase, deactivateMember } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import type { Profile } from '../../../types';
import { canDeleteMember, canCreateAdmin, canInviteUser, ROLE_LABEL } from '../../../types';

// ── 小コンポーネント ──

function RoleBadge({ role }: { role: Profile['role'] }) {
  const colors = {
    creator: 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/20',
    admin:   'bg-sky-400/10 text-sky-300 border border-sky-400/20',
    player:  'bg-violet-400/10 text-violet-300 border border-violet-400/20',
  };
  return (
    <span className={`text-[10px] font-mono tracking-widest px-2 py-0.5 rounded ${colors[role]}`}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusDot({ isActive, lastSeen }: { isActive: boolean; lastSeen: string | null }) {
  if (!isActive) return <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />;
  const recentlyActive = lastSeen
    ? (Date.now() - new Date(lastSeen).getTime()) < 15 * 60 * 1000
    : false;
  return recentlyActive
    ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_4px_#4ade80]" />
    : <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />;
}

function MemberAvatar({ profile }: { profile: Profile }) {
  const colors = {
    creator: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30',
    admin:   'bg-sky-400/10 text-sky-300 border-sky-400/30',
    player:  'bg-violet-400/10 text-violet-300 border-violet-400/30',
  };
  const initials = (profile.full_name ?? profile.email)
    .split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border ${colors[profile.role]}`}>
      {initials}
    </div>
  );
}

function formatLastSeen(ts: string | null): string {
  if (!ts) return '未ログイン';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'たった今';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
  return `${Math.floor(diff / 86_400_000)}日前`;
}

// ── メインページ ──

export function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Profile['role'] | 'all'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const myRole = user?.profile.role;

  useEffect(() => {
    loadMembers();
    // リアルタイム購読
    const sub = supabase
      .channel('profiles-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'profiles',
        filter: `organization_id=eq.${user?.profile.organization_id}`,
      }, () => loadMembers())
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  async function loadMembers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', user?.profile.organization_id)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) setMembers(data as Profile[]);
    setLoading(false);
  }

  async function handleDelete(target: Profile) {
    if (!confirm(`${target.full_name ?? target.email} を無効化しますか？`)) return;
    setDeletingId(target.id);
    const { error } = await deactivateMember(target.id);
    if (error) setError(error);
    else await loadMembers();
    setDeletingId(null);
  }

  const filtered = members
    .filter(m => m.is_active)
    .filter(m => roleFilter === 'all' || m.role === roleFilter)
    .filter(m =>
      search === '' ||
      m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-widest text-zinc-100">MEMBERS</h1>
          <p className="text-xs text-zinc-500 mt-1 tracking-wider">
            {user?.organization.name} · {filtered.length} 名のアクティブメンバー
          </p>
        </div>
      </div>

      {/* フィルターバー */}
      <div className="flex gap-3 mb-6 items-center">
        <input
          type="text"
          placeholder="名前・メールで検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 w-56 focus:border-yellow-400/50 outline-none placeholder:text-zinc-600 transition-colors"
        />
        <div className="flex gap-1">
          {(['all', 'creator', 'admin', 'player'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-[11px] tracking-wider font-mono transition-colors ${
                roleFilter === r
                  ? 'bg-yellow-400/10 text-yellow-300 border border-yellow-400/20'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {r === 'all' ? 'ALL' : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-zinc-600 font-mono">
          {filtered.length} / {members.filter(m => m.is_active).length} 件
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-300">✕</button>
        </div>
      )}

      {/* テーブル */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left px-6 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">メンバー</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">ロール</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">状態</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">最終アクセス</th>
              <th className="text-left px-4 py-3 text-[10px] text-zinc-600 tracking-widest uppercase font-normal">追加者</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-600 text-sm">
                  該当するメンバーがいません
                </td>
              </tr>
            ) : filtered.map(member => {
              const isDeletable = myRole ? canDeleteMember(myRole, member.role) : false;
              const isSelf = member.id === user?.id;

              return (
                <tr key={member.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <MemberAvatar profile={member} />
                      <div>
                        <div className="text-sm font-medium text-zinc-200">
                          {member.full_name ?? '（未設定）'}
                          {isSelf && <span className="ml-2 text-[10px] text-yellow-400/60 font-mono">YOU</span>}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusDot isActive={member.is_active} lastSeen={member.last_seen_at} />
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-500 font-mono">
                    {formatLastSeen(member.last_seen_at)}
                  </td>
                  <td className="px-4 py-4 text-xs text-zinc-600 font-mono">
                    {member.created_by ? '管理者' : 'システム'}
                  </td>
                  <td className="px-4 py-4">
                    {isDeletable && !isSelf && (
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={deletingId === member.id}
                        className="text-zinc-600 hover:text-red-400 transition-colors text-xs px-2 py-1 rounded hover:bg-red-400/5 disabled:opacity-40"
                      >
                        {deletingId === member.id ? '処理中...' : '無効化'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 権限の説明 */}
      <div className="mt-4 text-[11px] text-zinc-600 font-mono space-y-1">
        {myRole === 'creator' && <p>★ Creator: 全メンバーの管理・削除が可能です</p>}
        {myRole === 'admin' && <p>▸ Admin: Player の管理・削除が可能です</p>}
      </div>
    </div>
  );
}
