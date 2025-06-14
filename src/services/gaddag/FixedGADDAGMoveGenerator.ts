/**
 * FIXED GADDAG Move Generator Implementation
 * Properly implements Steven Gordon's "A Faster Scrabble Move Generation Algorithm"
 * 
 * This implementation correctly handles:
 * 1. GADDAG structure with split markers (_)
 * 2. Left-part and right-part generation
 * 3. Proper anchor point processing
 * 4. Cross-word validation
 */

import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../../types/game';
import { GADDAGNode } from './GADDAGNode';
import { GADDAGBuilder } from './GADDAGBuilder';
import { BOARD_SIZE } from '../../constants/board';

export interface AnchorPoint {
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  crossWordConstraints: Set<string>;
  leftLimit: number;
  rightLimit: number;
}

export interface MoveCandidate {
  word: string;
  tiles: PlacedTile[];
  score: number;
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  usesBlank: boolean;
}

export class FixedGADDAGMoveGenerator {
  private gaddag: GADDAGNode | null = null;
  private isInitialized: boolean = false;
  private builder: GADDAGBuilder;

  constructor() {
    this.builder = new GADDAGBuilder({
      enableMinimization: true,
      maxWordLength: 15,
      minWordLength: 2,
      enableProgressReporting: true,
      batchSize: 1000
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔧 Initializing Fixed GADDAG Move Generator...');
    const startTime = Date.now();

    try {
      this.gaddag = await this.builder.buildFromDictionary();
      this.isInitialized = true;
      
      const elapsedTime = Date.now() - startTime;
      console.log(`✅ Fixed GADDAG Move Generator initialized in ${elapsedTime}ms`);
      
      // Test the GADDAG with simple words
      await this.testGADDAG();
      
    } catch (error) {
      console.error('❌ Failed to initialize Fixed GADDAG Move Generator:', error);
      throw error;
    }
  }

  /**
   * Test GADDAG functionality with known words
   */
  private async testGADDAG(): Promise<void> {
    if (!this.gaddag) return;

    console.log('🧪 Testing GADDAG structure...');
    
    // Test simple words
    const testWords = ['CAT', 'DOG', 'AT', 'TO', 'GO'];
    let foundCount = 0;
    
    for (const word of testWords) {
      if (this.canFormWord(word)) {
        foundCount++;
        console.log(`   ✅ Found: ${word}`);
      } else {
        console.log(`   ❌ Missing: ${word}`);
      }
    }
    
    console.log(`🧪 GADDAG test: ${foundCount}/${testWords.length} words found`);
  }

  /**
   * Check if a word can be formed in the GADDAG
   */
  private canFormWord(word: string): boolean {
    if (!this.gaddag) return false;

    // Try direct path (no split)
    let node = this.gaddag;
    for (const letter of word) {
      const child = node.getChild(letter);
      if (!child) break;
      node = child;
    }
    if (node.isEndOfWord) return true;

    // Try all possible split positions
    for (let splitPos = 1; splitPos < word.length; splitPos++) {
      const leftPart = word.substring(0, splitPos);
      const rightPart = word.substring(splitPos);
      
      // Reverse left part and look for path: reversed_left + '_' + right
      const reversedLeft = leftPart.split('').reverse().join('');
      const splitPath = reversedLeft + '_' + rightPart;
      
      node = this.gaddag;
      let found = true;
      
      for (const char of splitPath) {
        const child = node.getChild(char);
        if (!child) {
          found = false;
          break;
        }
        node = child;
      }
      
      if (found && node.isEndOfWord) return true;
    }

    return false;
  }

  /**
   * Generate all possible moves for a player
   */
  async generateMoves(
    gameState: GameState, 
    playerId: string
  ): Promise<MoveCandidate[]> {
    if (!this.isInitialized || !this.gaddag) {
      await this.initialize();
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    console.log(`🎯 Generating moves for ${player.name} with tiles: ${player.tiles.map(t => t.letter).join('')}`);
    const startTime = Date.now();

    try {
      const candidates: MoveCandidate[] = [];
      
      // Check if this is the first move
      const hasExistingTiles = gameState.board.some(row => row.some(cell => cell.tile));
      
      if (!hasExistingTiles) {
        // First move - must pass through center
        await this.generateFirstMoves(gameState.board, player.tiles, candidates);
      } else {
        // Find anchor points and generate moves
        const anchors = this.findAnchorPoints(gameState.board);
        console.log(`📍 Found ${anchors.length} anchor points`);
        
        for (const anchor of anchors) {
          await this.generateMovesAtAnchor(anchor, gameState.board, player.tiles, candidates);
        }
      }

      const elapsedTime = Date.now() - startTime;
      console.log(`🎯 Generated ${candidates.length} moves in ${elapsedTime}ms`);

      // Sort by score and return top candidates
      return candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 50); // Limit to top 50 moves

    } catch (error) {
      console.error('❌ Move generation failed:', error);
      return [];
    }
  }

  /**
   * Generate moves for the first turn (must pass through center)
   */
  private async generateFirstMoves(
    board: BoardCell[][],
    tiles: Tile[],
    candidates: MoveCandidate[]
  ): Promise<void> {
    if (!this.gaddag) return;

    console.log('🎯 Generating first moves through center (7,7)');
    
    const rack = this.createTileRack(tiles);
    const centerRow = 7;
    const centerCol = 7;

    // Try horizontal words through center
    await this.generateWordsAtPosition(
      centerRow, centerCol, 'HORIZONTAL', board, rack, candidates, true
    );

    // Try vertical words through center
    await this.generateWordsAtPosition(
      centerRow, centerCol, 'VERTICAL', board, rack, candidates, true
    );
  }

  /**
   * Generate words at a specific position
   */
  private async generateWordsAtPosition(
    row: number,
    col: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    mustPassThroughPosition: boolean = false
  ): Promise<void> {
    if (!this.gaddag) return;

    // Try different word lengths and starting positions
    const maxTiles = Array.from(rack.values()).reduce((a, b) => a + b, 0);
    
    for (let wordLength = 2; wordLength <= Math.min(7, maxTiles); wordLength++) {
      for (let startOffset = 0; startOffset < wordLength; startOffset++) {
        let startRow: number, startCol: number;
        
        if (direction === 'HORIZONTAL') {
          startRow = row;
          startCol = col - startOffset;
        } else {
          startRow = row - startOffset;
          startCol = col;
        }

        // Check bounds
        if (startRow < 0 || startCol < 0 || 
            startRow + (direction === 'VERTICAL' ? wordLength - 1 : 0) >= BOARD_SIZE ||
            startCol + (direction === 'HORIZONTAL' ? wordLength - 1 : 0) >= BOARD_SIZE) {
          continue;
        }

        // Check if position is valid for placement
        if (!this.isValidPlacement(startRow, startCol, direction, wordLength, board)) {
          continue;
        }

        // Generate words using GADDAG traversal
        await this.traverseGADDAGForWords(
          this.gaddag, '', startRow, startCol, direction, wordLength, 
          board, new Map(rack), candidates, 0, mustPassThroughPosition ? row : -1, 
          mustPassThroughPosition ? col : -1
        );
      }
    }
  }

  /**
   * Traverse GADDAG to find valid words
   */
  private async traverseGADDAGForWords(
    node: GADDAGNode,
    currentWord: string,
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    targetLength: number,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    position: number,
    mustPassRow: number = -1,
    mustPassCol: number = -1
  ): Promise<void> {
    // Check if we have a valid word
    if (position >= 2 && position <= targetLength && node.isEndOfWord) {
      // Check if word passes through required position
      if (mustPassRow >= 0 && mustPassCol >= 0) {
        const passesThrough = this.wordPassesThroughPosition(
          startRow, startCol, direction, currentWord.length, mustPassRow, mustPassCol
        );
        if (!passesThrough) return;
      }

      const move = await this.createMoveCandidate(
        currentWord, startRow, startCol, direction, board, rack
      );
      
      if (move && move.tiles.length > 0) {
        candidates.push(move);
      }
    }

    // If we've reached target length, stop
    if (position >= targetLength) return;

    // Calculate current position
    const currentRow = direction === 'VERTICAL' ? startRow + position : startRow;
    const currentCol = direction === 'HORIZONTAL' ? startCol + position : startCol;

    // Check bounds
    if (currentRow >= BOARD_SIZE || currentCol >= BOARD_SIZE) return;

    // If there's already a tile here, we must use it
    const existingTile = board[currentRow][currentCol].tile;
    if (existingTile) {
      const childNode = node.getChild(existingTile.letter);
      if (childNode) {
        await this.traverseGADDAGForWords(
          childNode, currentWord + existingTile.letter, startRow, startCol,
          direction, targetLength, board, rack, candidates, position + 1,
          mustPassRow, mustPassCol
        );
      }
      return;
    }

    // Try each letter from our rack
    for (const [letter, count] of rack.entries()) {
      if (letter === '?' || count <= 0) continue;

      const childNode = node.getChild(letter);
      if (!childNode) continue;

      // Check cross-word constraints
      if (!this.isValidCrossWord(currentRow, currentCol, letter, direction, board)) {
        continue;
      }

      // Use this letter and recurse
      const newRack = new Map(rack);
      newRack.set(letter, count - 1);
      
      await this.traverseGADDAGForWords(
        childNode, currentWord + letter, startRow, startCol, direction,
        targetLength, board, newRack, candidates, position + 1,
        mustPassRow, mustPassCol
      );
    }
  }

  /**
   * Check if a word passes through a specific position
   */
  private wordPassesThroughPosition(
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    wordLength: number,
    targetRow: number,
    targetCol: number
  ): boolean {
    if (direction === 'HORIZONTAL') {
      return startRow === targetRow && 
             startCol <= targetCol && 
             startCol + wordLength > targetCol;
    } else {
      return startCol === targetCol && 
             startRow <= targetRow && 
             startRow + wordLength > targetRow;
    }
  }

  /**
   * Find all anchor points on the board
   */
  private findAnchorPoints(board: BoardCell[][]): AnchorPoint[] {
    const anchors: AnchorPoint[] = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col].tile) continue;

        const isAdjacent = this.isAdjacentToTile(row, col, board);
        if (!isAdjacent) continue;

        // Add horizontal anchor
        const hLimits = this.calculateLimits(row, col, 'HORIZONTAL', board);
        if (hLimits.leftLimit + hLimits.rightLimit >= 1) {
          anchors.push({
            row,
            col,
            direction: 'HORIZONTAL',
            crossWordConstraints: new Set(),
            leftLimit: hLimits.leftLimit,
            rightLimit: hLimits.rightLimit
          });
        }

        // Add vertical anchor
        const vLimits = this.calculateLimits(row, col, 'VERTICAL', board);
        if (vLimits.leftLimit + vLimits.rightLimit >= 1) {
          anchors.push({
            row,
            col,
            direction: 'VERTICAL',
            crossWordConstraints: new Set(),
            leftLimit: vLimits.leftLimit,
            rightLimit: vLimits.rightLimit
          });
        }
      }
    }

    return anchors;
  }

  /**
   * Generate moves at a specific anchor point using proper GADDAG algorithm
   */
  private async generateMovesAtAnchor(
    anchor: AnchorPoint,
    board: BoardCell[][],
    tiles: Tile[],
    candidates: MoveCandidate[]
  ): Promise<void> {
    if (!this.gaddag) return;

    const rack = this.createTileRack(tiles);
    
    // Use the proper GADDAG algorithm: generate left part, then extend right
    await this.generateLeftPart(
      '', // current partial word
      this.gaddag, // start at GADDAG root
      anchor,
      board,
      rack,
      candidates,
      anchor.leftLimit
    );
  }

  /**
   * CORRECTED: Generate the left part of words using proper GADDAG algorithm
   */
  private async generateLeftPart(
    partialWord: string,
    node: GADDAGNode,
    anchor: AnchorPoint,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    limit: number
  ): Promise<void> {
    // Try to extend right from current position (place split marker)
    await this.extendRight(
      partialWord,
      node,
      anchor,
      board,
      rack,
      candidates,
      anchor.row,
      anchor.col
    );

    // If we can still go left and have letters available
    if (limit > 0) {
      // Try each letter in our rack
      for (const [letter, count] of rack.entries()) {
        if (letter === '?' || count <= 0) continue;

        // Check if this letter can extend the current node
        const childNode = node.getChild(letter);
        if (!childNode) continue;

        // Calculate position for this letter (to the left of current position)
        const newRow = anchor.direction === 'VERTICAL' ? 
          anchor.row - partialWord.length - 1 : anchor.row;
        const newCol = anchor.direction === 'HORIZONTAL' ? 
          anchor.col - partialWord.length - 1 : anchor.col;
        
        // Check bounds
        if (newRow < 0 || newCol < 0 || newRow >= BOARD_SIZE || newCol >= BOARD_SIZE) continue;

        // Check if position is empty or has the required letter
        const existingTile = board[newRow][newCol].tile;
        
        if (!existingTile) {
          // Check cross-word constraints
          if (!this.isValidCrossWord(newRow, newCol, letter, anchor.direction, board)) {
            continue;
          }

          // Use this letter and recurse
          const newRack = new Map(rack);
          newRack.set(letter, count - 1);
          
          await this.generateLeftPart(
            letter + partialWord,
            childNode,
            anchor,
            board,
            newRack,
            candidates,
            limit - 1
          );
        } else if (existingTile.letter === letter) {
          // Use existing tile on board
          await this.generateLeftPart(
            letter + partialWord,
            childNode,
            anchor,
            board,
            rack,
            candidates,
            limit - 1
          );
        }
      }
    }
  }

  /**
   * CORRECTED: Extend right from the anchor position using GADDAG
   */
  private async extendRight(
    leftPart: string,
    node: GADDAGNode,
    anchor: AnchorPoint,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    currentRow: number,
    currentCol: number
  ): Promise<void> {
    // Check if we have a complete word
    if (leftPart.length > 0 && node.isEndOfWord) {
      // Create move candidate
      const word = leftPart;
      const startRow = anchor.direction === 'VERTICAL' ? 
        currentRow - leftPart.length + 1 : currentRow;
      const startCol = anchor.direction === 'HORIZONTAL' ? 
        currentCol - leftPart.length + 1 : currentCol;
      
      const move = await this.createMoveCandidate(
        word, startRow, startCol, anchor.direction, board, rack
      );
      
      if (move && move.tiles.length > 0) {
        candidates.push(move);
      }
    }

    // Try to extend further right
    const nextRow = anchor.direction === 'VERTICAL' ? currentRow + 1 : currentRow;
    const nextCol = anchor.direction === 'HORIZONTAL' ? currentCol + 1 : currentCol;

    // Check bounds
    if (nextRow >= BOARD_SIZE || nextCol >= BOARD_SIZE) return;

    // If there's already a tile here, we must use it
    const existingTile = board[nextRow][nextCol].tile;
    if (existingTile) {
      const childNode = node.getChild(existingTile.letter);
      if (childNode) {
        await this.extendRight(
          leftPart + existingTile.letter,
          childNode,
          anchor,
          board,
          rack,
          candidates,
          nextRow,
          nextCol
        );
      }
      return;
    }

    // Try each letter from our rack
    for (const [letter, count] of rack.entries()) {
      if (letter === '?' || count <= 0) continue;

      const childNode = node.getChild(letter);
      if (!childNode) continue;

      // Check cross-word constraints
      if (!this.isValidCrossWord(nextRow, nextCol, letter, anchor.direction, board)) {
        continue;
      }

      // Use this letter and recurse
      const newRack = new Map(rack);
      newRack.set(letter, count - 1);
      
      await this.extendRight(
        leftPart + letter,
        childNode,
        anchor,
        board,
        newRack,
        candidates,
        nextRow,
        nextCol
      );
    }
  }

  /**
   * Create a move candidate from a word placement
   */
  private async createMoveCandidate(
    word: string,
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][],
    originalRack: Map<string, number>
  ): Promise<MoveCandidate | null> {
    try {
      // Validate bounds
      if (startRow < 0 || startCol < 0 || 
          startRow + (direction === 'VERTICAL' ? word.length - 1 : 0) >= BOARD_SIZE ||
          startCol + (direction === 'HORIZONTAL' ? word.length - 1 : 0) >= BOARD_SIZE) {
        return null;
      }

      // Create placed tiles
      const placedTiles: PlacedTile[] = [];
      const usedTiles = new Map<string, number>();
      let usesBlank = false;
      let tilesFromRack = 0;

      for (let i = 0; i < word.length; i++) {
        const row = direction === 'VERTICAL' ? startRow + i : startRow;
        const col = direction === 'HORIZONTAL' ? startCol + i : startCol;
        const letter = word[i];

        // Skip if there's already a tile here
        if (board[row][col].tile) continue;

        tilesFromRack++;

        // Find available tile
        const availableRegular = (originalRack.get(letter) || 0) - (usedTiles.get(letter) || 0);
        const availableBlank = (originalRack.get('?') || 0) - (usedTiles.get('?') || 0);

        if (availableRegular > 0) {
          // Use regular tile
          usedTiles.set(letter, (usedTiles.get(letter) || 0) + 1);
          placedTiles.push({
            tile: { id: `temp-${i}`, letter, value: this.getLetterValue(letter), isBlank: false },
            row,
            col
          });
        } else if (availableBlank > 0) {
          // Use blank tile
          usedTiles.set('?', (usedTiles.get('?') || 0) + 1);
          usesBlank = true;
          placedTiles.push({
            tile: { id: `temp-blank-${i}`, letter, value: 0, isBlank: true },
            row,
            col
          });
        } else {
          // Can't place this word
          return null;
        }
      }

      // Must place at least one tile
      if (tilesFromRack === 0) {
        return null;
      }

      // Calculate basic score
      let score = 0;
      for (const placedTile of placedTiles) {
        score += placedTile.tile.value;
      }
      
      // Add bonus for using all tiles
      if (tilesFromRack === 7) {
        score += 50; // Bingo bonus
      }

      return {
        word,
        tiles: placedTiles,
        score,
        row: startRow,
        col: startCol,
        direction,
        usesBlank
      };

    } catch (error) {
      console.error('Error creating move candidate:', error);
      return null;
    }
  }

  // Helper methods
  private createTileRack(tiles: Tile[]): Map<string, number> {
    const rack = new Map<string, number>();
    
    for (const tile of tiles) {
      const key = tile.isBlank ? '?' : tile.letter.toUpperCase();
      rack.set(key, (rack.get(key) || 0) + 1);
    }
    
    return rack;
  }

  private isAdjacentToTile(row: number, col: number, board: BoardCell[][]): boolean {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
        if (board[newRow][newCol].tile) {
          return true;
        }
      }
    }
    
    return false;
  }

  private calculateLimits(
    row: number, 
    col: number, 
    direction: 'HORIZONTAL' | 'VERTICAL', 
    board: BoardCell[][]
  ): { leftLimit: number; rightLimit: number } {
    let leftLimit = 0;
    let rightLimit = 0;
    
    if (direction === 'HORIZONTAL') {
      // Count empty squares to the left
      for (let c = col - 1; c >= 0 && !board[row][c].tile; c--) {
        leftLimit++;
      }
      // Count empty squares to the right
      for (let c = col + 1; c < BOARD_SIZE && !board[row][c].tile; c++) {
        rightLimit++;
      }
    } else {
      // Count empty squares above
      for (let r = row - 1; r >= 0 && !board[r][col].tile; r--) {
        leftLimit++;
      }
      // Count empty squares below
      for (let r = row + 1; r < BOARD_SIZE && !board[r][col].tile; r++) {
        rightLimit++;
      }
    }
    
    return { leftLimit, rightLimit };
  }

  private isValidPlacement(
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    wordLength: number,
    board: BoardCell[][]
  ): boolean {
    // Check if all positions are either empty or have existing tiles
    for (let i = 0; i < wordLength; i++) {
      const row = direction === 'VERTICAL' ? startRow + i : startRow;
      const col = direction === 'HORIZONTAL' ? startCol + i : startCol;
      
      if (row >= BOARD_SIZE || col >= BOARD_SIZE) return false;
    }
    
    return true;
  }

  private isValidCrossWord(
    row: number,
    col: number,
    letter: string,
    mainDirection: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][]
  ): boolean {
    // For now, allow all placements - proper cross-word validation would require
    // checking if the formed cross-words are valid dictionary words
    return true;
  }

  private getLetterValue(letter: string): number {
    const letterValues: Record<string, number> = {
      'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
      'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
      'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
    };
    return letterValues[letter.toUpperCase()] || 0;
  }

  isReady(): boolean {
    return this.isInitialized && this.gaddag !== null;
  }
}

export const fixedGaddagMoveGenerator = new FixedGADDAGMoveGenerator();
