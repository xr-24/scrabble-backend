import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../types/game';
import { dictionaryService } from './dictionaryService';
import { moveManager } from './moveManager';
import { calculateTurnScore } from './scoreCalculator';
import { validateMove } from './wordValidator';

// Ars Goetia demon names for AI personalities
const DEMON_NAMES = [
  'Baal', 'Agares', 'Vassago', 'Samigina', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
  'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos', 'Zepar',
  'Botis', 'Bathin', 'Sallos', 'Purson', 'Marax', 'Ipos', 'Aim', 'Naberius',
  'Glasya-Labolas', 'Bune', 'Ronove', 'Berith', 'Astaroth', 'Forneus', 'Foras',
  'Asmoday', 'Gaap', 'Furfur', 'Marchosias', 'Stolas', 'Phenex', 'Halphas',
  'Malphas', 'Raum', 'Focalor', 'Vepar', 'Sabnock', 'Shax', 'Vine', 'Bifrons',
  'Vual', 'Haagenti', 'Crocell', 'Furcas', 'Balam', 'Alloces', 'Caim', 'Murmur',
  'Orobas', 'Gremory', 'Ose', 'Amy', 'Orias', 'Vapula', 'Zagan', 'Valac',
  'Andras', 'Flauros', 'Andrealphus', 'Kimaris', 'Amdusias', 'Belial', 'Decarabia',
  'Seere', 'Dantalion', 'Andromalius'
];

interface AIMove {
  type: 'WORD' | 'EXCHANGE' | 'PASS';
  tiles?: PlacedTile[];
  exchangeTileIds?: string[];
}

interface WordPlacement {
  word: string;
  startRow: number;
  startCol: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  tiles: PlacedTile[];
  score: number;
}

export class AIService {
  private usedDemonNames: Set<string> = new Set();

  generateDemonName(): string {
    const availableNames = DEMON_NAMES.filter(name => !this.usedDemonNames.has(name));
    
    if (availableNames.length === 0) {
      // If all names are used, reset and start over
      this.usedDemonNames.clear();
      const name = DEMON_NAMES[Math.floor(Math.random() * DEMON_NAMES.length)];
      this.usedDemonNames.add(name);
      return name;
    }
    
    const name = availableNames[Math.floor(Math.random() * availableNames.length)];
    this.usedDemonNames.add(name);
    return name;
  }

  async generateMove(gameState: GameState, playerId: string): Promise<AIMove> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.error(`AI player ${playerId} not found in game state`);
      return { type: 'PASS' };
    }

    console.log(`AI ${player.name} (${player.aiPersonality}) is thinking...`);
    console.log(`AI ${player.name} has tiles:`, player.tiles.map(t => t.letter).join(', '));

    try {
      // Use a simpler, more reliable approach
      const possibleMoves = await this.findSimplePossibleMoves(gameState.board, player.tiles);
      console.log(`AI ${player.name} found ${possibleMoves.length} possible moves`);
      
      if (possibleMoves.length === 0) {
        console.log(`AI ${player.name} has no valid moves, will exchange tiles`);
        return this.generateExchangeMove(player.tiles);
      }

      // Sort by score (greedy algorithm - pick highest scoring move)
      possibleMoves.sort((a, b) => b.score - a.score);
      const bestMove = possibleMoves[0];

      console.log(`AI ${player.name} chose word "${bestMove.word}" for ${bestMove.score} points at (${bestMove.startRow}, ${bestMove.startCol}) ${bestMove.direction}`);
      
      return {
        type: 'WORD',
        tiles: bestMove.tiles
      };
    } catch (error) {
      console.error(`Error generating AI move for ${player.name}:`, error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'Unknown error');
      // Always fallback to pass instead of crashing
      return { type: 'PASS' };
    }
  }

  // Simplified approach that's more reliable
  private async findSimplePossibleMoves(board: BoardCell[][], tiles: Tile[]): Promise<WordPlacement[]> {
    const moves: WordPlacement[] = [];
    
    // Try common 2-3 letter words first (more likely to succeed)
    const commonWords = await this.findCommonWords(tiles);
    
    for (const word of commonWords) {
      const placements = await this.findValidPlacements(word, board, tiles);
      moves.push(...placements);
      
      // Limit to prevent timeout - if we find 10+ moves, that's enough
      if (moves.length >= 10) break;
    }

    return moves;
  }

  private async findCommonWords(tiles: Tile[]): Promise<string[]> {
    const words: string[] = [];
    const letters = tiles.map(t => t.letter.toUpperCase());
    
    // Common 2-letter words to try first
    const common2Letter = ['AT', 'TO', 'OF', 'IN', 'IT', 'IS', 'BE', 'AS', 'OR', 'AN', 'ON', 'NO', 'SO', 'BY', 'MY', 'WE', 'UP', 'IF', 'GO', 'DO', 'ME', 'HE', 'AM', 'US', 'OX', 'AX'];
    
    // Common 3-letter words
    const common3Letter = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO'];
    
    // Check if we can make any common words
    for (const word of [...common2Letter, ...common3Letter]) {
      if (this.canMakeWord(word, letters)) {
        try {
          if (await dictionaryService.isValidWord(word)) {
            words.push(word);
          }
        } catch (error) {
          console.warn(`Error checking word ${word}:`, error);
        }
      }
    }
    
    // Also try simple combinations of available letters
    for (let i = 0; i < letters.length; i++) {
      for (let j = i + 1; j < letters.length; j++) {
        const word2 = letters[i] + letters[j];
        if (!words.includes(word2)) {
          try {
            if (await dictionaryService.isValidWord(word2)) {
              words.push(word2);
            }
          } catch (error) {
            // Ignore errors for individual word checks
          }
        }
        
        for (let k = j + 1; k < letters.length; k++) {
          const word3 = letters[i] + letters[j] + letters[k];
          if (!words.includes(word3)) {
            try {
              if (await dictionaryService.isValidWord(word3)) {
                words.push(word3);
              }
            } catch (error) {
              // Ignore errors for individual word checks
            }
          }
        }
      }
    }
    
    return words;
  }
  
  private canMakeWord(word: string, availableLetters: string[]): boolean {
    const letterCounts = new Map<string, number>();
    
    // Count available letters
    for (const letter of availableLetters) {
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }
    
    // Check if we have enough of each letter needed for the word
    for (const letter of word) {
      const needed = letterCounts.get(letter) || 0;
      if (needed === 0) {
        return false;
      }
      letterCounts.set(letter, needed - 1);
    }
    
    return true;
  }

  private async findValidPlacements(word: string, board: BoardCell[][], availableTiles: Tile[]): Promise<WordPlacement[]> {
    const placements: WordPlacement[] = [];
    
    // Try horizontal placements
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col <= 15 - word.length; col++) {
        const placement = await this.tryPlacement(word, row, col, 'HORIZONTAL', board, availableTiles);
        if (placement) {
          placements.push(placement);
        }
      }
    }
    
    // Try vertical placements
    for (let row = 0; row <= 15 - word.length; row++) {
      for (let col = 0; col < 15; col++) {
        const placement = await this.tryPlacement(word, row, col, 'VERTICAL', board, availableTiles);
        if (placement) {
          placements.push(placement);
        }
      }
    }
    
    return placements;
  }

  private async tryPlacement(
    word: string, 
    startRow: number, 
    startCol: number, 
    direction: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][],
    availableTiles: Tile[]
  ): Promise<WordPlacement | null> {
    const tiles: PlacedTile[] = [];
    const usedTileIds: string[] = [];
    let connectsToExistingTile = false;
    
    // Check if placement is valid and build tile list
    for (let i = 0; i < word.length; i++) {
      const row = direction === 'HORIZONTAL' ? startRow : startRow + i;
      const col = direction === 'HORIZONTAL' ? startCol + i : startCol;
      const letter = word[i].toUpperCase();
      
      const existingTile = board[row][col].tile;
      
      if (existingTile) {
        // Must match existing tile
        if (existingTile.letter.toUpperCase() !== letter) {
          return null;
        }
        connectsToExistingTile = true;
      } else {
        // Need to place a new tile
        const availableTile = availableTiles.find(t => 
          t.letter.toUpperCase() === letter && !usedTileIds.includes(t.id)
        );
        
        if (!availableTile) {
          return null; // Don't have the required letter
        }
        
        tiles.push({
          tile: availableTile,
          row,
          col
        });
        usedTileIds.push(availableTile.id);
      }
    }
    
    // Must place at least one new tile
    if (tiles.length === 0) {
      return null;
    }
    
    // First move must cover center square (7,7)
    const isFirstMove = board.every(row => row.every(cell => !cell.tile));
    if (isFirstMove) {
      const coversCenter = tiles.some(t => t.row === 7 && t.col === 7);
      if (!coversCenter) {
        return null;
      }
      connectsToExistingTile = true; // First move is always valid for connection
    }
    
    // Must connect to existing tiles (except first move)
    if (!connectsToExistingTile && !isFirstMove) {
      // Check if any placed tile is adjacent to an existing tile
      const hasAdjacent = tiles.some(placedTile => {
        const { row, col } = placedTile;
        const adjacentPositions = [
          [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]
        ];
        
        return adjacentPositions.some(([adjRow, adjCol]) => {
          if (adjRow < 0 || adjRow >= 15 || adjCol < 0 || adjCol >= 15) return false;
          return board[adjRow][adjCol].tile !== null;
        });
      });
      
      if (!hasAdjacent) {
        return null;
      }
    }
    
    // Validate the move using existing word validator
    try {
      const validation = await validateMove(tiles, board);
      if (!validation.isValid) {
        return null;
      }
      
      // Calculate score
      const score = calculateTurnScore(validation.words, tiles, board);
      
      return {
        word,
        startRow,
        startCol,
        direction,
        tiles,
        score: score.totalScore
      };
    } catch (error) {
      return null;
    }
  }

  private generateExchangeMove(tiles: Tile[]): AIMove {
    // Exchange 3-5 random tiles (or all if fewer than 3)
    const exchangeCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), tiles.length);
    const shuffledTiles = [...tiles].sort(() => Math.random() - 0.5);
    const tilesToExchange = shuffledTiles.slice(0, exchangeCount);
    
    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }
}

export const aiService = new AIService();
