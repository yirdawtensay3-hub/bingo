import axios from 'axios';

interface Room {
  name?: string;
  description?: string;
  stake?: number;
  createdBy?: string;
  users?: string[];
  maxPlayers?: number;
  minPlayers?: number;
  waitingTime?: number;
  status?: string;
}

export interface GameSession {
  _id?: string;
  room?: Room;
  calledNumbers?: number[];
  calledCount?: number;
  status?: string;
  users?: string[];
  startedAt?: Date;
  endedAt?: Date;
  intervalMs?: number;
}

export const TransactionStatus = {
  InProgress: 0,
  Completed: 1,
  Declined: 2,
} as const;

export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const SessionTransactionType = {
  Win: 0,
  Stake: 1,
} as const;

export type SessionTransactionType =
  (typeof SessionTransactionType)[keyof typeof SessionTransactionType];

export interface Transaction {
  _id: string;
  user: string; // User ID (ObjectId as string)
  amount: number;
  status: TransactionStatus;
  createdAt: string; // ISO date string
  updatedAt: string;
}

export interface PaymentTransaction {
  _id: string;
  type: number; // PaymentType enum
  reference?: string;
  createdAt: string;
  updatedAt: string;
  transaction: Transaction;
}

export interface CombinedTransaction {
  _id: string;
  type?: SessionTransactionType; // For session transactions
  transactionType: 'session' | 'payment';
  reference?: string; // For payment transactions
  createdAt: string;
  updatedAt: string;
  transaction: Transaction; // The populated transaction object
}

export interface SessionTransaction {
  _id: string;
  type: number; // PaymentType enum
  reference?: string;
  createdAt: string;
  updatedAt: string;
  transaction: Transaction;
}

export interface CombinedTransaction {
  _id: string;
  type?: SessionTransactionType; // For session transactions
  transactionType: 'session' | 'payment';
  reference?: string; // For payment transactions
  createdAt: string;
  updatedAt: string;
  transaction: Transaction;
}
// API base URL - will be different in production
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://9e454d2b928d.ngrok-free.app';
// const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
  withCredentials: true, // Important for CORS with credentials
});

// Session token storage utilities (per session)
export const sessionTokenStorage = {
  set: (token: string, sessionId?: string) => {
    try {
      if (sessionId) {
        localStorage.setItem(`session_token:${sessionId}`, token);
      }
      // Also keep a generic key for convenience (last used)
      localStorage.setItem('session_token', token);
    } catch (_) { /* no-op */ }
  },
  get: (sessionId?: string): string | null => {
    try {
      if (sessionId) {
        const specific = localStorage.getItem(`session_token:${sessionId}`);
        if (specific) return specific;
      }
      return localStorage.getItem('session_token');
    } catch (_) { return null; }
  },
  clear: (sessionId?: string) => {
    try {
      if (sessionId) localStorage.removeItem(`session_token:${sessionId}`);
      localStorage.removeItem('session_token');
    } catch (_) { /* no-op */ }
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // If an Authorization header is already set, don't overwrite it.
    // This allows specific requests (like Telegram auth) to use their own auth scheme.
    if (config.headers.Authorization) {
      return config;
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);

    if (error.response?.status === 401) {
      // Token expired or invalid, clear auth data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      // Don't redirect in Telegram mini app, just clear data
      if (!window.location.hostname.includes('vercel.app')) {
        window.location.href = '/login';
      }
    }

    // Handle network errors (like HTTP/2 errors)
    // if (error.code === 'ERR_NETWORK' || error.message.includes('HTTP/2')) {
    //   console.error('Network error detected, retrying...');
    //   // Could implement retry logic here
    // }

    return Promise.reject(error);
  }
);

// Retry function for failed requests
const retryRequest = async (fn: () => Promise<any>, retries = 3): Promise<any> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.code === 'ERR_NETWORK' || error?.message?.includes('HTTP/2'))) {
      console.log(`Retrying request, ${retries} attempts left...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return retryRequest(fn, retries - 1);
    }
    throw error;
  }
};

// API endpoints
export const authAPI = {
  // Authenticate with Telegram data
  authenticateFromTelegram: async (initDataRaw: string, invitedBy?: string) => {
    return retryRequest(async () => {
      const body = invitedBy ? { invitedBy } : {};
      const response = await api.post('/auth/telegram', body, {
        headers: {
          'Authorization': `tma ${initDataRaw}`
        }
      });
      return response.data;
    });
  },

  // Get current user profile
  getProfile: async () => {
    return retryRequest(async () => {
      const response = await api.get('/auth/profile');
      return response.data;
    });
  },
};

export const roomsAPI = {
  getRooms: async () => {
    return retryRequest(async () => {
      const response = await api.get('/rooms');
      return response.data;
    });
  },

  getMyRooms: async () => {
    return retryRequest(async () => {
      const response = await api.get('/rooms/myroom');
      return response.data;
    });
  },

  joinRoom: async (roomId: string, userId: string) => {
    return retryRequest(async () => {
      const response = await api.post(`/rooms/${roomId}/join`, { userId });
      // Expected backend response now includes a session token
      // e.g. { sessionId, sessionToken, ... }
      const data = response.data || {};
      const token: string | undefined = data.sessionToken || '';
      const sessionIdResp: string | undefined = data.session!._id || "";
      if (token) {
        sessionTokenStorage.set(token, sessionIdResp);
      }
      return data;
    });
  },

  leaveRoom: async (roomId: string, userId: string) => {
    return retryRequest(async () => {
      const response = await api.post(`/rooms/${roomId}/leave`, { userId });
      return response.data;
    });
  },

  createRoom: async (payload: {
    name: string;
    description?: string;
    stake: number;
    maxPlayers?: number;
    minPlayers?: number;
    hitsToWin?: number;
    waitingTime?: number;
    type?: 'public' | 'private';
    autoStart?: boolean;
    maxNoOfSessions?: number;
  }) => {
    return retryRequest(async () => {
      const response = await api.post('/rooms', payload);
      return response.data;
    });
  },

  startRoom: async (roomId: string) => {
    return retryRequest(async () => {
      const response = await api.post(`/rooms/${roomId}/start`);
      return response.data;
    });
  },

  deleteRoom: async (roomId: string) => {
    return retryRequest(async () => {
      const response = await api.delete(`/rooms/${roomId}`);
      return response.data;
    });
  },

  updateRoom: async (roomId: string, payload: {
    name?: string;
    description?: string;
    stake?: number;
    maxPlayers?: number;
    minPlayers?: number;
    hitsToWin?: number;
    waitingTime?: number;
    type?: 'public' | 'private';
    autoStart?: boolean;
    maxNoOfSessions?: number;
  }) => {
    return retryRequest(async () => {
      const response = await api.put(`/rooms/${roomId}`, payload);
      return response.data;
    });
  },
};

export const transactionAPI = {
  getTransactions: async (page = 1, limit = 10) => {
    const response = await api.get(`/transaction?page=${page}&limit=${limit}`);
    return response.data as CombinedTransaction[];
  },
  getDepositInfo: async () => {
    const response = await api.get(`/transaction/deposit/info`);
    return response.data as {
      phoneNumber: string;
      creditedPartyName: string;
      cbeReceiverName: string;
      cbeReceiverAccount: string;
    };
  },
  depositByReference: async (reference: string, paymentMethod: 'telebirr' | 'cbe' = 'telebirr', accountSuffix?: string) => {
    const response = await api.post(`/transaction/deposit`, {
      reference,
      paymentMethod,
      accountSuffix
    });
    return response.data as {
      success: boolean;
      transactionId: string;
      paymentId: string;
      main_balance: number;
      reward_balance: number;
      receiptNo: string;
      paymentDate: string;
      amount: number;
    };
  },

  requestWithdraw: async (params: { amount: number; method: 'telebirr' | 'cbe'; accountName?: string; accountNumber?: string }) => {
    const response = await api.post(`/transaction/withdraw`, params);
    return response.data as { message: string; transactionId: string; paymentTransactionId: string };
  }
}

export const sessionsAPI = {
  chooseBoard: async (
    params: { sessionToken: string; boardId: string }
  ): Promise<{ added?: boolean; removed?: boolean;[key: string]: any }> => {
    return retryRequest(async () => {
      const payload = { sessionToken: params.sessionToken, boardId: params.boardId };

      const response = await api.post('/sessions/board/choose', payload);
      return response.data as { added?: boolean; removed?: boolean };
    });
  },

  claimBingo: async (
    params: { sessionToken: string; boardNumber: number }
  ): Promise<{ boardId: string, hits: number } | null> => {
    return retryRequest(async () => {
      const payload = { sessionToken: params.sessionToken, boardNumber: params.boardNumber };
      const response = await api.post('/sessions/bingo', payload);
      return response.data as { boardId: string, hits: number };
    })
  },

  leave: async (
    params: { sessionToken: string }
  ): Promise<{ leave?: boolean; canForfeit?: boolean }> => {
    return retryRequest(async () => {
      const response = await api.post('/sessions/leave', { sessionToken: params.sessionToken });
      return response.data as { leave?: boolean; canForfeit?: boolean };
    });
  },

  forfeit: async (
    params: { sessionToken: string }
  ): Promise<any> => {
    return retryRequest(async () => {
      const response = await api.post('/sessions/forfeit', { sessionToken: params.sessionToken });
      return response.data;
    });
  },

  startSession: async (
    sessionId: string
  ): Promise<{ success: boolean; message: string }> => {
    return retryRequest(async () => {
      const response = await api.post(`/sessions/room/${sessionId}/start`);
      return response.data;
    });
  }
};

// SSE utilities (DEPRECATED - Use WebSocket instead)
// These are kept for backward compatibility only
/**
 * @deprecated Use WebSocket events instead (calledNumber, sessionInfo)
 * SSE endpoints are maintained for backward compatibility but WebSocket is preferred
 */
export const connectRoomStream = (sessionId: string): EventSource => {
  const url = `${API_BASE_URL}/sessions/${sessionId}/stream`;
  return new EventSource(url, { withCredentials: true });
};

/**
 * @deprecated Use WebSocket events instead (calledNumber, sessionInfo)
 * SSE endpoints are maintained for backward compatibility but WebSocket is preferred
 */
export const connectSessionInfo = (sessionId: string): EventSource => {
  const url = `${API_BASE_URL}/sessions/${sessionId}/info`;
  return new EventSource(url, { withCredentials: true });
}

// Export the configured axios instance for other API calls
export default api;
