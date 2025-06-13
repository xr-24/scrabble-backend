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

// Pre-cached common words for fast AI moves
const COMMON_WORDS = {
  2: ['AT', 'TO', 'OF', 'IN', 'IT', 'IS', 'BE', 'AS', 'OR', 'AN', 'ON', 'NO', 'SO', 'BY', 'MY', 'WE', 'UP', 'IF', 'GO', 'DO', 'ME', 'HE', 'AM', 'US', 'OX', 'AX', 'EX', 'HI', 'LO', 'OH', 'YE', 'YO'],
  3: ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO', 'ACE', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'BAT', 'BIT', 'BUG', 'BUS', 'BUY', 'COW', 'CRY', 'CUT', 'EAR', 'EAT', 'END', 'FAR', 'FEW', 'FIX', 'FLY', 'FOX', 'GUN', 'GUY', 'HIT', 'ICE', 'KEY', 'KID', 'LAW', 'LAY', 'LET', 'LIE', 'LOT', 'LOW', 'MAP', 'MIX', 'MOM', 'NET', 'OIL', 'PAY', 'PET', 'PUT', 'ROW', 'SAD', 'SAY', 'SET', 'SIX', 'SKY', 'SON', 'TAX', 'TEA', 'TIE', 'TOY', 'TRY', 'USE', 'VAN', 'WAR', 'WAY', 'WET', 'WHY', 'WON', 'YET', 'ZIP'],
  4: ['THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT', 'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE', 'WHAT', 'WORD', 'WORK', 'YEAR', 'BACK', 'CALL', 'CAME', 'EACH', 'FIND', 'GIVE', 'HAND', 'HIGH', 'KEEP', 'LAST', 'LEFT', 'LIFE', 'LIVE', 'LOOK', 'MADE', 'MOST', 'MOVE', 'MUST', 'NAME', 'NEED', 'NEXT', 'OPEN', 'PART', 'PLAY', 'RIGHT', 'SAID', 'SAME', 'SEEM', 'SHOW', 'SIDE', 'TELL', 'TURN', 'USED', 'WANT', 'WAYS', 'WEEK', 'WENT', 'WERE', 'WHAT', 'WORK', 'YEAR', 'ALSO', 'AREA', 'AWAY', 'BEST', 'BOOK', 'BOTH', 'CASE', 'CITY', 'COME', 'DONE', 'DOWN', 'EACH', 'EVEN', 'EVER', 'FACE', 'FACT', 'FEEL', 'FIRE', 'FORM', 'FREE', 'FULL', 'GAME', 'GIRL', 'GOES', 'HELP', 'HOME', 'HOPE', 'HOUR', 'IDEA', 'INTO', 'ITEM', 'KEEP', 'KIND', 'KNEW', 'LAND', 'LATE', 'LEAD', 'LESS', 'LINE', 'LIST', 'LIVE', 'LONG', 'LOOK', 'LOVE', 'MAIN', 'MAKE', 'MEAN', 'MIND', 'MORE', 'MOVE', 'NEAR', 'NEED', 'NEWS', 'NICE', 'ONLY', 'OPEN', 'OVER', 'PLAN', 'REAL', 'ROOM', 'SAVE', 'SEEN', 'SEND', 'SHIP', 'SHOP', 'SHOW', 'SIDE', 'SIZE', 'SOME', 'SOON', 'STOP', 'SURE', 'TAKE', 'TALK', 'TEAM', 'TELL', 'TEST', 'TEXT', 'THEN', 'THEY', 'THIN', 'THIS', 'TIME', 'TOLD', 'TOOK', 'TREE', 'TRUE', 'TYPE', 'UNIT', 'UPON', 'USED', 'USER', 'VERY', 'VIEW', 'WALK', 'WALL', 'WANT', 'WATER', 'WEEK', 'WELL', 'WENT', 'WHAT', 'WHEN', 'WILL', 'WITH', 'WORD', 'WORK', 'YEAR', 'YOUR']
};

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

interface AnchorPoint {
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
}

export class AIService {
  private usedDemonNames: Set<string> = new Set();
  private wordCache: Map<string, boolean> = new Map();

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

    console.log(`🔥 Demon ${player.name} seeks maximum carnage...`);
    console.log(`Available tiles: ${player.tiles.map(t => t.letter).join(', ')}`);

    const startTime = Date.now();
    
    try {
      // Fast, score-focused move generation
      const possibleMoves = await this.findHighValueMoves(gameState.board, player.tiles);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`🔥 Demon ${player.name} found ${possibleMoves.length} moves in ${elapsedTime}ms`);
      
      if (possibleMoves.length === 0) {
        console.log(`🔥 Demon ${player.name} finds no worthy words, exchanges tiles in frustration`);
        return this.generateExchangeMove(player.tiles);
      }

      // Demons are greedy - always pick the highest scoring move
      possibleMoves.sort((a, b) => b.score - a.score);
      const bestMove = possibleMoves[0];

      console.log(`🔥 Demon ${player.name} unleashes "${bestMove.word}" for ${bestMove.score} points!`);
      
      return {
        type: 'WORD',
        tiles: bestMove.tiles
      };
    } catch (error) {
      console.error(`💀 Demon ${player.name} failed to conjure a move:`, error);
      return { type: 'PASS' };
    }
  }

  // Fast, score-focused move generation
  private async findHighValueMoves(board: BoardCell[][], tiles: Tile[]): Promise<WordPlacement[]> {
    const moves: WordPlacement[] = [];
    const anchorPoints = this.findAnchorPoints(board);
    
    // If no anchor points (first move), use center
    if (anchorPoints.length === 0) {
      anchorPoints.push({ row: 7, col: 7, direction: 'HORIZONTAL' });
      anchorPoints.push({ row: 7, col: 7, direction: 'VERTICAL' });
    }

    // Generate words from available tiles (fast approach)
    const candidateWords = this.generateCandidateWords(tiles);
    
    // Try each word at each anchor point
    for (const word of candidateWords) {
      for (const anchor of anchorPoints) {
        const placement = await this.tryWordAtAnchor(word, anchor, board, tiles);
        if (placement) {
          moves.push(placement);
          
          // Limit moves to prevent timeout - demons are impatient!
          if (moves.length >= 15) break;
        }
      }
      if (moves.length >= 15) break;
    }

    return moves;
  }

  // Find strategic anchor points (adjacent to existing tiles)
  private findAnchorPoints(board: BoardCell[][]): AnchorPoint[] {
    const anchors: AnchorPoint[] = [];
    
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (board[row][col].tile) {
          // Add horizontal anchors (left and right of existing tiles)
          if (col > 0 && !board[row][col - 1].tile) {
            anchors.push({ row, col: col - 1, direction: 'HORIZONTAL' });
          }
          if (col < 14 && !board[row][col + 1].tile) {
            anchors.push({ row, col: col + 1, direction: 'HORIZONTAL' });
          }
          
          // Add vertical anchors (above and below existing tiles)
          if (row > 0 && !board[row - 1][col].tile) {
            anchors.push({ row: row - 1, col, direction: 'VERTICAL' });
          }
          if (row < 14 && !board[row + 1][col].tile) {
            anchors.push({ row: row + 1, col, direction: 'VERTICAL' });
          }
        }
      }
    }
    
    return anchors;
  }

  // Generate candidate words from available tiles (prioritize high-value combinations)
  private generateCandidateWords(tiles: Tile[]): string[] {
    const words: string[] = [];
    const letters = tiles.map(t => t.letter.toUpperCase());
    
    // Start with pre-cached common words that we can make
    for (const [length, wordList] of Object.entries(COMMON_WORDS)) {
      for (const word of wordList) {
        if (this.canMakeWord(word, letters)) {
          words.push(word);
        }
      }
    }
    
    // Add some simple 2-letter combinations for quick plays
    for (let i = 0; i < letters.length && words.length < 50; i++) {
      for (let j = i + 1; j < letters.length && words.length < 50; j++) {
        const word = letters[i] + letters[j];
        if (!words.includes(word)) {
          words.push(word);
        }
      }
    }
    
    // Prioritize longer words (higher scoring potential)
    return words.sort((a, b) => b.length - a.length);
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

  private async tryWordAtAnchor(
    word: string,
    anchor: AnchorPoint,
    board: BoardCell[][],
    availableTiles: Tile[]
  ): Promise<WordPlacement | null> {
    const { row: anchorRow, col: anchorCol, direction } = anchor;
    
    // Try different starting positions relative to the anchor
    const maxOffset = Math.min(word.length - 1, direction === 'HORIZONTAL' ? anchorCol : anchorRow);
    
    for (let offset = 0; offset <= maxOffset; offset++) {
      const startRow = direction === 'HORIZONTAL' ? anchorRow : anchorRow - offset;
      const startCol = direction === 'HORIZONTAL' ? anchorCol - offset : anchorCol;
      
      // Check bounds
      const endRow = direction === 'HORIZONTAL' ? startRow : startRow + word.length - 1;
      const endCol = direction === 'HORIZONTAL' ? startCol + word.length - 1 : startCol;
      
      if (startRow < 0 || startCol < 0 || endRow >= 15 || endCol >= 15) {
        continue;
      }
      
      const placement = await this.tryPlacement(word, startRow, startCol, direction, board, availableTiles);
      if (placement) {
        return placement;
      }
    }
    
    return null;
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
      return null;
    }
    
    // Quick word validation using cache
    const isValid = await this.isValidWordCached(word);
    if (!isValid) {
      return null;
    }
    
    // Validate the move (this is expensive, so we do it last)
    try {
      const validation = await validateMove(tiles, board);
      if (!validation.isValid) {
        return null;
      }
      
      // Calculate score - demons love high scores!
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

  // Cached word validation for performance
  private async isValidWordCached(word: string): Promise<boolean> {
    if (this.wordCache.has(word)) {
      return this.wordCache.get(word)!;
    }
    
    try {
      const isValid = await dictionaryService.isValidWord(word);
      this.wordCache.set(word, isValid);
      return isValid;
    } catch (error) {
      this.wordCache.set(word, false);
      return false;
    }
  }

  private generateExchangeMove(tiles: Tile[]): AIMove {
    // Demons exchange tiles strategically - keep high-value letters
    const tileValues = tiles.map(t => ({ tile: t, value: t.value }));
    tileValues.sort((a, b) => a.value - b.value); // Sort by value (ascending)
    
    // Exchange 3-5 lowest value tiles
    const exchangeCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), tiles.length);
    const tilesToExchange = tileValues.slice(0, exchangeCount).map(tv => tv.tile);
    
    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }
}

export const aiService = new AIService();
