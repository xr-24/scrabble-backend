export interface Tile {
  letter: string;
  value: number;
  id: string;
  isPowerUp?: boolean;
  powerUpType?: PowerUpType;
  emoji?: string;
  isBlank?: boolean;
  chosenLetter?: string;
  placedByPlayerId?: string;
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
  | 'CRESCENT_MOON'    // 🌙 - add extra blank tile
  | 'BURN'             // 🔥 - choose 2 tiles to force opponent to discard
  | 'TILE_THIEF'       // 🗡️ - steal 1 tile from opponent's rack
  | 'MULTIPLIER_THIEF' // 💎 - steal a DW/TW from the board
  | 'DUPLICATE'        // 🪞 - copy one of your own tiles
  | 'EXTRA_TURN'       // 🔄 - play again after current turn
  | 'TILE_FREEZE'      // 🧊 - freeze a board tile, opponents can't connect to it
  | 'SILENCE'          // 🤐 - lock 3 random opponent tiles for their next turn
  | 'EXTRA_TILES';     // 📦 - get 3 bonus tiles for that turn only (10/7 rack)

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
  tileColor?: string;
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
