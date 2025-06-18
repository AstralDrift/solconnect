import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState } from '../types';

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      wallet: null,
      isConnecting: false,
      error: null,
      setWallet: (wallet) => set({ wallet, error: null }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ wallet: state.wallet }),
    }
  )
); 