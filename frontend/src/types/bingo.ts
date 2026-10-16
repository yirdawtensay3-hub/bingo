export interface BingoCard {
  id?: string;
  boardId: number;
  numbers: number[][];
  selected: boolean;
}

export interface CalledNumber {
  letter: string;
  number: number;
  color: string;
}

export interface LatestSession {
  _id: string;
  status: 'waiting' | 'active' | 'finished' | 'countdown';
  enhancedStatus: 'waiting' | 'filling' | 'active' | 'finished' | 'countdown';
  calledCount: number;
  stakePool: number;
  playerCount: number;
  willStart?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  stake: number;
  players: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished' | 'countdown';
  prize: number;
  timeLimit: number;
  roomCode?: string;
  latestSession?: LatestSession | null;
}
