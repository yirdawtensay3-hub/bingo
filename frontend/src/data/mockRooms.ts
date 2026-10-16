import type { Room } from '@/types/bingo';

export const mockRooms: Room[] = [
  {
    id: '1',
    name: 'Beginner Bingo',
    stake: 5,
    players: 3,
    maxPlayers: 8,
    status: 'waiting',
    prize: 35,
    timeLimit: 15
  },
  {
    id: '2',
    name: 'High Rollers',
    stake: 100,
    players: 2,
    maxPlayers: 6,
    status: 'waiting',
    prize: 500,
    timeLimit: 20
  },
  {
    id: '3',
    name: 'Quick Play',
    stake: 4,
    players: 7,
    maxPlayers: 10,
    status: 'waiting',
    prize: 18,
    timeLimit: 10
  },
  {
    id: '4',
    name: 'Weekend Warriors',
    stake: 25,
    players: 4,
    maxPlayers: 8,
    status: 'playing',
    prize: 175,
    timeLimit: 25
  },
];
