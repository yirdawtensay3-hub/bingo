import { useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/contexts/GameSessionContext';
import type { Room } from '@/types/bingo';

export const usePublicRoomsLive = () => {
  const [liveRooms, setLiveRooms] = useState<Room[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { socket } = useGameSession();

  useEffect(() => {
    if (!socket) return;

    // Set connected when socket is available
    setIsConnected(socket.connected);

    // Listen for initial data (sent automatically on connection)
    const handlePublicRoomsData = (data: any[]) => {
      console.log('Received initial public rooms data:', data);
      const mappedRooms = data.map(mapBackendRoomToFrontend);
      setLiveRooms(mappedRooms);
      initializeCountdowns(mappedRooms);
    };

    // Listen for live updates
    const handlePublicRoomsUpdate = (data: any[]) => {
      console.log('Received public rooms update:', data);
      const mappedRooms = data.map(mapBackendRoomToFrontend);
      setLiveRooms(mappedRooms);
      initializeCountdowns(mappedRooms);
    };

    // Handle connection status
    const handleConnect = () => {
      console.log('Socket connected for public rooms');
      setIsConnected(true);
      // No need to emit subscribe - backend auto-subscribes on connection
    };

    const handleDisconnect = () => {
      console.log('Socket disconnected for public rooms');
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('publicRoomsData', handlePublicRoomsData);
    socket.on('publicRoomsUpdate', handlePublicRoomsUpdate);

    // Cleanup
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('publicRoomsData', handlePublicRoomsData);
      socket.off('publicRoomsUpdate', handlePublicRoomsUpdate);
      // No need to unsubscribe - handled by backend on disconnect
    };
  }, [socket]);

  const initializeCountdowns = (rooms: Room[]) => {
    setCountdowns((prev) => {
      const updated = { ...prev };
      const now = Date.now();

      for (const room of rooms) {
        const startedAt = room.latestSession?.startedAt
          ? new Date(room.latestSession.startedAt).getTime()
          : null;

        const totalWaitMs = (room.timeLimit || 0) * 60 * 1000;

        if (startedAt && room.latestSession?.enhancedStatus === 'countdown') {
          const elapsedMs = now - startedAt;
          const remainingMs = Math.max(totalWaitMs - elapsedMs, 0);
          updated[room.id] = Math.floor(remainingMs / 1000);
        }
      }

      for (const roomId of Object.keys(prev)) {
        const currentRoom = rooms.find((r) => r.id === roomId);
        const status = currentRoom?.latestSession?.enhancedStatus;
        if (status === 'waiting' || status === 'active') {
          delete updated[roomId];
        }
      }

      return updated;
    });
  };

  useEffect(() => {
    // If there are no active countdowns, no need to run the interval
    if (Object.keys(countdowns).length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Clear any previous interval before starting a new one
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setCountdowns((prev) => {
        const updated: Record<string, number> = {};

        for (const [roomId, seconds] of Object.entries(prev)) {
          const newValue = Math.max(seconds - 1, 0);
          if (newValue > 0) {
            updated[roomId] = newValue; // keep active countdowns
          }
          // if newValue === 0 → remove it automatically
        }

        return updated;
      });
    }, 1000);

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [countdowns]);
  return { liveRooms, isConnected, countdowns };
};

// Helper function to map backend room data to frontend format
function mapBackendRoomToFrontend(backendRoom: any): Room {
  const session = backendRoom.latestSession;

  // Map room status from backend enum to frontend format
  const mapRoomStatus = (status: string): 'waiting' | 'playing' | 'finished' | 'countdown' => {
    switch (status) {
      case 'waiting':
      case 'active':
        return 'waiting';
      case 'countdown':
        return 'countdown';
      case 'finished':
      case 'completed':
        return 'waiting';
      default:
        return 'waiting';
    }
  };

  // Determine the display status based on session if available
  const getDisplayStatus = (): 'waiting' | 'playing' | 'finished' | 'countdown' => {
    if (session?.enhancedStatus) {
      // Use enhanced status from session
      switch (session.enhancedStatus) {
        case 'waiting':
        case 'finished':
        case 'filling':
        case 'active':
          return 'waiting';
        case 'countdown':
          return 'countdown';
        default:
          return mapRoomStatus(backendRoom.status);
      }
    }
    // Fallback to room status
    return mapRoomStatus(backendRoom.status);
  };

  return {
    id: backendRoom._id,
    name: backendRoom.name,
    stake: backendRoom.stake,
    players: session?.playerCount || 0,
    maxPlayers: backendRoom.maxPlayers || 100,
    status: getDisplayStatus(),
    prize: session?.stakepool || 0,
    timeLimit: Math.floor((backendRoom.waitingTime || 5000) / 1000 / 60), // Convert ms to minutes
    roomCode: backendRoom.roomCode,
    latestSession: session || null,
  };
}
