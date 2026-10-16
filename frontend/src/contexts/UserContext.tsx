import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL, authAPI } from '@/services/api';
import { telegramService } from '@/services/telegram';

export interface User {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  balance?: number;
  main_balance?: number;
  reward_balance?: number;
  avatar?: string;
  // Backend fields
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  updateBalance: (mainBalance: number, rewardBalance: number) => void;
  refreshBalance: () => Promise<void>;
  login: (userData: User) => void;
  logout: () => void;
  authenticateWithTelegram: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-authenticate with Telegram on app start
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Always get user profile from backend with existing token
      loadUserProfile();
    } else if (telegramService.isTelegramApp() && !user) {
      // Authenticate with Telegram if we have a token but no user
      console.log('Telegram app detected, attempting authentication...');
      authenticateWithTelegram();
    } else if (!user) {
      console.log('No Telegram app detected, using demo mode');
      // For development/testing without Telegram
      setUser({
        telegramId: 'demo-user',
        firstName: 'Demo',
        lastName: 'User',
        username: 'demo_user',
        balance: 1000
      });
    }
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.getProfile();
      localStorage.setItem('user', JSON.stringify(response));
      const user = {
        ...response,
        userId: response._id,
      }
      setUser(user);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      setError('Failed to load user profile');
      // Clear invalid token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithTelegram = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Sending authentication request to backend...');
      const initDataRaw = telegramService.getInitData();
      if (!initDataRaw) {
        throw new Error('No Telegram init data available');
      }

      // Get invitation code from localStorage if it exists
      const inviteCode = localStorage.getItem('inviteCode');
      console.log('Invitation code:', inviteCode);

      const response = await authAPI.authenticateFromTelegram(initDataRaw, inviteCode || undefined);

      console.log('Authentication response:', response);
      // Store token and user data
      localStorage.setItem('auth_token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);

      // Clear invitation code after successful authentication
      if (inviteCode) {
        localStorage.removeItem('inviteCode');
      }
    } catch (err) {
      console.error('Telegram authentication failed:', err);
      // If backend requires phone number, minimize and show retry
      const message = (err as any)?.response?.data?.message || (err as any)?.message || '';
      if (typeof message === 'string' && message.includes('PHONE_REQUIRED')) {
        try { telegramService.minimize(); } catch { }
        setError('Phone number required. Please share your contact in Telegram, then retry.');
      } else {
        setError(`Authentication failed: ${API_BASE_URL + err || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateBalance = (mainBalance: number, rewardBalance: number) => {
    if (user) {
      const updatedUser = {
        ...user,
        balance: (mainBalance + rewardBalance),
        main_balance: mainBalance,
        reward_balance: rewardBalance
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const refreshBalance = async () => {
    try {
      const profile = await authAPI.getProfile();
      if (user && (profile.main_balance) !== user.balance) {
        updateBalance(profile.main_balance ?? 0, profile.reward_balance ?? 0);
      }
    } catch (err) {
      console.error('Failed to refresh balance:', err);
      // Optionally, handle the error in the UI
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        error,
        updateBalance,
        refreshBalance,
        login,
        logout,
        authenticateWithTelegram
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
