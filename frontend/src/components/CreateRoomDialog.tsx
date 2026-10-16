import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { roomsAPI } from '@/services/api';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';

interface CreateRoomDialogProps {
  trigger: React.ReactNode;
  onRoomCreated?: () => void;
}

export const CreateRoomDialog: React.FC<CreateRoomDialogProps> = ({ trigger, onRoomCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [stake, setStake] = useState('5');
  const [maxPlayers, setMaxPlayers] = useState('100');
  const [minPlayers, setMinPlayers] = useState('2');
  const [hitsToWin, setHitsToWin] = useState('1');
  const [waitingTime, setWaitingTime] = useState('5');
  const [autoStart, setAutoStart] = useState(true);
  const { user } = useUser();

  const handleCreateRoom = async () => {
    if (!user?.userId) {
      toast.error('You must be logged in to create a room.');
      return;
    }

    // Client-side validation
    if (!name.trim()) {
      toast.error('Room name is required');
      return;
    }

    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum < 5) {
      toast.error('Stake must be at least 5 birr');
      return;
    }

    const maxPlayersNum = parseInt(maxPlayers, 10);
    if (isNaN(maxPlayersNum) || maxPlayersNum < 2 || maxPlayersNum > 100) {
      toast.error('Max players must be between 2 and 100');
      return;
    }

    const minPlayersNum = parseInt(minPlayers, 10);
    if (isNaN(minPlayersNum) || minPlayersNum < 2 || minPlayersNum > 100) {
      toast.error('Min players must be between 2 and 100');
      return;
    }

    if (minPlayersNum > maxPlayersNum) {
      toast.error('Min players cannot be greater than max players');
      return;
    }

    const hitsToWinNum = parseInt(hitsToWin, 10);
    if (isNaN(hitsToWinNum) || hitsToWinNum < 1 || hitsToWinNum > 5) {
      toast.error('Hits to win must be between 1 and 5');
      return;
    }

    const waitingTimeNum = parseInt(waitingTime, 10);
    if (isNaN(waitingTimeNum) || waitingTimeNum < 5 || waitingTimeNum > 60) {
      toast.error('Waiting time must be between 5 and 60 seconds');
      return;
    }

    setIsLoading(true);
    try {
      const room = await roomsAPI.createRoom({
        name: name.trim(),
        stake: stakeNum,
        maxPlayers: maxPlayersNum,
        minPlayers: minPlayersNum,
        hitsToWin: hitsToWinNum,
        waitingTime: waitingTimeNum * 1000, // Convert seconds to milliseconds for backend
        autoStart,
        type: 'private',
      });

      toast.success(`Room "${room.name}" created successfully!`);
      setIsOpen(false);

      // Reset form
      setName('');
      setStake('5');
      setMaxPlayers('100');
      setMinPlayers('2');
      setHitsToWin('1');
      setWaitingTime('5');
      setAutoStart(true);

      // Trigger callback to reload rooms
      if (onRoomCreated) {
        onRoomCreated();
      }
    } catch (e: any) {
      console.error('Create room failed', e);
      
      // Handle validation errors from backend
      if (e?.response?.status === 400) {
        const errorData = e.response.data;
        
        // Handle class-validator errors
        if (Array.isArray(errorData.message)) {
          // Multiple validation errors
          errorData.message.forEach((msg: string) => {
            toast.error(msg);
          });
        } else if (errorData.message) {
          // Single error message
          toast.error(errorData.message);
        } else {
          toast.error('Invalid input. Please check your values.');
        }
      } else if (e?.response?.data?.message) {
        toast.error(e.response.data.message);
      } else {
        toast.error('Failed to create room. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a New Room</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e: any) => setName(e.target.value)} 
              className="col-span-3"
              placeholder="Enter room name"
              disabled={isLoading}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="stake" className="text-right">Stake (birr) *</Label>
            <Input 
              id="stake" 
              type="number" 
              min="5"
              step="0.01"
              value={stake} 
              onChange={(e: any) => setStake(e.target.value)} 
              className="col-span-3"
              placeholder="Minimum 5 birr"
              disabled={isLoading}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxPlayers" className="text-right">Max Players</Label>
            <Input 
              id="maxPlayers" 
              type="number" 
              min="2"
              max="100"
              value={maxPlayers} 
              onChange={(e: any) => setMaxPlayers(e.target.value)} 
              className="col-span-3"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="minPlayers" className="text-right">Min Players</Label>
            <Input 
              id="minPlayers" 
              type="number" 
              min="2"
              max="100"
              value={minPlayers} 
              onChange={(e: any) => setMinPlayers(e.target.value)} 
              className="col-span-3"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hitsToWin" className="text-right">Hits to Win</Label>
            <Input 
              id="hitsToWin" 
              type="number" 
              min="1"
              max="5"
              value={hitsToWin} 
              onChange={(e: any) => setHitsToWin(e.target.value)} 
              className="col-span-3"
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="waitingTime" className="text-right">Waiting Time (seconds)</Label>
            <Input 
              id="waitingTime" 
              type="number" 
              min="5"
              max="60"
              step="1"
              value={waitingTime} 
              onChange={(e: any) => setWaitingTime(e.target.value)} 
              className="col-span-3"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="autoStart" 
              checked={autoStart} 
              onCheckedChange={(checked: any) => setAutoStart(!!checked)}
            />
            <Label htmlFor="autoStart">Auto start when min players reached</Label>
          </div>
          <Button onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Room'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
