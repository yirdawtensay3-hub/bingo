import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { GameSessionProvider, useGameSession } from "@/contexts/GameSessionContext";
import { RoomsList } from "@/components/RoomsList";
import { CartelaChooser } from "@/components/CartelaChooser";
import { BingoPlayground } from "@/components/BingoPlayground";
import { DemoLogin } from "@/components/DemoLogin";
import { UserProfile } from "./components/UserProfile";
import { Navbar } from "@/components/Navbar";
import type { BingoCard, Room as UiRoom } from "./types/bingo";
import { useState, useEffect } from "react";
import { roomsAPI, sessionTokenStorage } from "./services/api";

function AppRoutes() {
  const { user, loading, error, authenticateWithTelegram } = useUser();
  const { joinRoom, joinPrivateRoom, socket, setGameState, setSessionInfo } = useGameSession();
  // Show loading state while authenticating
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-lg font-semibold">Authentication Error</p>
            <p className="text-sm text-white mb-4">{error}</p>
            <button
              onClick={authenticateWithTelegram}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show login if no user
  if (!user) return <DemoLogin />;

  const [rooms, setRooms] = useState<UiRoom[]>([]);
  const [myRooms, setMyRooms] = useState<UiRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState<boolean>(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Extract and store room code from URL on first load
  const [startRoomCode, _] = useState<string | null>(() => {
    // First check if we already have it in localStorage
    const stored = localStorage.getItem('pendingRoomCode');
    if (stored) {
      console.log('Retrieved room code from localStorage:', stored);
      return stored;
    }

    // If not in localStorage, extract from URL
    console.log('Extracting room code from URL');
    console.log('Full URL:', window.location.href);

    const urlParams = new URLSearchParams(window.location.search);
    let startParam = urlParams.get('tgWebAppStartParam');

    if (!startParam && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      startParam = hashParams.get('tgWebAppStartParam');
    }

    if (startParam) {
      if (startParam.length == 24) {
        console.log('Found invitation code in URL, storing in localStorage:', startParam);
        localStorage.setItem('inviteCode', startParam);
        return null; // Don't use invitation code as room code
      }
      if (startParam.length > 24) {
        console.log('Found invitation code (>24 chars) in URL, storing in localStorage:', startParam);
        localStorage.setItem('inviteCode', startParam);
        return null; // Don't use invitation code as room code
      }
      console.log('Found room code in URL, storing in localStorage:', startParam);
      localStorage.setItem('pendingRoomCode', startParam);
      return startParam;
    }

    return null;
  });

  // Clean up URL after extracting the parameter
  useEffect(() => {
    if (startRoomCode) {
      console.log('Cleaning URL, room code already extracted:', startRoomCode);
      // Navigate to rooms page if not already there
      if (window.location.pathname !== '/rooms') {
        navigate('/rooms', { replace: true });
      }
      // Clean up URL
      window.history.replaceState({}, document.title, '/rooms');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const loadRooms = async () => {
    try {
      setRoomsLoading(true);
      const [publicRoomsData, myRoomsData] = await Promise.all([
        roomsAPI.getRooms(),
        roomsAPI.getMyRooms()
      ]);

      // Map backend rooms -> UI rooms
      const mapRooms = (data: any[]): UiRoom[] => {
        return (data || []).map((r: any) => ({
          id: r._id || r.id,
          name: r.name,
          stake: r.stake ?? 0,
          players: Array.isArray(r.users) ? r.users.length : (r.players ?? 0),
          maxPlayers: r.maxPlayers ?? 0,
          status:
            r.status === "active"
              ? "playing"
              : r.status === "completed"
                ? "finished"
                : "waiting",
          prize: r.prize ?? 0,
          timeLimit: r.timeLimit ?? 0,
          roomCode: r.roomCode,
        }));
      };

      setRooms(mapRooms(publicRoomsData));
      setMyRooms(mapRooms(myRoomsData));
    } catch (e) {
      console.error("Failed to load rooms", e);
      setRooms([]);
      setMyRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // If user is authenticated and current path is /login, redirect to /rooms
  useEffect(() => {
    if (user && window.location.pathname === "/login") {
      navigate("/rooms", { replace: true });
    }
  }, [user, navigate]);

  // Listen for joinedRoom event from WebSocket
  useEffect(() => {
    if (!socket) {
      console.log("Socket not available in useEffect");
      return;
    }

    console.log("Setting up joinedRoom listener");

    const handleJoinedRoom = (sessionData: any) => {
      console.log("=== Received joinedRoom event ===");
      console.log("Session data:", sessionData);

      // Store session token
      if (sessionData.sessionToken && sessionData.session?._id) {
        console.log("Storing session token for sessionId:", sessionData.session._id);
        console.log("Session token:", sessionData.sessionToken);
        // Note: sessionTokenStorage.set(token, sessionId) - token first!
        sessionTokenStorage.set(sessionData.sessionToken, sessionData.session._id);
      } else {
        console.warn("Missing sessionToken or session._id");
      }

      // Store game state in context
      const newGameState = {
        roomId: sessionData.session?.room?._id,
        roomStake: sessionData.session?.room?.stake || 0,
        roomName: sessionData.session?.room?.name,
        roomCut: sessionData.session?.room?.houseCutPercent || 0,
        roomCreatedBy: sessionData.session?.room?.createdBy,
        roomType: sessionData.session?.room?.type,
        sessionId: sessionData.session?._id,
        bingoBoards: sessionData.session?.room?.bingoBoards || [],
        isInGame: true,
      };

      console.log("Setting game state:", newGameState);
      setGameState(newGameState);

      socket.on("sessionInfo", (data) => {
        setSessionInfo({
          sessionId: data.sessionId,
          count: data.count,
          status: data.status,
          startTime: data.startTime,
          timestamp: data.timestamp,
          assignedBoards: data.assignedBoards,
          winner: data.winner,
        } as any);
        console.log("sessionInfo listener registered");
      });

      setJoiningRoomId(null);
      console.log("Navigating to /cartela-chooser");
      navigate("/cartela-chooser");
      console.log("Navigate called");
    };

    socket.on("joinedRoom", handleJoinedRoom);
    console.log("joinedRoom listener registered");

    socket.on("exception", (data: any) => {
      console.error("Socket exception:", data);
      alert(`Error: ${data.msg || "Unknown error"}`);
      setJoiningRoomId(null);
    })

    return () => {
      console.log("Cleaning up joinedRoom listener");
      socket.off("joinedRoom", handleJoinedRoom);
    };
  }, [socket, navigate, setGameState]);
  const handleJoinRoom = async (
    roomId: string,
    roomStake: number,
    roomName: string
  ) => {
    try {
      setJoiningRoomId(roomId);
      if (!user?.userId) {
        alert("User not authenticated");
        setJoiningRoomId(null);
        return;
      }

      console.log("Joining room:", { roomId, roomStake, roomName, userId: user.userId });

      // Store room info temporarily (will be overwritten by joinedRoom event)
      setGameState({
        roomId,
        roomStake,
        roomName,
      });

      joinRoom(roomId, user.userId);
      // The joinedRoom event is handled in the useEffect above
    } catch (error) {
      console.error("Failed to join room:", error);
      alert("Failed to join room. Please try again.");
      setJoiningRoomId(null);
    }
  };

  const handleCardsSelected = (
    selectedCards: BingoCard[],
    totalPlayers: number,
    startTime?: string
  ) => {
    // Store selected cards and other info in game state
    setGameState({
      selectedCards,
      totalPlayers,
      startTime: startTime || new Date().toISOString(),
    });

    navigate("/playground");
  };
  console.log('App rendering with startRoomCode:', startRoomCode);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/rooms" />} />
        <Route path="/login" element={<Navigate to="/rooms" replace />} />
        <Route
          path="/rooms"
          element={
            <RoomsList
              rooms={rooms}
              myRooms={myRooms}
              userBalance={user.balance || 0}
              onJoinRoom={handleJoinRoom}
              onJoinPrivate={(roomCode) => joinPrivateRoom(roomCode, user.userId ?? "")}
              loading={roomsLoading}
              joiningRoomId={joiningRoomId}
              onRoomDeleted={loadRooms}
              initialRoomCode={startRoomCode || undefined}
            />
          }
        />
        <Route path="/profile" element={<UserProfile />} />
        <Route
          path="/cartela-chooser"
          element={
            <CartelaChooser
              maxCards={3}
              onCardsSelected={handleCardsSelected}
            />
          }
        />
        <Route
          path="/playground"
          element={
            <BingoPlayground selectedCards={[]} roomStake={0} roomName="" />
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <GameSessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </GameSessionProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
