import { useEffect, useState } from 'react';
import { useGameSession } from '@/contexts/GameSessionContext';

export interface CalledNumber {
  roomId: string;
  letter: 'B' | 'I' | 'N' | 'G' | 'O';
  number: number;
  timestamp: string;
}

interface CalledNumberEvent {
  sessionId: string;
  roomId: string;
  number: number;
  count: number;
  timestamp: string;
}

export const useRoomStream = (sessionId: string | null) => {
  const [calledNumbers, setCalledNumbers] = useState<CalledNumber[]>([]);
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useGameSession();

  useEffect(() => {
    if (!socket || !sessionId) return;

    // Set connected when socket is available
    setIsConnected(socket.connected);

    // Listen for called number events
    const handleCalledNumber = (data: CalledNumberEvent) => {
      try {
        // Map number to letter
        const letter = mapNumberToLetter(data.number);
        setCount(data.count);
        setCalledNumbers(prev => [...prev, { 
          roomId: data.roomId,
          number: data.number,
          timestamp: data.timestamp,
          letter 
        }]);
      } catch (err) {
        console.error('Failed to process called number:', err);
      }
    };

    // Listen for stream errors
    const handleStreamError = (errorData: { message: string }) => {
      console.error('Stream error:', errorData);
      setError(errorData.message);
    };

    // Listen for stream completion
    const handleStreamComplete = () => {
      console.log('Stream completed for session:', sessionId);
      setIsConnected(false);
    };

    // Listen for socket connection events
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Register event listeners
    socket.on('calledNumber', handleCalledNumber);
    socket.on('streamError', handleStreamError);
    socket.on('streamComplete', handleStreamComplete);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      // Cleanup event listeners
      socket.off('calledNumber', handleCalledNumber);
      socket.off('streamError', handleStreamError);
      socket.off('streamComplete', handleStreamComplete);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, sessionId]);

  const disconnect = () => {
    // Socket disconnection is handled by GameSessionContext
    setIsConnected(false);
  };

  const mapNumberToLetter = (n: number): 'B' | 'I' | 'N' | 'G' | 'O' => {
    if (n >= 1 && n <= 15) return 'B';
    if (n >= 16 && n <= 30) return 'I';
    if (n >= 31 && n <= 45) return 'N';
    if (n >= 46 && n <= 60) return 'G';
    return 'O'; // 61-75
  }

  return {
    calledNumbers,
    count,
    isConnected,
    error,
    disconnect,
  };
};
