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
      const dictPath = path.join(__dirname, 'gaddag', 'sowpods.txt');
      
      // Build GADDAG from dictionary
      console.time('GADDAG Build');
      this.gaddag = await buildGaddagFromFile(dictPath);
      console.timeEnd('GADDAG Build');
      console.log(`✅ GADDAG built with ${this.gaddag.size} nodes`);

      // Load dictionary as Set for Board class
      const fs = await import('fs/promises');
      const dictContent = await fs.readFile(dictPath, 'utf8');
      this.dictionary = new Set(
        dictContent.split(/\r?\n/).map(line => line.trim().toUpperCase()).filter(word => word)
      );
      console.log(`✅ Dictionary loaded with ${this.dictionary.size} words`);
    } catch (error) {
      console.error('💀 Failed to initialize GADDAG AI:', error);
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
      
      const placedTiles = await this.convertGaddagMoveToPlacedTiles(bestMove, player.tiles);
      
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
    
    // Collect all existing tiles to place as a single word
    const existingTiles: { row: number; col: number; letter: string }[] = [];
    
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = gameBoard[row][col];
        if (cell.tile) {
          existingTiles.push({
            row,
            col,
            letter: cell.tile.letter.toUpperCase()
          });
        }
      }
    }
    
    // Place existing tiles using the board's place method
    // Group tiles by words (horizontal and vertical sequences)
    const placedPositions = new Set<string>();
    
    for (const tile of existingTiles) {
      const posKey = `${tile.row}-${tile.col}`;
      if (placedPositions.has(posKey)) continue;
      
      // Try to find horizontal word starting from this position
      const hWord = this.findWordFromPosition(tile.row, tile.col, 'H', existingTiles);
      if (hWord.length > 1) {
        const codes = hWord.map(t => t.letter.charCodeAt(0));
        board.place(hWord[0].row, hWord[0].col, 'H', codes);
        hWord.forEach(t => placedPositions.add(`${t.row}-${t.col}`));
        continue;
      }
      
      // Try to find vertical word starting from this position
      const vWord = this.findWordFromPosition(tile.row, tile.col, 'V', existingTiles);
      if (vWord.length > 1) {
        const codes = vWord.map(t => t.letter.charCodeAt(0));
        board.place(vWord[0].row, vWord[0].col, 'V', codes);
        vWord.forEach(t => placedPositions.add(`${t.row}-${t.col}`));
        continue;
      }
      
      // Single tile - place as 1-letter word
      if (!placedPositions.has(posKey)) {
        const codes = [tile.letter.charCodeAt(0)];
        board.place(tile.row, tile.col, 'H', codes);
        placedPositions.add(posKey);
      }
    }
    
    return board;
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

  private async convertGaddagMoveToPlacedTiles(move: Move, playerTiles: Tile[]): Promise<PlacedTile[]> {
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
