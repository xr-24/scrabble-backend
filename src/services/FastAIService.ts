import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../types/game';
import { dictionaryService } from './dictionaryService';
import { calculateTurnScore } from './scoreCalculator';
import { validateMove } from './wordValidator';
import { BOARD_SIZE } from '../constants/board';

interface AIMove {
  type: 'WORD' | 'EXCHANGE' | 'PASS';
  tiles?: PlacedTile[];
  exchangeTileIds?: string[];
}

interface WordCandidate {
  word: string;
  tiles: PlacedTile[];
  score: number;
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
}

export class FastAIService {
  private usedDemonNames: Set<string> = new Set();
  
  // Professional AI demon names
  private readonly DEMON_NAMES = [
    'Baal', 'Agares', 'Vassago', 'Samigina', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
    'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos', 'Zepar',
    'Botis', 'Bathin', 'Sallos', 'Purson', 'Marax', 'Ipos', 'Aim', 'Naberius'
  ];

  // Pre-built word lists for fast generation
  private readonly WORD_LISTS = {
    2: ['AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY', 'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EX', 'FA', 'FE', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA', 'KI', 'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OO', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY', 'PA', 'PE', 'PI', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TI', 'TO', 'UG', 'UH', 'UM', 'UN', 'UP', 'US', 'UT', 'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA', 'ZO'],
    3: ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID', 'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO', 'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BAT', 'BIT', 'BUG', 'BUS', 'BUY', 'CUT', 'EAR', 'EAT', 'END', 'FAR', 'FEW', 'FIT', 'FIX', 'FLY', 'GOT', 'GUN', 'HIT', 'ICE', 'ILL', 'JOY', 'KEY', 'LAY', 'LET', 'LIE', 'LOT', 'LOW', 'MAP', 'MIX', 'NET', 'OIL', 'OWN', 'PAY', 'PUT', 'SAD', 'SAY', 'SET', 'SIX', 'SKY', 'TRY', 'USE', 'WAR', 'WAY', 'WET', 'WHY', 'YET', 'QUA', 'ZAX', 'ZEX', 'JAW', 'JEW', 'WAX', 'FOX', 'TAX', 'MAX', 'REX', 'SEX', 'VEX', 'HEX'],
    4: ['THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT', 'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE', 'WHAT', 'WORD', 'WORK', 'YEAR', 'QUIZ', 'JAZZ', 'JINX', 'WAXY', 'FOXY', 'COZY', 'HAZY', 'LAZY', 'MAZE', 'DAZE', 'GAZE', 'RAZE', 'DIES', 'DIED', 'SIDE', 'IDEA', 'EDIT', 'TIDE'],
    5: ['ABOUT', 'AFTER', 'AGAIN', 'BEING', 'COULD', 'EVERY', 'FIRST', 'FOUND', 'GREAT', 'GROUP', 'HOUSE', 'LARGE', 'MIGHT', 'NEVER', 'OTHER', 'PLACE', 'RIGHT', 'SHALL', 'SMALL', 'SOUND', 'STILL', 'THEIR', 'THERE', 'THESE', 'THINK', 'THREE', 'UNDER', 'WATER', 'WHERE', 'WHICH', 'WHILE', 'WORLD', 'WOULD', 'WRITE', 'YOUNG', 'JAZZY', 'FIZZY', 'FUZZY', 'DIZZY', 'QUAKE', 'QUEEN', 'QUICK', 'QUIET', 'QUILT', 'QUOTE'],
    6: ['BEFORE', 'CHANGE', 'DURING', 'FOLLOW', 'FRIEND', 'HAPPEN', 'LITTLE', 'MOTHER', 'PEOPLE', 'PERSON', 'SCHOOL', 'SHOULD', 'SYSTEM', 'THOUGH', 'THROUGH', 'TURNED', 'WANTED', 'WITHIN', 'QUARTZ', 'ZEPHYR', 'JOCKEY', 'OXYGEN', 'PUZZLE', 'SIZZLE', 'FIZZLE', 'MUZZLE', 'NUZZLE'],
    7: ['ANOTHER', 'BECAUSE', 'BETWEEN', 'COMPANY', 'COUNTRY', 'EXAMPLE', 'GENERAL', 'HOWEVER', 'NOTHING', 'PROBLEM', 'PROGRAM', 'SEVERAL', 'SPECIAL', 'STUDENT', 'THROUGH', 'WITHOUT', 'QUICKLY', 'QUALIFY', 'SQUEEZE', 'BUZZARD', 'QUIZZED', 'PUZZLED', 'SIZZLED', 'FIZZLED']
  };

  async initialize(): Promise<void> {
    // Ensure dictionary service is loaded
    if (!dictionaryService.isDictionaryLoaded()) {
      await dictionaryService.loadDictionary();
    }
    console.log('🔥 Fast AI Service initialized');
  }

  generateDemonName(): string {
    const availableNames = this.DEMON_NAMES.filter(name => !this.usedDemonNames.has(name));
    
    if (availableNames.length === 0) {
      this.usedDemonNames.clear();
      const name = this.DEMON_NAMES[Math.floor(Math.random() * this.DEMON_NAMES.length)];
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
      console.error(`AI player ${playerId} not found`);
      return { type: 'PASS' };
    }

    console.log(`⚡ ${player.name} thinking...`);
    const startTime = Date.now();
    
    try {
      // Generate possible words from tiles
      const possibleWords = this.generatePossibleWords(player.tiles);
      console.log(`📚 Generated ${possibleWords.length} possible words from rack`);
      
      // Find anchor points (positions adjacent to existing tiles)
      const anchors = this.findAnchorPoints(gameState.board);
      console.log(`🎯 Found ${anchors.length} anchor points`);
      
      // Try to place words
      const candidates: WordCandidate[] = [];
      
      for (const word of possibleWords) {
        for (const anchor of anchors) {
          const candidate = await this.tryPlaceWord(word, anchor, gameState.board, player.tiles);
          if (candidate) {
            candidates.push(candidate);
            // Early exit for high-scoring moves
            if (candidate.score >= 50) break;
          }
        }
        if (candidates.length >= 10) break; // Limit search
      }
      
      console.log(`🔍 Found ${candidates.length} valid moves`);
      
      if (candidates.length === 0) {
        console.log(`🔄 ${player.name} exchanges tiles`);
        return this.generateExchange(player.tiles);
      }

      // Select best move
      const bestMove = candidates.sort((a, b) => b.score - a.score)[0];
      const elapsedTime = Date.now() - startTime;
      
      console.log(`🎯 ${player.name} plays "${bestMove.word}" for ${bestMove.score} points (${elapsedTime}ms)`);
      
      return {
        type: 'WORD',
        tiles: bestMove.tiles
      };
    } catch (error) {
      console.error(`💀 ${player.name} AI error:`, error);
      return { type: 'PASS' };
    }
  }

  private generatePossibleWords(tiles: Tile[]): string[] {
    const words: string[] = [];
    const letters = tiles.map(t => t.letter.toUpperCase()).filter(l => l !== '?');
    const blanks = tiles.filter(t => t.isBlank).length;
    
    // Check all pre-built words
    for (const [length, wordList] of Object.entries(this.WORD_LISTS)) {
      for (const word of wordList) {
        if (this.canMakeWord(word, letters, blanks)) {
          words.push(word);
        }
      }
    }
    
    // Sort by length (longer words first for higher scores)
    return words.sort((a, b) => b.length - a.length);
  }

  private canMakeWord(word: string, letters: string[], blanks: number): boolean {
    const letterCounts = new Map<string, number>();
    letters.forEach(letter => {
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    });
    
    let blanksNeeded = 0;
    for (const letter of word) {
      const available = letterCounts.get(letter) || 0;
      if (available > 0) {
        letterCounts.set(letter, available - 1);
      } else {
        blanksNeeded++;
      }
    }
    
    return blanksNeeded <= blanks;
  }

  private findAnchorPoints(board: BoardCell[][]): Array<{row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL'}> {
    const anchors: Array<{row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL'}> = [];
    const hasExistingTiles = board.some(row => row.some(cell => cell.tile));
    
    if (!hasExistingTiles) {
      // First move - center position
      return [
        { row: 7, col: 7, direction: 'HORIZONTAL' },
        { row: 7, col: 7, direction: 'VERTICAL' }
      ];
    }

    // Find positions adjacent to existing tiles
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col].tile) continue;
        
        if (this.isAdjacentToTile(row, col, board)) {
          anchors.push({ row, col, direction: 'HORIZONTAL' });
          anchors.push({ row, col, direction: 'VERTICAL' });
        }
      }
    }

    return anchors;
  }

  private isAdjacentToTile(row: number, col: number, board: BoardCell[][]): boolean {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return directions.some(([dr, dc]) => {
      const newRow = row + dr;
      const newCol = col + dc;
      return newRow >= 0 && newRow < BOARD_SIZE && 
             newCol >= 0 && newCol < BOARD_SIZE && 
             board[newRow][newCol].tile !== null;
    });
  }

  private async tryPlaceWord(
    word: string,
    anchor: {row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL'},
    board: BoardCell[][],
    tiles: Tile[]
  ): Promise<WordCandidate | null> {
    const { row, col, direction } = anchor;
    
    // Try different starting positions
    for (let offset = 0; offset < word.length; offset++) {
      const startRow = direction === 'HORIZONTAL' ? row : row - offset;
      const startCol = direction === 'HORIZONTAL' ? col - offset : col;
      
      const candidate = await this.evaluatePlacement(word, startRow, startCol, direction, board, tiles);
      if (candidate) {
        return candidate;
      }
    }
    
    return null;
  }

  private async evaluatePlacement(
    word: string,
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][],
    tiles: Tile[]
  ): Promise<WordCandidate | null> {
    // Check bounds
    const endRow = direction === 'HORIZONTAL' ? startRow : startRow + word.length - 1;
    const endCol = direction === 'HORIZONTAL' ? startCol + word.length - 1 : startCol;
    
    if (startRow < 0 || startCol < 0 || endRow >= BOARD_SIZE || endCol >= BOARD_SIZE) {
      return null;
    }

    const placedTiles: PlacedTile[] = [];
    const usedTileIds: string[] = [];
    let connectsToExisting = false;
    
    // Check if we can place this word
    for (let i = 0; i < word.length; i++) {
      const row = direction === 'HORIZONTAL' ? startRow : startRow + i;
      const col = direction === 'HORIZONTAL' ? startCol + i : startCol;
      const letter = word[i].toUpperCase();
      
      const existingTile = board[row][col].tile;
      
      if (existingTile) {
        if (existingTile.letter.toUpperCase() !== letter) {
          return null;
        }
        connectsToExisting = true;
      } else {
        // Find available tile
        let availableTile = tiles.find(t => 
          t.letter.toUpperCase() === letter && !usedTileIds.includes(t.id)
        );
        
        if (!availableTile) {
          availableTile = tiles.find(t => 
            t.isBlank && !usedTileIds.includes(t.id)
          );
        }
        
        if (!availableTile) {
          return null;
        }
        
        placedTiles.push({ tile: availableTile, row, col });
        usedTileIds.push(availableTile.id);
      }
    }
    
    if (placedTiles.length === 0) return null;
    
    // First move must cover center
    const isFirstMove = !board.some(row => row.some(cell => cell.tile));
    if (isFirstMove) {
      const coversCenter = placedTiles.some(t => t.row === 7 && t.col === 7);
      if (!coversCenter) return null;
      connectsToExisting = true;
    }
    
    if (!connectsToExisting && !isFirstMove) return null;
    
    // Validate word
    if (!(await dictionaryService.isValidWord(word))) return null;
    
    try {
      // Full validation
      const validation = await validateMove(placedTiles, board);
      if (!validation.isValid) return null;
      
      // Calculate score
      const scoreResult = calculateTurnScore(validation.words, placedTiles, board);
      
      return {
        word,
        tiles: placedTiles,
        score: scoreResult.totalScore,
        row: startRow,
        col: startCol,
        direction
      };
    } catch (error) {
      return null;
    }
  }

  private generateExchange(tiles: Tile[]): AIMove {
    // Exchange 3-5 low-value tiles
    const sortedTiles = tiles.sort((a, b) => a.value - b.value);
    const exchangeCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), tiles.length);
    const tilesToExchange = sortedTiles.slice(0, exchangeCount);
    
    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }
}

export const fastAIService = new FastAIService();
