import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JoinRoomDialogProps {
  onJoin: (roomCode: string) => void;
  trigger: React.ReactNode;
  initialRoomCode?: string;
  autoOpen?: boolean;
}

export const JoinRoomDialog: React.FC<JoinRoomDialogProps> = ({ onJoin, trigger, initialRoomCode, autoOpen }) => {
  const [roomCode, setRoomCode] = useState(initialRoomCode || '');
  const [isOpen, setIsOpen] = useState(autoOpen || false);

  useEffect(() => {
    console.log('JoinRoomDialog received:', { initialRoomCode, autoOpen });
    if (initialRoomCode) {
      console.log('Setting room code and opening dialog:', initialRoomCode);
      setRoomCode(initialRoomCode);
      if (autoOpen) {
        setIsOpen(true);
      }
    }
  }, [initialRoomCode, autoOpen]);

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      onJoin(roomCode.trim().toUpperCase());
      setIsOpen(false);
      setRoomCode('');
      // Clear the pending room code from localStorage after joining
      localStorage.removeItem('pendingRoomCode');
      console.log('Cleared pendingRoomCode from localStorage');
    }
  };

  const handleClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clear localStorage when dialog is closed
      localStorage.removeItem('pendingRoomCode');
      console.log('Dialog closed, cleared pendingRoomCode from localStorage');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Private Room</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            placeholder="Enter Room Code (e.g., AB12)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
          />
          <Button onClick={handleJoinRoom}>Join</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
