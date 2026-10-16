import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { roomsAPI } from '@/services/api';
import { toast } from 'sonner';
import type { Room } from '@/types/bingo';

interface EditRoomDialogProps {
  room: Room;
  trigger: React.ReactNode;
  onRoomUpdated?: () => void;
}

export const EditRoomDialog: React.FC<EditRoomDialogProps> = ({ room, trigger, onRoomUpdated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: room.name,
    stake: room.stake,
    maxPlayers: room.maxPlayers || 100,
    minPlayers: 2,
    hitsToWin: 1,
    waitingTime: 5000,
    autoStart: false,
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form data when dialog opens
      setFormData({
        name: room.name,
        stake: room.stake,
        maxPlayers: room.maxPlayers || 100,
        minPlayers: 2,
        hitsToWin: 1,
        waitingTime: 5000,
        autoStart: false,
      });
    }
  }, [isOpen, room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!formData.name.trim()) {
      toast.error('Room name is required');
      return;
    }

    if (formData.stake < 5) {
      toast.error('Stake must be at least 5 birr');
      return;
    }

    if (formData.maxPlayers < 2 || formData.maxPlayers > 100) {
      toast.error('Max players must be between 2 and 100');
      return;
    }

    if (formData.minPlayers < 2 || formData.minPlayers > 100) {
      toast.error('Min players must be between 2 and 100');
      return;
    }

    if (formData.minPlayers > formData.maxPlayers) {
      toast.error('Min players cannot be greater than max players');
      return;
    }

    if (formData.hitsToWin < 1 || formData.hitsToWin > 5) {
      toast.error('Hits to win must be between 1 and 5');
      return;
    }

    if (formData.waitingTime < 1000 || formData.waitingTime > 60000) {
      toast.error('Waiting time must be between 1000ms and 60000ms');
      return;
    }

    setIsLoading(true);
    try {
      await roomsAPI.updateRoom(room.id, {
        name: formData.name.trim(),
        stake: formData.stake,
        maxPlayers: formData.maxPlayers,
        minPlayers: formData.minPlayers,
        hitsToWin: formData.hitsToWin,
        waitingTime: formData.waitingTime,
        autoStart: formData.autoStart,
      });

      toast.success(`Room "${formData.name}" updated successfully!`);
      setIsOpen(false);
      if (onRoomUpdated) {
        onRoomUpdated();
      }
    } catch (error: any) {
      console.error('Failed to update room:', error);

      // Handle validation errors from backend
      if (error?.response?.status === 400) {
        const errorData = error.response.data;

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
      } else if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update room. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Room Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Enter room name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stake">Stake (birr) *</Label>
            <Input
              id="stake"
              type="number"
              min="5"
              value={formData.stake}
              onChange={(e) => setFormData({ ...formData, stake: Number(e.target.value) })}
              required
              placeholder="Minimum 5 birr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPlayers">Min Players</Label>
              <Input
                id="minPlayers"
                type="number"
                min="2"
                max="100"
                value={formData.minPlayers}
                onChange={(e) => setFormData({ ...formData, minPlayers: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Max Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                min="2"
                max="100"
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hitsToWin">Hits to Win</Label>
              <Input
                id="hitsToWin"
                type="number"
                min="1"
                max="5"
                value={formData.hitsToWin}
                onChange={(e) => setFormData({ ...formData, hitsToWin: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="waitingTime">Waiting Time (ms)</Label>
              <Input
                id="waitingTime"
                type="number"
                min="1000"
                max="60000"
                value={formData.waitingTime}
                onChange={(e) => setFormData({ ...formData, waitingTime: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="autoStart">Auto Start</Label>
            <Switch
              id="autoStart"
              checked={formData.autoStart}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, autoStart: checked })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Room'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
