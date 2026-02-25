// src/App.tsx
import React from 'react';
import { AuthContext, useAuthProvider } from './hooks/useAuth';
import { LoginPage } from './components/auth/LoginPage';
import { AcceptInvitePage } from './components/pages/invites/AcceptInvitePage';
import { MembersPage } from './components/pages/members/MembersPage';
import { OrgPage } from './components/pages/org/OrgPage';
import { InvitesPage } from './components/pages/invites/InvitesPage';
import { SalesAnalyticsPage } from './components/pages/analytics/SalesAnalyticsPage';
import { ROLE_LABEL, ROLE_COLOR } from './types';

// ── シンプルルーター（react-router なし） ──
function useRoute() {
  const [path, setPath] = React.useState(window.location.pathname + window.location.search);
  React.useEffect(() => {
    const handler = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return {
    path,
    navigate: (to: string) => { window.history.pushState({}, '', to); setPath(to); },
  };
}

// ── レイアウト（サイドバー + メイン） ──
function AppLayout({ children, currentPath, navigate }: {
  children: React.ReactNode;
  currentPath: string;
  navigate: (path: string) => void;
}) {
  const { user, signOut } = React.useContext(AuthContext);
  const role = user?.profile.role;

  const navItems = [
    { path: '/dashboard', label: 'ダッシュボード', icon: '▣', roles: ['creator', 'admin', 'player'] },
    { path: '/analytics', label: '営業分析', icon: '📊', roles: ['creator', 'admin'] },
    { path: '/members', label: 'メンバー管理', icon: '◎', roles: ['creator', 'admin'] },
    { path: '/invites', label: '招待管理', icon: '✉', roles: ['creator', 'admin'] },
    { path: '/org', label: '組織管理', icon: '★', roles: ['creator'] }, // creator only
  ];

  const visibleNav = navItems.filter(item => role && item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
      {/* ── サイドバー ── */}
      <aside className="w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col fixed top-0 left-0 bottom-0 z-50">
        {/* ロゴ */}
        <div className="px-6 py-7 border-b border-zinc-800">
          <div className="text-3xl tracking-[0.15em] text-yellow-400 leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            ORIGIN
          </div>
          <div className="text-[9px] tracking-[0.3em] text-zinc-600 mt-1">ADMIN PORTAL</div>
        </div>

        {/* 組織 */}
        <div className="mx-4 my-4 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-3">
          <div className="text-xs font-medium text-zinc-200 truncate">{user?.organization.name}</div>
          <div className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate">{user?.organization.id.slice(0, 16)}...</div>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-2">
          {visibleNav.map(item => {
            const isActive = currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left mb-1 transition-colors relative ${
                  isActive
                    ? 'bg-yellow-400/8 text-yellow-300'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-yellow-400 rounded-r" />
                )}
                <span className="text-[13px]">{item.icon}</span>
                <span className="tracking-wide">{item.label}</span>
                {item.path === '/org' && (
                  <span className="ml-auto text-[8px] font-mono text-yellow-500/50 tracking-widest">CR</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* フッター：ユーザー情報 */}
        <div className="px-4 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border"
              style={{ background: `${ROLE_COLOR[role!]}15`, borderColor: `${ROLE_COLOR[role!]}30`, color: ROLE_COLOR[role!] }}>
              {(user?.profile.full_name ?? user?.email ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-zinc-300 truncate">{user?.profile.full_name}</div>
              <div className="text-[10px] font-mono" style={{ color: ROLE_COLOR[role!] }}>{ROLE_LABEL[role!]}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full text-[11px] text-zinc-600 hover:text-zinc-400 font-mono tracking-widest text-left transition-colors"
          >
            サインアウト →
          </button>
        </div>
      </aside>

      {/* ── メインコンテンツ ── */}
      <main className="ml-56 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}

// ── 簡易ダッシュボード（各ロールのホーム） ──
function DashboardPage() {
  const { user } = React.useContext(AuthContext);
  const role = user?.profile.role;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl tracking-widest text-zinc-100 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
        DASHBOARD
      </h1>
      <p className="text-xs text-zinc-500 mb-8">
        おかえりなさい、{user?.profile.full_name} さん
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'あなたのロール', value: ROLE_LABEL[role!], color: ROLE_COLOR[role!] },
          { label: '組織名', value: user?.organization.name ?? '—', color: '#8891a4' },
          { label: '組織 ID', value: user?.organization.id.slice(0, 8) + '...', color: '#3d4455', mono: true },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-[10px] text-zinc-600 tracking-widest uppercase mb-2">{card.label}</p>
            <p className={`text-lg font-semibold ${card.mono ? 'font-mono text-sm' : ''}`} style={{ color: card.color }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ロール別インフォ */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xs text-zinc-500 tracking-widest uppercase mb-4">あなたの権限</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          {role === 'creator' && <>
            <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> 組織情報の管理・編集</li>
            <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> Admin / Player アカウントの直接作成</li>
            <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> Admin / Player への招待送信</li>
            <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> 全メンバーの管理・無効化</li>
          </>}
          {role === 'admin' && <>
            <li className="flex items-center gap-2"><span className="text-sky-400">▸</span> Player / Admin への招待送信</li>
            <li className="flex items-center gap-2"><span className="text-sky-400">▸</span> メンバー一覧の閲覧</li>
            <li className="flex items-center gap-2"><span className="text-sky-400">▸</span> Player の無効化</li>
            <li className="flex items-center gap-2"><span className="text-zinc-600">✕</span> 組織管理（Creator 限定）</li>
          </>}
          {role === 'player' && <>
            <li className="flex items-center gap-2"><span className="text-violet-400">▸</span> 自分のプロフィール閲覧</li>
            <li className="flex items-center gap-2"><span className="text-zinc-600">✕</span> メンバー管理（Admin 以上）</li>
            <li className="flex items-center gap-2"><span className="text-zinc-600">✕</span> 招待送信（Admin 以上）</li>
          </>}
        </ul>
      </div>
    </div>
  );
}

// ── ルートガード ──
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 font-mono text-sm tracking-widest">LOADING...</div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  return <>{children}</>;
}

// ── メインApp ──
export function App() {
  const authValue = useAuthProvider();
  const { path, navigate } = useRoute();

  // 招待受け入れページ（認証不要）
  if (path.startsWith('/invite/accept')) {
    return (
      <AuthContext.Provider value={authValue}>
        <AcceptInvitePage />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authValue}>
      <AuthGuard>
        <AppLayout currentPath={path} navigate={navigate}>
          {path.startsWith('/analytics') && <SalesAnalyticsPage />}
          {path.startsWith('/members') && <MembersPage />}
          {path.startsWith('/invites') && <InvitesPage />}
          {path.startsWith('/org') && <OrgPage />}
          {(path === '/' || path.startsWith('/dashboard')) && <DashboardPage />}
        </AppLayout>
      </AuthGuard>
    </AuthContext.Provider>
  );
}
