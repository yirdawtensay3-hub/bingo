import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Plus, RefreshCcw, CircleEllipsis, Copy, Share2, Trash2, Edit } from 'lucide-react';
import type { Room } from '@/types/bingo';
import { CreateRoomDialog } from './CreateRoomDialog';
import { JoinRoomDialog } from './JoinRoomDialog';
import { EditRoomDialog } from './EditRoomDialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { roomsAPI } from '@/services/api';
import { usePublicRoomsLive } from '@/hooks/usePublicRoomsLive';

interface RoomsListProps {
  rooms: Room[];
  myRooms: Room[];
  onJoinRoom: (roomId: string, roomStake: number, roomName: string) => void;
  onJoinPrivate?: (roomCode: string) => void;
  userBalance: number;
  loading?: boolean;
  joiningRoomId?: string | null;
  onRoomDeleted?: () => void;
  initialRoomCode?: string;
}

export const RoomsList: React.FC<RoomsListProps> = ({
  rooms,
  myRooms,
  onJoinRoom,
  onJoinPrivate,
  loading = false,
  joiningRoomId = null,
  onRoomDeleted,
  initialRoomCode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stakeFilter, setStakeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Use live WebSocket data for public rooms
  const { liveRooms, isConnected, countdowns } = usePublicRoomsLive();

  // Merge live data with static rooms data (prefer live data if available)
  const mergedRooms = useMemo(() => {
    return rooms;
  }, [liveRooms, rooms]);

  const liveStatus = useMemo(() => {
    return liveRooms.map(room => {
      if (!room.latestSession) {
        return { status: 'waiting', countdowns: undefined };
      }

      if (room.latestSession.status === 'finished') {
        return { status: 'waiting' };
      }

      if (room.latestSession.status === 'countdown') {
        return { status: `$${room.prize ?? 0}`, countdowns: countdowns[room.id] };
      }

      if (room.latestSession.playerCount > 0) {
        return { status: `${room.latestSession.playerCount} player(s) $${room.prize ?? 0}` };
      }

      if (room.latestSession.status === 'waiting') {
        return { status: 'waiting' };
      }
    }
    );
  }, [liveRooms, countdowns]);

  console.log('RoomsList received initialRoomCode:', initialRoomCode);
  console.log('WebSocket connected:', isConnected);
  console.log('Live rooms count:', liveRooms.length);

  const handleCopyCode = async (roomCode: string) => {
    try {
      await navigator.clipboard.writeText(roomCode);
      alert(`Room code ${roomCode} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy room code');
    }
  };

  const handleShareToTelegram = (roomCode: string, roomName: string) => {
    try {
      // Create the bot link with room code as start parameter
      const botLink = `https://t.me/goatbingobot/app?startapp=${roomCode}`;
      const shareText = `🎮 Join my Bingo room "${roomName}"!\n\n${botLink}`;

      // Check if Telegram WebApp is available
      if (window.Telegram?.WebApp) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareText)}`;
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        // Fallback for non-Telegram environments
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareText)}`;
        window.open(shareUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to share:', err);
      alert('Failed to share to Telegram');
    }
  };

  const handleDeleteRoom = async (roomId: string, roomName: string) => {
    if (!confirm(`Are you sure you want to delete the room "${roomName}"?`)) {
      return;
    }

    try {
      setDeletingRoomId(roomId);
      await roomsAPI.deleteRoom(roomId);
      alert('Room deleted successfully!');
      if (onRoomDeleted) {
        onRoomDeleted();
      }
    } catch (err: any) {
      console.error('Failed to delete room:', err);
      alert(err.response?.data?.message || 'Failed to delete room');
    } finally {
      setDeletingRoomId(null);
    }
  };

  // Filter public rooms based on search and filters
  const filteredRooms = useMemo(() => {
    return mergedRooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStake = stakeFilter === 'all' ||
        (stakeFilter === 'low' && room.stake <= 10) ||
        (stakeFilter === 'medium' && room.stake > 10 && room.stake <= 50) ||
        (stakeFilter === 'high' && room.stake > 50);

      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;

      return matchesSearch && matchesStake && matchesStatus;
    });
  }, [mergedRooms, searchTerm, stakeFilter, statusFilter]);

  // Filter my rooms based on search and filters
  const filteredMyRooms = useMemo(() => {
    return myRooms.filter(room => {
      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStake = stakeFilter === 'all' ||
        (stakeFilter === 'low' && room.stake <= 10) ||
        (stakeFilter === 'medium' && room.stake > 10 && room.stake <= 50) ||
        (stakeFilter === 'high' && room.stake > 50);

      const matchesStatus = statusFilter === 'all' || room.status === statusFilter;

      return matchesSearch && matchesStake && matchesStatus;
    });
  }, [myRooms, searchTerm, stakeFilter, statusFilter]);

  const renderRoomsList = (roomsList: Room[], showOptions: boolean = false, liveStatus: ({ status: string, countdowns?: number } | undefined)[]) => {
    if (roomsList.length > 0) {
      return (
        <div className="flex flex-col space-x-4 pb-4">
          {roomsList.map((room, idx) => {
            const isJoining = joiningRoomId === room.id;
            const isDeleting = deletingRoomId === room.id;
            return (
              <div
                key={room.id}
                className="flex-shrink-0 border border-border rounded-lg p-4 mb-2 bg-card flex flex-row w-full items-center justify-between"
              >
                <div className="flex flex-col">
                  <p className="text-base font-medium mb-1">{room.name}</p>
                  <p className="text-sm text-muted-foreground">Stake: ${room.stake}</p>
                </div>
                {liveStatus ? (
                  liveStatus[idx]?.countdowns ? (
                    <p className="text-sm text-muted-foreground">{liveStatus[idx]?.countdowns} sec <span className="text-green-600">{liveStatus[idx]?.status}</span> </p>
                  ) : (
                    <p className="text-sm text-muted-foreground capitalize">{liveStatus[idx]?.status ?? "waiting"}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground capitalize">{room.status}</p>
                )}
                <div className="flex items-center gap-2">
                  {showOptions && room.roomCode ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          disabled={isDeleting}
                        >
                          <CircleEllipsis className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyCode(room.roomCode!)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Code
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareToTelegram(room.roomCode!, room.name)}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share to Telegram
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <EditRoomDialog
                          room={room}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Room
                            </DropdownMenuItem>
                          }
                          onRoomUpdated={onRoomDeleted}
                        />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => handleDeleteRoom(room.id, room.name)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {isDeleting ? 'Deleting...' : 'Delete Room'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button
                    size="sm"
                    disabled={isJoining || isDeleting}
                    onClick={() => onJoinRoom(room.id, room.stake, room.name)}
                    className="flex items-center"
                  >
                    {isJoining ? (
                      <span className="mr-2 inline-block h-4 w-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Join'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      );
    } else {
      return (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No rooms found</h3>
            <p>Try adjusting your search or filters to find available rooms.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              setStakeFilter('all');
              setStatusFilter('all');
            }}
          >
            Clear Filters
          </Button>
        </div>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Available Rooms</h1>
          <p className="text-muted-foreground">
            Join a bingo room and compete for prizes!
          </p>
        </div>
        <div className="flex items-center justify-between">
          <CreateRoomDialog
            trigger={
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create Room</span>
              </Button>
            }
            onRoomCreated={onRoomDeleted}
          />
          {onJoinPrivate && (
            <JoinRoomDialog
              onJoin={onJoinPrivate}
              trigger={
                <Button variant="outline" className="ml-2">
                  Join Room
                </Button>
              }
              initialRoomCode={initialRoomCode}
              autoOpen={!!initialRoomCode}
            />
          )}
          <Button className="bg-gray-100/35 hover:bg-gray-200/35 ml-4"
            onClick={() => window.location.reload()}>
            <RefreshCcw className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>

      {/* Tabs for Public Rooms and My Rooms */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rooms...</p>
        </div>
      ) : (
        <Tabs defaultValue="public" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="public">
              Public Rooms
              {isConnected && (
                <span className="flex size-2 rounded-full bg-green-500"></span>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-rooms">My Rooms</TabsTrigger>
          </TabsList>

          <TabsContent value="public">
            {renderRoomsList(filteredRooms, false, liveStatus)}
          </TabsContent>

          <TabsContent value="my-rooms">
            {renderRoomsList(filteredMyRooms, true, [])}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
