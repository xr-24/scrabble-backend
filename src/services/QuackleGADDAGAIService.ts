import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../types/game';
import { dictionaryService } from './dictionaryService';
import { calculateTurnScore } from './scoreCalculator';
import { validateMove } from './wordValidator';
import { BOARD_SIZE } from '../constants/board';
import { Gaddag, buildGaddagFromFile } from './gaddag/gaddag';
import { Board } from './gaddag/board';
import { Move } from './gaddag/generator';
import path from 'path';

// Professional AI demon names
const DEMON_NAMES = [
  'Baal', 'Agares', 'Vassago', 'Samigina', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
  'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos', 'Zepar',
  'Botis', 'Bathin', 'Sallos', 'Purson', 'Marax', 'Ipos', 'Aim', 'Naberius'
];

interface AIMove {
  type: 'WORD' | 'EXCHANGE' | 'PASS';
  tiles?: PlacedTile[];
  exchangeTileIds?: string[];
}

export class QuackleGADDAGAIService {
  private usedDemonNames: Set<string> = new Set();
  private gaddag: Gaddag | null = null;
  private dictionary: Set<string> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('🔥 Initializing Quackle GADDAG AI Service...');
      
      // Wait for dictionary service to be ready
      await dictionaryService.loadDictionary();
      
      // Build GADDAG from dictionary service's internal word set
      console.time('GADDAG Build');
      this.gaddag = await this.buildGaddagFromDictionaryService();
      console.timeEnd('GADDAG Build');
      console.log(`✅ GADDAG built with ${this.gaddag.size} nodes`);

      // Create dictionary set for Board class
      this.dictionary = await this.getDictionarySet();
      console.log(`✅ Dictionary loaded with ${this.dictionary.size} words`);
    } catch (error) {
      console.error('💀 Failed to initialize GADDAG AI:', error);
      throw error;
    }
  }

  private async buildGaddagFromDictionaryService(): Promise<Gaddag> {
    const gaddag = new Gaddag();
    
    // We need to access the dictionary service's internal word set
    // Since it doesn't expose getAllWords(), we'll build it by testing common words
    // or use a fallback approach
    try {
      // Try to load from the same source as dictionary service
      const fs = await import('fs');
      const path = await import('path');
      
      // Try local file first
      const localPath = path.join(process.cwd(), 'public', 'sowpods.txt');
      if (fs.existsSync(localPath)) {
        const content = fs.readFileSync(localPath, 'utf8');
        const words = content.trim().split('\n').map(word => word.trim().toUpperCase());
        for (const word of words) {
          if (word) gaddag.addWord(word);
        }
        return gaddag;
      }
    } catch (error) {
      console.log('Local file approach failed, trying remote...');
    }

    // Fallback: download the same dictionary
    try {
      const response = await fetch('https://www.wordgamedictionary.com/sowpods/download/sowpods.txt');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      const words = content.trim().split('\n').map(word => word.trim().toUpperCase());
      for (const word of words) {
        if (word) gaddag.addWord(word);
      }
      return gaddag;
    } catch (error) {
      console.error('Failed to build GADDAG:', error);
      throw error;
    }
  }

  private async getDictionarySet(): Promise<Set<string>> {
    try {
      // Try local file first
      const fs = await import('fs');
      const path = await import('path');
      
      const localPath = path.join(process.cwd(), 'public', 'sowpods.txt');
      if (fs.existsSync(localPath)) {
        const content = fs.readFileSync(localPath, 'utf8');
        return new Set(content.trim().split('\n').map(word => word.trim().toUpperCase()));
      }
    } catch (error) {
      console.log('Local file approach failed for dictionary set...');
    }

    // Fallback: download dictionary
    try {
      const response = await fetch('https://www.wordgamedictionary.com/sowpods/download/sowpods.txt');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      return new Set(content.trim().split('\n').map((word: string) => word.trim().toUpperCase()));
    } catch (error) {
      console.error('Failed to load dictionary set:', error);
      throw error;
    }
  }

  generateDemonName(): string {
    const availableNames = DEMON_NAMES.filter(name => !this.usedDemonNames.has(name));
    
    if (availableNames.length === 0) {
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
    // Ensure initialization is complete
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.error(`AI player ${playerId} not found`);
      return { type: 'PASS' };
    }

    if (!this.gaddag || !this.dictionary) {
      console.error('GADDAG or dictionary not initialized');
      return { type: 'PASS' };
    }

    console.log(`🎯 ${player.name} analyzing board with GADDAG...`);
    const startTime = Date.now();
    
    try {
      // Convert game board to GADDAG board format
      const gaddagBoard = this.convertToGaddagBoard(gameState.board);
      
      // Convert player tiles to rack string
      const rack = this.convertTilesToRack(player.tiles);
      
      // Generate moves using GADDAG
      const moves = gaddagBoard.generateMoves(rack, this.gaddag);
      
      if (moves.length === 0) {
        console.log(`🔄 ${player.name} exchanges tiles strategically`);
        return this.generateStrategicExchange(player.tiles);
      }

      // Convert best GADDAG move to game format
      const bestMove = moves[0]; // Already sorted by equity
      const elapsedTime = Date.now() - startTime;
      
      console.log(`⚡ ${player.name} plays "${bestMove.word}" for ${bestMove.score} points (equity: ${bestMove.equity}) (${elapsedTime}ms)`);
      
      const placedTiles = await this.convertGaddagMoveToPlacedTiles(bestMove, player.tiles, gameState.board);
      
      return {
        type: 'WORD',
        tiles: placedTiles
      };
    } catch (error) {
      console.error(`💀 ${player.name} GADDAG AI error:`, error);
      return { type: 'PASS' };
    }
  }

  private convertToGaddagBoard(gameBoard: BoardCell[][]): Board {
    if (!this.dictionary) {
      throw new Error('Dictionary not initialized');
    }

    const board = new Board(this.dictionary);
    
    // Simply place each tile individually - the Board class will handle cross-checks
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameBoard[row][col];
        if (cell.tile) {
          const letter = cell.tile.letter.toUpperCase();
          const code = letter.charCodeAt(0);
          board.set(row, col, code);
        }
      }
    }
    
    // Force a full recompute to set up cross-checks properly
    // We need to access the private method, so we'll use a workaround
    // by creating a new board and copying the tiles
    const freshBoard = new Board(this.dictionary);
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameBoard[row][col];
        if (cell.tile) {
          const letter = cell.tile.letter.toUpperCase();
          const code = letter.charCodeAt(0);
          freshBoard.set(row, col, code);
        }
      }
    }
    
    // Use the place method to trigger proper cross-check updates
    // Place tiles one by one to ensure proper cross-check computation
    const finalBoard = new Board(this.dictionary);
    const placedTiles: { row: number; col: number; code: number }[] = [];
    
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameBoard[row][col];
        if (cell.tile) {
          const letter = cell.tile.letter.toUpperCase();
          const code = letter.charCodeAt(0);
          placedTiles.push({ row, col, code });
        }
      }
    }
    
    // Place tiles in order to trigger incremental updates
    for (const { row, col, code } of placedTiles) {
      finalBoard.place(row, col, 'H', [code]);
    }
    
    return finalBoard;
  }

  private findWordFromPosition(
    startRow: number, 
    startCol: number, 
    direction: 'H' | 'V', 
    allTiles: { row: number; col: number; letter: string }[]
  ): { row: number; col: number; letter: string }[] {
    const word: { row: number; col: number; letter: string }[] = [];
    const tileMap = new Map<string, { row: number; col: number; letter: string }>();
    
    // Create position map for quick lookup
    allTiles.forEach(tile => {
      tileMap.set(`${tile.row}-${tile.col}`, tile);
    });
    
    const [dr, dc] = direction === 'H' ? [0, 1] : [1, 0];
    
    // Find the actual start of the word (go backwards first)
    let currentRow = startRow;
    let currentCol = startCol;
    
    while (currentRow >= 0 && currentCol >= 0 && 
           currentRow < BOARD_SIZE && currentCol < BOARD_SIZE) {
      const prevRow = currentRow - dr;
      const prevCol = currentCol - dc;
      const prevKey = `${prevRow}-${prevCol}`;
      
      if (prevRow >= 0 && prevCol >= 0 && 
          prevRow < BOARD_SIZE && prevCol < BOARD_SIZE && 
          tileMap.has(prevKey)) {
        currentRow = prevRow;
        currentCol = prevCol;
      } else {
        break;
      }
    }
    
    // Now collect the word going forward
    while (currentRow >= 0 && currentCol >= 0 && 
           currentRow < BOARD_SIZE && currentCol < BOARD_SIZE) {
      const key = `${currentRow}-${currentCol}`;
      const tile = tileMap.get(key);
      
      if (tile) {
        word.push(tile);
        currentRow += dr;
        currentCol += dc;
      } else {
        break;
      }
    }
    
    return word;
  }

  private convertTilesToRack(tiles: Tile[]): string {
    return tiles.map(tile => {
      if (tile.isBlank) {
        return '?'; // GADDAG uses ? for blank tiles
      }
      return tile.letter.toUpperCase();
    }).join('');
  }

  private async convertGaddagMoveToPlacedTiles(move: Move, playerTiles: Tile[], gameBoard: BoardCell[][]): Promise<PlacedTile[]> {
    const placedTiles: PlacedTile[] = [];
    const usedTileIds: string[] = [];
    
    // Parse the word and determine which tiles to place
    const word = move.word;
    const startRow = move.row;
    const startCol = move.col;
    const isHorizontal = move.dir === 'H';
    
    for (let i = 0; i < word.length; i++) {
      const row = isHorizontal ? startRow : startRow + i;
      const col = isHorizontal ? startCol + i : startCol;
      const letter = word[i].toUpperCase();
      
      // Skip if there's already a tile at this position
      if (gameBoard[row] && gameBoard[row][col] && gameBoard[row][col].tile) {
        continue;
      }
      
      // Find available tile for this letter
      let availableTile = playerTiles.find(t => 
        t.letter.toUpperCase() === letter && !usedTileIds.includes(t.id)
      );
      
      // Try using a blank tile if no regular tile available
      if (!availableTile) {
        availableTile = playerTiles.find(t => 
          t.isBlank && !usedTileIds.includes(t.id)
        );
      }
      
      if (availableTile) {
        placedTiles.push({
          tile: availableTile,
          row,
          col
        });
        usedTileIds.push(availableTile.id);
      }
    }
    
    return placedTiles;
  }

  private generateStrategicExchange(tiles: Tile[]): AIMove {
    // Keep high-value tiles and vowels, exchange low-value consonants
    const tileValues = tiles.map(t => ({ 
      tile: t, 
      value: t.value,
      isVowel: 'AEIOU'.includes(t.letter.toUpperCase())
    }));
    
    // Sort by strategic value (keep high-value tiles and vowels)
    tileValues.sort((a, b) => {
      if (a.isVowel !== b.isVowel) return a.isVowel ? 1 : -1; // Keep vowels
      return a.value - b.value; // Exchange low-value tiles first
    });
    
    // Exchange 3-5 lowest value tiles
    const exchangeCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), tiles.length);
    const tilesToExchange = tileValues.slice(0, exchangeCount).map(tv => tv.tile);
    
    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }
}

export const quackleGaddagAIService = new QuackleGADDAGAIService();
