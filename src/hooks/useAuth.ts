// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import type { AuthUser, Profile, Organization } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider(): AuthContextValue {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserData(userId: string): Promise<AuthUser | null> {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      console.error('Profile load error:', profileError);
      return null;
    }

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', (profile as Profile).organization_id)
      .single();

    if (orgError || !org) {
      console.error('Org load error:', orgError);
      return null;
    }

    // 最終ログイン時刻を更新
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);

    return {
      id: userId,
      email: profile.email,
      profile: profile as Profile,
      organization: org as Organization,
    };
  }

  useEffect(() => {
    // 初期セッション取得
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const authUser = await loadUserData(session.user.id);
        setUser(authUser);
      }
      setLoading(false);
    });

    // セッション変更の購読
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const authUser = await loadUserData(session.user.id);
          setUser(authUser);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message === 'Invalid login credentials'
        ? 'メールアドレスまたはパスワードが正しくありません'
        : error.message;
      return { error: msg };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return { user, loading, signIn, signOut };
}
