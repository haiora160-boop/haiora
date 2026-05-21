'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  tenantId?: string | null;
  branchId?: string | null;
};

type AuthState = {
  token?: string;
  user?: AppUser;
  setAuth: (token: string, user: AppUser) => void;
  updateUser: (user: AppUser) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: undefined,
      user: undefined,
      setAuth: (token, user) => set({ token, user }),
      updateUser: (user) => set({ user }),
      logout: () => set({ token: undefined, user: undefined }),
    }),
    { name: 'pos-saas-auth' },
  ),
);
