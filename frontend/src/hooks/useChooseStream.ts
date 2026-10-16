import { useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { API_BASE_URL } from "@/services/api";

export default function useChooseStream() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Create socket connection only once
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
      });

      socketRef.current.on("disconnect", (reason) => {
        console.log("Socket disconnected:", reason);
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log("Disconnecting socket");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const handleJoinRoom = (roomID: string, userID: string) => {
    console.log("Emitting joinRoom:", { roomID, userID });
    socketRef.current?.emit("joinRoom", { roomID, userID });
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

  return {
    handleJoinRoom,
    handleLeave,
    handleForfeit,
    handleChooseBoard,
    handleBingo,
    socket: socketRef.current,
  };
}
