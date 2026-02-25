// src/types/index.ts

export type UserRole = 'creator' | 'admin' | 'player';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  role: UserRole;
  full_name: string | null;
  email: string;
  created_by: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string;
  status: InviteStatus;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  // joined
  inviter?: Pick<Profile, 'full_name' | 'email'>;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  // joined
  actor?: Pick<Profile, 'full_name' | 'email' | 'role'>;
}

// ── API Request / Response 型 ──

export interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'player';
}

export interface InviteRequest {
  email: string;
  role: 'admin' | 'player';
  expires_hours?: 24 | 48 | 72 | 168;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  full_name: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Auth Context 型 ──

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
  organization: Organization;
}

// ── UI 用ヘルパー型 ──

export const ROLE_LABEL: Record<UserRole, string> = {
  creator: 'Creator',
  admin: 'Admin',
  player: 'Player',
};

export const ROLE_COLOR: Record<UserRole, string> = {
  creator: '#e8ff47',
  admin: '#47c2ff',
  player: '#a78bfa',
};

export function canManageOrg(role: UserRole): boolean {
  return role === 'creator';
}

export function canInviteUser(role: UserRole): boolean {
  return role === 'creator' || role === 'admin';
}

export function canDeleteMember(callerRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'creator') return false;
  if (callerRole === 'creator') return true;
  if (callerRole === 'admin' && targetRole === 'player') return true;
  return false;
}

export function canCreateAdmin(role: UserRole): boolean {
  return role === 'creator';
}
