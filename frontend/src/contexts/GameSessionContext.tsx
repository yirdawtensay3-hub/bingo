import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import io, { Socket } from "socket.io-client";
import { API_BASE_URL } from "@/services/api";
import type { BingoCard } from "@/types/bingo";

interface SessionInfo {
  sessionId: string;
  count: number;
  status: string; // waiting | active | countdown | completed
  startTime?: string;
  timestamp: string;
  assignedBoards?: Record<string, number[]>;
  winner?: { boardNumber: number };
}

interface GameSessionState {
  roomId: string | null;
  roomName: string | null;
  roomStake: number;
  roomCut: number;
  roomCreatedBy?: string | null;
  roomType?: 'public' | 'private';
  sessionId: string | null;
  selectedCards: BingoCard[];
  totalPlayers: number;
  startTime: string | null;
  bingoBoards: Array<{
    _id: string;
    boardId: number;
    numbers: number[];
  }>;
  isInGame: boolean;
}

interface GameSessionContextType {
  socket: Socket | null;
  gameState: GameSessionState;

  // Session info state
  sessionInfo: SessionInfo | null;
  isConnected: boolean;
  infoError: string | null;
  countdown: number | null;
  setSessionInfo: (info: SessionInfo | null) => void;

  // Socket actions
  joinRoom: (roomID: string, userID: string) => void;
  joinPrivateRoom: (roomCode: string, userID: string) => void;
  handleLeave: (sessionToken: string) => void;
  handleForfeit: (sessionToken: string) => void;
  handleChooseBoard: (sessionToken: string, boardId: string) => void;
  handleBingo: (sessionToken: string, boardNumber: number) => void;

  // State management
  setGameState: (state: Partial<GameSessionState>) => void;
  resetGameState: () => void;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

const initialGameState: GameSessionState = {
  roomId: null,
  roomName: null,
  roomStake: 0,
  roomCut: 0,
  roomCreatedBy: null,
  roomType: undefined,
  sessionId: null,
  selectedCards: [],
  totalPlayers: 0,
  startTime: null,
  bingoBoards: [],
  isInGame: false,
};

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);

export const GameSessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameStateInternal] = useState<GameSessionState>(initialGameState);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const connectSocket = () => {
    if (!socketRef.current) {
      console.log("Creating new socket connection to:", API_BASE_URL);
      socketRef.current = io(API_BASE_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socketRef.current.on("connect", () => {
        console.log("Socket connected:", socketRef.current?.id);
        setIsConnected(true);
        setInfoError(null);
      });

      socketRef.current.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
        setIsConnected(false);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      console.log("Disconnecting socket");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Connect socket on mount and cleanup on unmount
  useEffect(() => {
    console.log("GameSessionProvider mounted - connecting socket");
    connectSocket();
    
    return () => {
      disconnectSocket();
    };
  }, []);

  // Register session info listeners when socket/sessionId available
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const handleSessionInfo = (data: SessionInfo) => {
      try {
        setSessionInfo(data);
      } catch (error) {
        console.error("Failed to process session info:", error);
      }
    };

    const handleInfoError = (errorData: { message: string }) => {
      console.error('Info error:', errorData);
      setInfoError(errorData.message);
    };

    const handleInfoComplete = () => {
      console.log('Info stream completed for session:', gameState.sessionId);
      setIsConnected(false);
    };

    s.on('sessionInfo', handleSessionInfo);
    s.on('infoError', handleInfoError);
    s.on('infoComplete', handleInfoComplete);

    return () => {
      s.off('sessionInfo', handleSessionInfo);
      s.off('infoError', handleInfoError);
      s.off('infoComplete', handleInfoComplete);
    };
  }, [socketRef.current]);

  // Countdown calculation based on sessionInfo
  useEffect(() => {
    if (sessionInfo?.status === 'countdown' && sessionInfo.startTime) {
      const startTime = new Date(sessionInfo.startTime).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, startTime - now);
      setCountdown(Math.ceil(diff / 1000));

      const interval = setInterval(() => {
        const nowTick = new Date().getTime();
        const diffTick = Math.max(0, startTime - nowTick);
        const newCountdown = Math.ceil(diffTick / 1000);
        setCountdown(newCountdown);
        if (newCountdown <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCountdown(null);
    }
  }, [sessionInfo]);

  const joinRoom = (roomID: string, userID: string) => {
    console.log("Emitting joinRoom:", { roomID, userID });
    socketRef.current?.emit("joinRoom", { roomID, userID });
  };

  const joinPrivateRoom = (roomCode: string, userID: string) => {
    console.log("Emitting joinPrivateRoom:", { roomCode, userID });
    socketRef.current?.emit("joinPrivateRoom", { roomCode, userID });
  };

  const handleLeave = (sessionToken: string) => {
    console.log("Emitting leaveRoom:", { sessionToken });
    socketRef.current?.emit("leaveRoom", sessionToken);
  };

  const handleForfeit = (sessionToken: string) => {
    console.log("Emitting forfeit:", { sessionToken });
    socketRef.current?.emit("forfeit", sessionToken);
  };

  const handleChooseBoard = (sessionToken: string, boardId: string) => {
    console.log("Emitting chooseBoard:", { sessionToken, boardId });
    socketRef.current?.emit("chooseBoard", { sessionToken, boardId });
  };

  const handleBingo = (sessionToken: string, boardNumber: number) => {
    console.log("Emitting bingo:", { sessionToken, boardNumber });
    socketRef.current?.emit("bingo", { sessionToken, boardNumber });
  };

  const setGameState = (state: Partial<GameSessionState>) => {
    setGameStateInternal((prev) => ({ ...prev, ...state }));
  };

  const resetGameState = () => {
    setGameStateInternal(initialGameState);
    disconnectSocket();
  };

  const value: GameSessionContextType = {
    socket: socketRef.current,
    gameState,
    sessionInfo,
    isConnected,
    infoError,
    countdown,
    setSessionInfo,
    joinRoom,
    joinPrivateRoom,
    handleLeave,
    handleForfeit,
    handleChooseBoard,
    handleBingo,
    setGameState,
    resetGameState,
    connectSocket,
    disconnectSocket,
  };

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
};

export const useGameSession = (): GameSessionContextType => {
  const context = useContext(GameSessionContext);
  if (context === undefined) {
    throw new Error("useGameSession must be used within a GameSessionProvider");
  }
  return context;
};

// Backward compatibility - export as useSocket for existing code
export const useSocket = useGameSession;
