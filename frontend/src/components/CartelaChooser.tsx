import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BingoCard } from "./ui/bingo-card";
import { X, Trophy, Users, Clock, Play } from "lucide-react";
import type { BingoCard as BingoCardType } from "../types/bingo";
import { useNavigate } from "react-router-dom";
import { sessionTokenStorage, sessionsAPI } from "@/services/api";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { useGameSession } from "@/contexts/GameSessionContext";

interface CartelaChooserProps {
  onCardsSelected: (
    selectedCards: BingoCardType[],
    totalPlayers: number,
    startTime?: string
  ) => void;
  maxCards: number;
}

export const CartelaChooser: React.FC<CartelaChooserProps> = ({
  onCardsSelected,
  maxCards,
}) => {
  const { user, refreshBalance } = useUser();
  const navigate = useNavigate();
  const { gameState, handleChooseBoard, handleLeave, handleForfeit, socket, sessionInfo, countdown } = useGameSession();

  const { roomStake, sessionId, bingoBoards: stateBingoBoards, roomCut, roomCreatedBy, roomType } = gameState;
  const gameSession = sessionInfo;
  const totalPlayers = gameSession?.count || 0;
  const totalChoosenBoards = gameSession
    ? Object.values(gameSession.assignedBoards ?? {}).reduce(
      (sum, boards) => sum + boards.length,
      0
    )
    : 0;

  const [selectedCards, setSelectedCards] = useState<BingoCardType[]>([]);
  const [gameTime, setGameTime] = useState(0);
  const [selectingIds, setSelectingIds] = useState<number[]>([]);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const hasNavigated = useRef(false);

  // Transform backend boards (25 numbers) to BingoCardType format (5 columns, free center)
  const boardToCardNumbers = (nums: number[]): number[][] => {
    // Ensure 25 numbers; if more, slice; if less, pad zeros
    const flat = nums.slice(0, 25);
    while (flat.length < 25) flat.push(0);

    // Backend sends numbers top-to-bottom per column (B,I,N,G,O), 5 numbers each.
    // So we can slice directly into 5 columns of 5.
    const cols: number[][] = [];
    for (let c = 0; c < 5; c++) {
      const start = c * 5;
      cols[c] = flat.slice(start, start + 5);
    }
    // Set center to free
    cols[2][2] = 0;
    return cols;
  };

  const buildCardsFromBoards = (
    boards: Array<{ _id: string; boardId: number; numbers: number[] }>
  ): BingoCardType[] => {
    return boards.map((b) => ({
      id: b._id,
      boardId: b.boardId,
      numbers: boardToCardNumbers(b.numbers),
      selected: false,
    }));
  };

  const [bingoCards] = useState<BingoCardType[] | undefined>(() => {
    if (stateBingoBoards && stateBingoBoards.length > 0) {
      return buildCardsFromBoards(stateBingoBoards);
    }
  });

  const getBoardbyId = (boardId: number): BingoCardType | null => {
    const card = bingoCards?.find((c) => c.boardId === boardId);
    if (!card) return null; // fallback if not found
    return card;
  };

  // Listen for boardChosen event from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleBoardChosen = (resp: any) => {
      console.log("Received boardChosen:", resp);
      if (resp?.removed) {
        const removedBoardId = resp.boardId;
        setSelectedCards((prev) =>
          prev.filter((c) => c.boardId !== removedBoardId)
        );
        const card = bingoCards?.find((c) => c.boardId === removedBoardId);
        if (card) card.selected = false;
      } else if (resp?.added) {
        const addedBoardId = resp.boardId;
        const card = bingoCards?.find((c) => c.boardId === addedBoardId);
        if (card) {
          setSelectedCards((prev) => [...prev, card]);
          card.selected = true;
        }
      }
    };

    socket.on("boardChosen", handleBoardChosen);

    return () => {
      socket.off("boardChosen", handleBoardChosen);
    };
  }, [socket, bingoCards]);

  // Listen for leftRoom event from WebSocket
  useEffect(() => {
    if (!socket) return;

    const handleLeftRoom = async (resp: any) => {
      console.log("Received leftRoom:", resp);
      if (resp?.leave) {
        setIsLeaving(false);
        sessionTokenStorage.clear(sessionId || "");
        await refreshBalance();
        navigate("/rooms");
        return;
      }

      if (resp?.canForfeit) {
        const confirmLeave = window.confirm(
          "The game has started. Do you want to forfeit and leave?"
        );
        if (confirmLeave) {
          const sessionToken = sessionTokenStorage.get(sessionId || "");
          if (sessionToken) {
            handleForfeit(sessionToken);
            sessionTokenStorage.clear(sessionId || "");
            await refreshBalance();
            navigate("/rooms");
          }
        } else {
          setIsLeaving(false);
          try {
            window.history.pushState(null, "", window.location.href);
          } catch (_) { }
        }
      }
    };

    socket.on("leftRoom", handleLeftRoom);

    return () => {
      socket.off("leftRoom", handleLeftRoom);
    };
  }, [socket, sessionId, navigate, refreshBalance, handleForfeit]);

  useEffect(() => {
    if (gameSession?.status !== "active" || !gameSession.startTime) {
      setGameTime(0);
      console.log("Game not active or start time missing");
      return;
    }

    console.log("Game started at:", gameSession.startTime);

    const startTime = new Date(gameSession.startTime).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const elapsed = Math.floor((now - startTime) / 1000);
      setGameTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameSession]);

  useEffect(() => {
    if (
      gameSession?.status === "active" &&
      !hasNavigated.current &&
      (gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length > 0
    ) {
      const sCards: BingoCardType[] = (gameSession?.assignedBoards?.[user?.userId || ''] ?? []).map(boardId => {
        const board = getBoardbyId(boardId);
        if (board != null) {
          return {
            ...board,
            selected: true
          };
        }
        return {} as BingoCardType;
      })
      hasNavigated.current = true;
      onCardsSelected(sCards, totalPlayers, gameSession.startTime);
    }
  }, [
    gameSession?.status,
    selectedCards,
    totalPlayers,
    onCardsSelected,
    gameSession?.startTime,
  ]);

  useEffect(() => {
    refreshBalance();
  }, []);

  // Intercept device/browser back to leave/forfeit session
  useEffect(() => {
    // Push a new state so the first back triggers our handler
    const pushState = () => {
      try {
        window.history.pushState(null, "", window.location.href);
      } catch (_) { }
    };
    pushState();

    const onPopState = async () => {
      await handleLeaveSession();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const totalPool = roomStake * totalChoosenBoards;
  const prizePool = totalPool * (1 - (roomCut || 0) / 100);

  // Check if user can start the session (room owner for private sessions in waiting status)
  const canStartSession =
    roomType === 'private' &&
    user?.userId === roomCreatedBy &&
    gameSession?.status === 'waiting' &&
    sessionId;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleCardSelection = async (cardId: number) => {
    if (!bingoCards) {
      toast.error("Bingo cards not loaded");
      return;
    }

    const card = bingoCards.find((c) => c.boardId === cardId);
    if (!card) return;

    // Prevent actions while in-flight
    if (selectingIds.includes(cardId)) return;

    // Check if card is currently selected by using gameSession.assignedBoards (source of truth)
    const currentUserBoards = gameSession?.assignedBoards?.[user?.userId || ""] ?? [];
    const isCurrentlySelected = currentUserBoards.includes(cardId);

    try {
      setSelectingIds((prev) => [...prev, cardId]);

      if (isCurrentlySelected) {
        // Deselecting a card - always allow this
        if (sessionId) {
          const sessionToken = sessionTokenStorage.get(sessionId);
          if (!sessionToken) {
            console.error("No session token found for sessionId:", sessionId);
            setSelectingIds((prev) => prev.filter((id) => id !== cardId));
            return;
          }
          console.log("Removing board - sessionToken:", sessionToken, "boardId:", card.id);
          handleChooseBoard(sessionToken, card.id!);
          // The boardChosen event is handled in the useEffect above
        }
        return;
      }

      // Only check max cards limit when SELECTING a new card
      if ((gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length >= maxCards) {
        toast.error(`You can only select up to ${maxCards} cards`);
        setSelectingIds((prev) => prev.filter((id) => id !== cardId));
        return;
      }

      if (user == null) {
        alert("User not authenticated")
        return;
      }

      const otherUsersBoards = Object.entries(gameSession?.assignedBoards ?? {})
        .filter(([userId]) => userId !== user.userId) // exclude current user
        .map(([_, boards]) => boards)
        .flat();

      if (otherUsersBoards.includes(cardId)) {
        alert("This board is already taken by another player.");
        return;
      }
      // if (gameSession?.assignedBoards?.includes(cardId)) {
      //   alert("This board is already taken by another player.");
      //   return;
      // }
      if (sessionId) {
        const sessionToken = sessionTokenStorage.get(sessionId);
        if (!sessionToken) {
          console.error("No session token found for sessionId:", sessionId);
          return;
        }

        console.log("Adding board - sessionToken:", sessionToken, "boardId:", card.id);
        handleChooseBoard(sessionToken, card.id!);
        // The boardChosen event is handled in the useEffect above
      } else {
        // Fallback to local selection if identifiers are missing
        setSelectedCards((prev) => [...prev, card]);
        card.selected = true;
      }
    } catch (err) {
      console.error("Failed to update board selection", err);
      alert("Failed to update selection. Please try again.");
    } finally {
      setSelectingIds((prev) => prev.filter((id) => id !== cardId));
    }
  };

  const removeCard = async (cardId: number) => {
    if (!bingoCards) {
      toast.error("Bingo cards not loaded");
      return;
    }
    await toggleCardSelection(cardId);
  };

  const handleContinue = () => {
    if ((gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length > 0) {
      const sCards: BingoCardType[] = (gameSession?.assignedBoards?.[user?.userId || ''] ?? []).map(boardId => {
        const board = getBoardbyId(boardId);
        if (board != null) {
          return {
            ...board,
            selected: true
          };
        }
        return {} as BingoCardType;
      })
      refreshBalance();
      onCardsSelected(sCards, totalPlayers, gameSession?.startTime);
    }
  };

  const handleClearBoards = async () => {
    const currentUserBoards = gameSession?.assignedBoards?.[user?.userId || ""] ?? [];
    for (const boardId of currentUserBoards) {
      await toggleCardSelection(boardId);
    }
  };

  const handleStartSession = async () => {
    if (!sessionId) {
      toast.error("No session ID available");
      return;
    }

    try {
      setIsStarting(true);
      const response = await sessionsAPI.startSession(sessionId);

      if (response.success) {
        toast.success(response.message || "Game session starting...");
        // The session will start automatically via WebSocket events
      } else {
        toast.error(response.message || "Failed to start session");
      }
    } catch (error: any) {
      console.error("Failed to start session:", error);
      toast.error(error.response?.data?.message || "Failed to start session");
    } finally {
      setIsStarting(false);
    }
  };

  const handleLeaveSession = async () => {
    try {
      if (!sessionId) return;
      const sessionToken = sessionTokenStorage.get(sessionId);
      if (!sessionToken) return;

      console.log("Leaving session:", sessionToken);
      setIsLeaving(true);
      handleLeave(sessionToken);
      // The leftRoom event is handled in the useEffect above
    } catch (err) {
      console.error("Failed to leave session", err);
      alert("Failed to leave session. Please try again.");
    }
  };

  return (
    <div className="min-h-screen">
      {isLeaving && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]">
          <div className="text-gray-300 text-xl font-medium">Leaving room...</div>
        </div>
      )}

      {isStarting && (
        <div className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]">
          <div className="text-gray-300 text-xl font-medium">Starting session...</div>
        </div>
      )}
      {/* Room Info */}
      <div className="text-center room-info">
        <div className="flex items-center justify-center space-x-4 text-sm text-white backdrop-blur-2xl meta">
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>
              {gameSession?.status === "waiting"
                ? "Waiting for players..."
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
        </div>
      </div>
      <div className="max-w-7xl sm:w-full mx-auto px-3 sm:flex sm:px-6 py-2">
        {/* Fixed Card Numbers Grid */}
        <Card className="mb-8">
          <CardHeader className="p-0 px-3 pt-2">
            <CardTitle className="text-center text-lg">
              Available Card Numbers (
              {100 - (Object.values(gameSession?.assignedBoards ?? {}).reduce((sum, boards) => sum + boards.length, 0)
                || selectedCards.length)}
              )
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-3 sm:p-6">
            <div className="grid grid-cols-10 gap-2">
              {Array.from({ length: 100 }, (_, i) => i + 1).map(
                (cardNumber) => {
                  const currentUserBoards = gameSession?.assignedBoards?.[user?.userId || ""] ?? [];

                  const isSelected = currentUserBoards.includes(cardNumber);

                  const otherUsersBoards = Object.entries(gameSession?.assignedBoards ?? {})
                    .filter(([userId]) => userId !== user?.userId || "")
                    .map(([_, boards]) => boards)
                    .flat();

                  const isAssigned = otherUsersBoards.includes(cardNumber);

                  const isTakenByOthers = isAssigned && !isSelected;

                  // Only disable if:
                  // 1. Card is being processed (in selectingIds)
                  // 2. User is at max cards AND trying to select a NEW card (not deselect)
                  const isDisabled =
                    selectingIds.includes(cardNumber) ||
                    (!isSelected && currentUserBoards.length >= maxCards);


                  return (
                    <button
                      key={cardNumber}
                      onClick={() => toggleCardSelection(cardNumber)}
                      disabled={isDisabled || isTakenByOthers}
                      className={`
                      h-8 w-8 sm:h-12 sm:w-12 rounded-lg border-2 font-semibold text-sm transition-all duration-200
                      ${isSelected
                          ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105"
                          : isTakenByOthers
                            ? "bg-red-900 border-muted text-muted-foreground cursor-not-allowed"
                            : isDisabled
                              ? "bg-muted border-muted text-muted-foreground cursor-not-allowed"
                              : "bg-secondary border-border text-foreground hover:border-primary hover:bg-primary/10 hover:scale-105"
                        }
                    `}
                      title={
                        isTakenByOthers ? "Taken by another player" : undefined
                      }
                    >
                      {cardNumber}
                    </button>
                  );
                }
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Cards Display */}
        {(gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length > 0 && (
          <Card className="mb-6 sm:w-1/2 ml-3">
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Selected Cards ({(gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length})
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearBoards}
                  className="flex items-center space-x-2"
                >
                  <X className="h-4 w-4" />
                  <span className="text-sm">Clear All</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="px-0 sm:px-0 p-3 overflow-x-auto">
                <div className="flex gap-4 min-w-full w-max px-7 sm:px-0">
                  {user && (gameSession?.assignedBoards?.[user.userId || ''] ?? []).map((boardId) => {
                    const board = getBoardbyId(boardId);
                    const boardNumbers = board?.numbers ?? [];

                    return (
                      <div key={boardId} className="shrink-0">
                        <BingoCard
                          id={boardId}
                          numbers={boardNumbers}
                          showBingoStatus={false}
                          showRemoveButton={true}
                          onRemove={() => removeCard(boardId)}
                          className="w-full min-w-[210px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floating Action Buttons */}
        <div className="fixed bottom-10 right-6 flex flex-col gap-3 z-100">
          {/* Start Session Button (only for room owners in private sessions) */}
          {canStartSession && (
            <Button
              onClick={handleStartSession}
              disabled={isStarting}
              size="lg"
              className="px-4 py-3 shadow-lg bg-green-600 hover:bg-green-700"
            >
              {isStarting ? (
                <>
                  <div className="mr-2 inline-block h-4 w-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Session
                </>
              )}
            </Button>
          )}

          {/* Continue Button (when user has selected cards) */}
          {(gameSession?.assignedBoards?.[user?.userId || ''] ?? []).length > 0 && (
            <Button
              onClick={handleContinue}
              size="lg"
              className="px-4 py-3 shadow-lg"
            >
              continue({(gameSession?.assignedBoards?.[user?.userId || ""] ?? []).length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
