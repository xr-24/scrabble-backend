export interface Tile {
  letter: string;
  value: number;
  id: string;
  isPowerUp?: boolean;
  powerUpType?: PowerUpType;
  emoji?: string;
  isBlank?: boolean;
  chosenLetter?: string;
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  emoji: string;
  name: string;
  description: string;
}

export type PowerUpType = 
  | 'SCROLL'           // 📜 - unlimited tile usage
  | 'HEADSTONE'        // 🪦 - swap all tiles with vowel guarantee
  | 'WILTED_ROSE'      // 🥀 - swap tiles with opponent
  | 'CRESCENT_MOON';   // 🌙 - add extra blank tile

export interface BoardCell {
  tile: Tile | null;
  multiplier: MultiplierType | null;
  powerUp: PowerUp | null;
}

export type MultiplierType = 
  | 'DOUBLE_LETTER' 
  | 'TRIPLE_LETTER' 
  | 'DOUBLE_WORD' 
  | 'TRIPLE_WORD' 
  | 'CENTER';

export interface Player {
  id: string;
  name: string;
  tiles: Tile[];
  score: number;
  hasEndedGame: boolean;
  activePowerUps: PowerUp[];
  activePowerUpForTurn: PowerUp | null;
}

export interface GameState {
  board: BoardCell[][];
  players: Player[];
  currentPlayerIndex: number;
  tileBag: Tile[];
  gamePhase: 'SETUP' | 'PLAYING' | 'FINISHED';
  turnNumber: number;
  playersEndedGame: string[];
  moveHistory: MoveHistoryEntry[];
}

export interface PlacedTile {
  tile: Tile;
  row: number;
  col: number;
}

export interface WordPlacement {
  word: string;
  tiles: PlacedTile[];
  direction: 'HORIZONTAL' | 'VERTICAL';
  startRow: number;
  startCol: number;
}

export interface MoveHistoryEntry {
  playerId: string;
  playerName: string;
  turnNumber: number;
  moveType: 'WORD' | 'EXCHANGE' | 'PASS';
  words?: string[];
  score: number;
  timestamp: Date;
}
