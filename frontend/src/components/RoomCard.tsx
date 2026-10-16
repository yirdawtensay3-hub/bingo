import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, Clock, Trophy } from 'lucide-react';
import type { Room } from '@/types/bingo';



interface RoomCardProps {
  room: Room;
  onJoin: (roomId: string, roomStake: number, roomName: string) => void;
  userBalance: number;
}

export const RoomCard: React.FC<RoomCardProps> = ({ room, onJoin, userBalance }) => {
  const canJoin = room.status === 'waiting' && room.players < room.maxPlayers && userBalance >= room.stake;
  
  // Use enhanced status if available
  const enhancedStatus = room.latestSession?.enhancedStatus || room.status;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
      case 'filling':
        return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'playing':
      case 'active':
        return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400';
      case 'finished':
        return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Waiting for Players';
      case 'filling':
        return 'Filling Up';
      case 'playing':
      case 'active':
        return '🔴 LIVE';
      case 'finished':
        return 'Game Finished';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/50">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">{room.name}</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(enhancedStatus)}`}>
          {getStatusText(enhancedStatus)}
        </span>
      </div>

      <div className="space-y-3 mb-6">
        {/* Stake and Prize */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Stake:</span>
          </div>
          <span className="font-semibold text-foreground">{room.stake}birr</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Prize Pool:</span>
          </div>
          <span className="font-semibold text-primary">{room.prize} birr</span>
        </div>

        {/* Players */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Players:</span>
          </div>
          <span className="font-semibold text-foreground">
            {room.players}/{room.maxPlayers}
            {enhancedStatus === 'filling' && room.players > 0 && (
              <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400 animate-pulse">
                Joining...
              </span>
            )}
          </span>
        </div>

        {/* Show called numbers if game is active */}
        {enhancedStatus === 'active' && room.latestSession && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Numbers Called:</span>
            </div>
            <span className="font-semibold text-red-600 dark:text-red-400">
              {room.latestSession.calledCount}
            </span>
          </div>
        )}

        {/* Time Limit */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Time Limit:</span>
          </div>
          <span className="font-semibold text-foreground">{room.timeLimit} min</span>
        </div>
      </div>

      {/* Join Button */}
      <Button
        onClick={() => onJoin(room.id, room.stake, room.name)}
        disabled={!canJoin}
        className="w-full"
        variant={canJoin ? "default" : "secondary"}
      >
        {canJoin ? 'Join Room' :
          room.status !== 'waiting' ? 'Game in Progress' :
            room.players >= room.maxPlayers ? 'Room Full' :
              'Insufficient Balance'
        }
      </Button>

      {/* Balance Warning */}
      {userBalance < room.stake && (
        <p className="text-xs text-destructive mt-2 text-center">
          You need ${(room.stake - userBalance).toFixed(2)} more to join
        </p>
      )}
    </div>
  );
};
