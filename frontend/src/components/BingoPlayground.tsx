import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { BingoCard } from "./ui/bingo-card";
import { Volume2, VolumeX, Trophy, Users, Clock, Goal } from "lucide-react";
import type { BingoCard as BingoCardType } from "../types/bingo";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useRoomStream } from "../hooks/useRoomStream";
import { useUser } from "@/contexts/UserContext";
import { checkCartela } from '@/lib/utils';
import { sessionTokenStorage } from "@/services/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { useGameSession } from "@/contexts/GameSessionContext";

interface BingoPlaygroundProps {
  selectedCards: BingoCardType[];
  roomStake: number;
  roomName: string;
}

export const BingoPlayground: React.FC<BingoPlaygroundProps> = (props) => {
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [gameTime, setGameTime] = useState(0);
  const [isGameActive, setIsGameActive] = useState(true);
  const [bingoWinDialogOpen, setBingoWinDialogOpen] = useState(false);
  const [bingoLoseDialogOpen, setBingoLoseDialogOpen] = useState(false);
  const [leaveAlertOpen, setLeaveAlertOpen] = useState(false);
  const [winInfo, setWinInfo] = useState<{
    boardNumber: number;
    hits: number;
    prizePool: number;
  } | null>(null);
  const [loseInfo, setLoseInfo] = useState<{
    winnerBoardId: number;
  } | null>(null);
  const [gameEnded, setGameEnded] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { refreshBalance } = useUser();

  const { handleLeave, handleForfeit, gameState, sessionInfo, countdown } = useGameSession();

  const selectedCards = gameState.selectedCards.length > 0 ? gameState.selectedCards : props.selectedCards;
  const roomStake = gameState.roomStake || props.roomStake;
  const roomCut = gameState.roomCut || 0;
  const sessionId = gameState.sessionId;
  const gameSession = sessionInfo;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isGameActive) {
      refreshBalance();
    }
  }, [isGameActive]);

  // Intercept device/browser back to leave/forfeit session
  // When in countdown, do NOT block back navigation to allow returning to cartela chooser without leaving
  useEffect(() => {
    const isCountdown = gameSession?.status === "countdown";
    if (isCountdown) {
      // Do not push a new history state or show leave dialog; allow native back
      const noop = () => { };
      window.addEventListener("popstate", noop);
      return () => window.removeEventListener("popstate", noop);
    }

    const pushState = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch (_) { }
    };
    pushState();

    const onPopState = async () => {
      setLeaveAlertOpen(true);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [gameSession?.status]);

  const totalChoosenBoards = gameSession
    ? Object.values(gameSession.assignedBoards ?? {}).reduce(
      (sum, boards) => sum + boards.length,
      0
    )
    : 0;
  const startTime = gameState.startTime || new Date().toISOString();

  // Use SSE stream for called numbers
  const { calledNumbers, count } = useRoomStream(sessionId || null);

  const totalPlayers = gameState.totalPlayers || 0;
  const totalPool = roomStake * totalChoosenBoards;
  const prizePool = totalPool * (1 - (roomCut || 0) / 100);

  const [markedCards, setMarkedCards] =
    useState<BingoCardType[]>(selectedCards);
  const latestBallsRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  const cardItemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [isFixed, setIsFixed] = useState(false);
  const placeholderTop = useMotionValue(0);
  const { handleBingo: bingo, socket } = useGameSession();

  // Listen for bingo result from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleBingoResult = (resp: any) => {
      console.log("Received bingo result:", resp);
      if (!resp) return;

      // Check if the winning board belongs to the current user
      const boardNumber = Number(resp.boardNumber);
      const isMyBoard = markedCards.some(card => card.boardId === boardNumber);

      if (resp.hits > 0) {
        if (isMyBoard) {
          // Current user won
          setWinInfo({
            boardNumber: boardNumber,
            hits: resp.hits,
            prizePool: resp.prize ?? prizePool,
          });
          setBingoWinDialogOpen(true);
        } else {
          // Another player won
          setLoseInfo({ winnerBoardId: boardNumber });
          setBingoLoseDialogOpen(true);
        }
        setIsGameActive(false);
        setGameEnded(true);
      } else {
        // No bingo found (invalid claim)
        setWinInfo(null);
        setBingoWinDialogOpen(false);
        // Optionally show a toast for invalid bingo claim
      }
    };

    const handleLeftRoom = async (resp: any) => {
      console.log("Received left room:", resp);
      if (resp?.leave) {
        setIsLeaving(false);
        sessionTokenStorage.clear(sessionId || "");
        await refreshBalance();
        navigate("/rooms");
        return;
      }
      if (resp?.canForfeit) {
        const sessionToken = sessionTokenStorage.get(sessionId || "");
        if (sessionToken) {
          handleForfeit(sessionToken);
          sessionTokenStorage.clear(sessionId || "");
          await refreshBalance();
          navigate("/rooms");
        }
      }
    };

    socket.on("bingoResult", handleBingoResult);
    socket.on("leftRoom", handleLeftRoom);

    return () => {
      socket.off("bingoResult", handleBingoResult);
      socket.off("leftRoom", handleLeftRoom);
    };
  }, [socket, sessionId, navigate, refreshBalance]);

  useEffect(() => {
    const handleScroll = () => {
      if (!latestBallsRef.current || !placeholderRef.current) return;

      const initialTop = placeholderRef.current.offsetTop + 170;

      if (scrollY > initialTop) {
        setIsFixed(true);
      } else {
        setIsFixed(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mark numbers on cards when called numbers change
  useEffect(() => {
    if (calledNumbers.length > 0) {
      const latestNumber = calledNumbers[calledNumbers.length - 1];
      markNumbersOnCards(latestNumber.number);
    }
  }, [calledNumbers]);

  // Game timer
  useEffect(() => {
    if (!isGameActive || !startTime) return;

    // Calculate initial elapsed time
    const start = new Date(startTime).getTime();
    const updateTimer = () => {
      const now = new Date().getTime();
      const elapsed = Math.floor((now - start) / 1000);
      setGameTime(Math.max(0, elapsed));
    };

    // Update immediately
    updateTimer();

    // Then update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isGameActive, startTime]);

  // Helper function to get color for a number
  const getNumberColor = (number: number): string => {
    if (number <= 15) return "bg-red-500";
    if (number <= 30) return "bg-orange-500";
    if (number <= 45) return "bg-green-500";
    if (number <= 60) return "bg-blue-500";
    return "bg-purple-500";
  };

  const markNumbersOnCards = (calledNumber: number) => {
    setMarkedCards((prev) =>
      prev.map((card) => ({
        ...card,
        numbers: card.numbers.map((column) =>
          column.map((num) => {
            // If the number matches the called number, mark it as negative
            // This preserves the number while indicating it's been called
            if (num === calledNumber) return -calledNumber;
            // If already marked (negative), keep it as is
            if (num < 0) return num;
            // Otherwise keep the original number
            return num;
          })
        ),
      }))
    );
  };

  const hasBingoOnCard = (card: BingoCardType): boolean => {
    const calledNumbersList = calledNumbers.map(cn => cn.number);
    const flatNumbers: number[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        flatNumbers.push(Math.abs(card.numbers[row][col]));
      }
    }
    try {
      const hits = checkCartela(calledNumbersList, flatNumbers);
      return hits > 0;
    } catch {
      return false;
    }
  };

  const scrollToCard = (boardId: number) => {
    const container = cardsScrollRef.current;
    const el = cardItemRefs.current[boardId];
    if (!container || !el) return;
    const left = el.offsetLeft - 16; // small padding
    container.scrollTo({ left, behavior: 'smooth' });
  };

  const handleBingo = async () => {
    if (!sessionId) {
      console.error("No session ID");
      return;
    }

    const sessionToken = sessionTokenStorage.get(sessionId);
    if (!sessionToken) {
      console.error("No session token found");
      return;
    }

    // Find a card that has bingo
    const calledNumbersList = calledNumbers.map(cn => cn.number);
    const cardWithBingo = markedCards.find(card => {
      // Convert 2D card array to flat array (row-major order)
      const flatNumbers: number[] = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          flatNumbers.push(Math.abs(card.numbers[row][col]));
        }
      }

      // Check if this card has bingo
      const hits = checkCartela(calledNumbersList, flatNumbers);
      return hits > 0;
    });

    if (!cardWithBingo) {
      console.error("No card with bingo found!");
      toast.error("No BINGO pattern found on any of your cards!", {
        description: "Keep playing until you complete a pattern.",
        duration: 1500,
      });
      return;
    }

    console.log("Sending bingo claim:", { sessionToken, boardNumber: cardWithBingo.boardId });
    bingo(sessionToken, cardWithBingo.boardId);
  };

  const confirmLeaveSession = async () => {
    try {
      if (!sessionId) return;

      // If game has ended, just navigate to rooms without sending leave request
      if (gameEnded) {
        console.log("Game ended, navigating to rooms");
        sessionTokenStorage.clear(sessionId);
        await refreshBalance();
        navigate("/rooms");
        setLeaveAlertOpen(false);
        return;
      }

      // Game is still active, send leave request
      const sessionToken = sessionTokenStorage.get(sessionId);
      if (!sessionToken) return;

      console.log("Leaving active session:", sessionToken);
      setIsLeaving(true);
      handleLeave(sessionToken);
      // The leftRoom event is handled in the useEffect above
    } catch (err) {
      console.error("Failed to leave session", err);
      // Optionally show a toast
    }
    setLeaveAlertOpen(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen text-foreground bingo-playground">
      {isLeaving && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]">
          <div className="text-gray-300 text-xl font-medium">Leaving room...</div>
        </div>
      )}
      {/* Bingo Win Dialog */}
      <Dialog open={bingoWinDialogOpen} onOpenChange={setBingoWinDialogOpen}>
        <DialogContent className="border-green-500">
          <DialogHeader className="bg-green-500 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
            <DialogTitle className="text-white text-xl">🎉 You Win! 🎉</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 text-center">
            {winInfo && (
              <>
                <div className="text-lg">
                  <span className="text-muted-foreground">Board #</span>
                  <span className="font-bold text-2xl ml-2">{winInfo.boardNumber}</span>
                </div>
                <div className="text-lg">
                  <span className="text-muted-foreground">Hits:</span>
                  <span className="font-bold text-2xl ml-2">{winInfo.hits}</span>
                </div>
                <div className="text-lg">
                  <span className="text-muted-foreground">Prize:</span>
                  <span className="font-bold text-2xl text-green-600 ml-2">${winInfo.prizePool.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                setBingoWinDialogOpen(false);
                if (sessionId) {
                  sessionTokenStorage.clear(sessionId);
                }
                await refreshBalance();
                navigate("/rooms");
              }}
              className="w-full"
            >
              Back to Rooms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bingo Lose Dialog */}
      <Dialog open={bingoLoseDialogOpen} onOpenChange={setBingoLoseDialogOpen}>
        <DialogContent className="border-red-500">
          <DialogHeader className="bg-red-500 -mx-6 -mt-6 px-6 py-4 rounded-t-lg">
            <DialogTitle className="text-white text-xl">😔 You Lose</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            {loseInfo && (
              <div className="text-lg">
                <p className="text-muted-foreground mb-2">Another player won with</p>
                <p>
                  <span className="text-muted-foreground">Board #</span>
                  <span className="font-bold text-2xl ml-2">{loseInfo.winnerBoardId}</span>
                </p>
                <p className="text-muted-foreground mt-4">Better luck next time!</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                setBingoLoseDialogOpen(false);
                if (sessionId) {
                  sessionTokenStorage.clear(sessionId);
                }
                await refreshBalance();
                navigate("/rooms");
              }}
              className="w-full"
            >
              Back to Rooms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave/Forfeit AlertDialog */}
      <AlertDialog open={leaveAlertOpen} onOpenChange={setLeaveAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {gameEnded ? "Leave Game?" : "Leave or Forfeit Game?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {gameEnded
                ? "The game has ended. Do you want to return to the rooms?"
                : "Are you sure you want to leave or forfeit the game? Your progress may be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLeaveAlertOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeaveSession}>
              Yes, leave game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-2 max-w-7xl mx-auto">
        {/* Room Info */}
        <div className="text-center mb-6 room-info">
          <div className="flex items-center justify-center space-x-4 text-sm text-white backdrop-blur-2xl meta">
            <div className="flex items-center space-x-1">
              <Clock className="h-4 w-4" />
              <span>
                {gameEnded
                  ? "Completed"
                  : gameSession?.status === "countdown" && countdown !== null
                    ? `Starts in ${formatTime(countdown)}`
                    : formatTime(gameTime)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{totalPlayers} players</span>
            </div>
            <div className="flex items-center space-x-1">
              <Trophy className="h-4 w-4" />
              <span>${prizePool.toFixed(2)} prize</span>
            </div>
            <div className="flex items-center space-x-1">
              <Goal className="h-4 w-4" />
              <span className="font-medium">{count}/75</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 main-layout">
          <div className="hidden sm:block space-y-4 game-controls">
            {/* Game Stats + Controls */}
            <Card className="space-y-4">
              <CardHeader>
                <CardTitle>Game Stats & Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stats */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Numbers Called:
                    </span>
                    <span className="font-medium">{count}/75</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Your Cards:</span>
                    <span className="font-medium">{selectedCards.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Game Time:</span>
                    <span className="font-medium">{formatTime(gameTime)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setIsSoundOn(!isSoundOn)}
                    variant="outline"
                    className="w-1/2 flex items-center justify-center space-x-2"
                  >
                    {isSoundOn ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4" />
                    )}
                    <span>{isSoundOn ? "Sound On" : "Sound Off"}</span>
                  </Button>

                  {/* Auto-match toggle */}
                  <Button
                    onClick={() => setIsGameActive((prev) => !prev)}
                    variant="outline"
                    className="w-1/2 flex items-center justify-center space-x-2"
                  >
                    <span>
                      {isGameActive ? "Auto Match On" : "Auto Match Off"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Called Numbers Board */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-center">Called Numbers</CardTitle>
              </CardHeader>
              <CardContent className="px-3 py-0 sm:p-6 relative">
                {/* Scrollable Bingo History Grid */}
                <div className="space-y-2 max-h-96 overflow-y-auto scroll-smooth">
                  {["B", "I", "N", "G", "O"].map((letter, colIndex) => {
                    const columnNumbers = Array.from(
                      { length: 15 },
                      (_, i) => colIndex * 15 + i + 1
                    );
                    {
                      /* const _calledInColumn = calledNumbers.filter(cn => cn.letter === letter); */
                    }

                    return (
                      <div key={letter} className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold letter-indicator">
                          {letter}
                        </div>
                        <div className="flex-1 flex justify-between space-x-1 overflow-x-auto">
                          {columnNumbers.map((num) => {
                            const called = calledNumbers.find(
                              (cn) => cn.number === num
                            );
                            return (
                              <div
                                key={num}
                                className={`flex w-full items-center justify-center rounded text-xs font-medium transition-all number-cell ${called
                                  ? `${getNumberColor(num)} text-white`
                                  : "bg-secondary text-foreground"
                                  }`}
                              >
                                {num}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Latest 4 Balls - Fixed Position */}
                <motion.div
                  ref={placeholderRef}
                  style={{ y: placeholderTop }}
                />
                <div
                  ref={latestBallsRef}
                  className={`${isFixed ? "fixed top-20 left-1/2 -translate-1/2 z-50 rounded-xl shadow-lg border-b border-border " : "relative"} flex px-3  backdrop-blur-sm py-4 transition-all duration-300`}
                >
                  <div className="flex items-center justify-center space-x-1 latest-balls">
                    <span className="text-sm font-medium">Latest Balls:</span>
                    <div className="flex items-end">
                      <AnimatePresence initial={false}>
                        {[...calledNumbers]
                          .slice(-4)
                          .reverse()
                          .map((cn) => (
                            <motion.div
                              key={cn.letter + cn.number}
                              layout // enables smooth shifting when items are reordered
                              initial={{ y: -100, opacity: 0, scale: 0.8 }}
                              animate={{ y: 0, opacity: 1, scale: 1 }}
                              exit={{
                                x: 80, // roll out to the right
                                rotate: 360,
                                opacity: 0,
                                scale: 0.9,
                                width: 0,
                                margin: 0,
                                padding: 0,
                              }}
                              transition={{
                                duration: 0.6,
                                bounce: 0.4,
                                type: "spring",
                              }}
                              className={`aspect-square ml-2 w-14 ${getNumberColor(cn.number)} rounded-full flex flex-col items-center justify-center text-white font-bold shadow-lg`}
                            >
                              <span className="text-xs">{cn.letter}</span>
                              <span>{cn.number}</span>
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bingo Cards - Horizontal Scroll */}
        <div className="mt-2">
          {/* Quick access buttons (inline, replaces heading) */}
          <div className="flex justify-center gap-2 px-9 mb-2 backdrop-blur-2xl">
            <span className="text-sm text-muted-foreground self-center">Boards</span>
            {markedCards.map((card) => {
              const bingo = hasBingoOnCard(card);
              return (
                <Button
                  key={`jump-${card.boardId}`}
                  size="sm"
                  variant={bingo ? 'default' : 'outline'}
                  className={bingo ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                  onClick={() => scrollToCard(card.boardId)}
                  title={`Card #${card.boardId}`}
                >
                  #{card.boardId}
                </Button>
              );
            })}
          </div>

          <div className="px-9 overflow-x-auto" ref={cardsScrollRef}>
            <div className="flex gap-4 min-w-full w-max">
              {markedCards.map((card) => (
                <div
                  key={card.boardId}
                  className="shrink-0"
                  ref={(el) => { cardItemRefs.current[card.boardId] = el; }}
                >
                  <BingoCard
                    id={card.boardId}
                    numbers={card.numbers}
                    showBingoStatus={true}
                    className="w-full min-w-[210px]"
                    calledNumbers={calledNumbers.map(cn => cn.number)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleBingo}
          disabled={!isGameActive}
          className={`font-bold text-lg py-4 px-8 rounded-full shadow-lg transition-all duration-200 ${isGameActive
              ? "bg-yellow-300 hover:bg-yellow-600 text-yellow-900 hover:shadow-xl transform hover:scale-105"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
          size="lg"
        >
          {isGameActive ? 'BINGO!' : 'Completed'}
        </Button>
      </div>
    </div>
  );
};
