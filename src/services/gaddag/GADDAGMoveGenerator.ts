/**
 * GADDAG Move Generator Implementation
 * Based on Steven Gordon's "A Faster Scrabble Move Generation Algorithm"
 * 
 * This is the core move generation engine that uses the GADDAG structure
 * to efficiently find all valid Scrabble moves for a given board position.
 */

import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../../types/game';
import { GADDAGNode } from './GADDAGNode';
import { GADDAGBuilder } from './GADDAGBuilder';
import { BOARD_SIZE } from '../../constants/board';
import { calculateTurnScore } from '../scoreCalculator';
import { validateMove } from '../wordValidator';

/**
 * Represents an anchor point on the board where words can be placed
 */
export interface AnchorPoint {
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  crossWordConstraints: Set<string>;
  leftLimit: number;
  rightLimit: number;
  strategicValue: number;
}

/**
 * Represents a potential move candidate
 */
export interface MoveCandidate {
  word: string;
  tiles: PlacedTile[];
  score: number;
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  usesBlank: boolean;
  anchorPoint: AnchorPoint;
}

/**
 * Configuration for move generation
 */
export interface MoveGenerationConfig {
  maxCandidates: number;
  timeLimit: number;
  enablePruning: boolean;
  minScore: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
}

/**
 * GADDAG-based move generator
 */
export class GADDAGMoveGenerator {
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

  /**
   * Initialize the GADDAG structure
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔧 Initializing GADDAG Move Generator...');
    const startTime = Date.now();

    try {
      this.gaddag = await this.builder.buildFromDictionary();
      this.isInitialized = true;
      
      const elapsedTime = Date.now() - startTime;
      console.log(`✅ GADDAG Move Generator initialized in ${elapsedTime}ms`);
      
      // Validate the GADDAG
      if (!this.builder.validateGADDAG(this.gaddag)) {
        throw new Error('GADDAG validation failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize GADDAG Move Generator:', error);
      throw error;
    }
  }

  /**
   * Generate all possible moves for a player
   */
  async generateMoves(
    gameState: GameState, 
    playerId: string, 
    config: Partial<MoveGenerationConfig> = {}
  ): Promise<MoveCandidate[]> {
    if (!this.isInitialized || !this.gaddag) {
      await this.initialize();
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }

    const fullConfig: MoveGenerationConfig = {
      maxCandidates: 100,
      timeLimit: 5000, // 5 seconds
      enablePruning: true,
      minScore: 0,
      difficulty: 'MEDIUM',
      ...config
    };

    console.log(`🎯 Generating moves for ${player.name} with ${player.tiles.length} tiles`);
    const startTime = Date.now();

    try {
      // Step 1: Find all anchor points
      const anchors = this.findAnchorPoints(gameState.board);
      console.log(`📍 Found ${anchors.length} anchor points`);

      // Step 2: Generate moves for each anchor using proper GADDAG algorithm
      const candidates: MoveCandidate[] = [];
      
      for (const anchor of anchors) {
        if (Date.now() - startTime > fullConfig.timeLimit) {
          console.log('⏰ Time limit reached, stopping move generation');
          break;
        }

        const anchorMoves = await this.generateMovesAtAnchor(
          anchor, 
          gameState.board, 
          player.tiles, 
          fullConfig
        );
        
        candidates.push(...anchorMoves);

        // Pruning: keep only top candidates during generation
        if (fullConfig.enablePruning && candidates.length > fullConfig.maxCandidates * 2) {
          candidates.sort((a, b) => b.score - a.score);
          candidates.splice(fullConfig.maxCandidates);
        }
      }

      // Step 3: Final sorting and filtering
      const finalCandidates = candidates
        .filter(move => move.score >= fullConfig.minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, fullConfig.maxCandidates);

      const elapsedTime = Date.now() - startTime;
      console.log(`🎯 Generated ${finalCandidates.length} moves in ${elapsedTime}ms`);

      return finalCandidates;

    } catch (error) {
      console.error('❌ Move generation failed:', error);
      return [];
    }
  }

  /**
   * Find all anchor points on the board
   */
  private findAnchorPoints(board: BoardCell[][]): AnchorPoint[] {
    const anchors: AnchorPoint[] = [];
    const hasExistingTiles = board.some(row => row.some(cell => cell.tile));

    if (!hasExistingTiles) {
      // First move - center position only
      return [
        {
          row: 7,
          col: 7,
          direction: 'HORIZONTAL',
          crossWordConstraints: new Set(),
          leftLimit: 7,
          rightLimit: 7,
          strategicValue: 10
        },
        {
          row: 7,
          col: 7,
          direction: 'VERTICAL',
          crossWordConstraints: new Set(),
          leftLimit: 7,
          rightLimit: 7,
          strategicValue: 10
        }
      ];
    }

    // Find all empty squares adjacent to existing tiles
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col].tile) continue;

        const isAdjacent = this.isAdjacentToTile(row, col, board);
        if (!isAdjacent) continue;

        // Add horizontal anchor
        const hConstraints = this.getCrossWordConstraints(row, col, 'VERTICAL', board);
        const hLimits = this.calculateLimits(row, col, 'HORIZONTAL', board);
        
        if (hLimits.leftLimit + hLimits.rightLimit >= 1) {
          anchors.push({
            row,
            col,
            direction: 'HORIZONTAL',
            crossWordConstraints: hConstraints,
            leftLimit: hLimits.leftLimit,
            rightLimit: hLimits.rightLimit,
            strategicValue: this.calculateStrategicValue(row, col, board)
          });
        }

        // Add vertical anchor
        const vConstraints = this.getCrossWordConstraints(row, col, 'HORIZONTAL', board);
        const vLimits = this.calculateLimits(row, col, 'VERTICAL', board);
        
        if (vLimits.leftLimit + vLimits.rightLimit >= 1) {
          anchors.push({
            row,
            col,
            direction: 'VERTICAL',
            crossWordConstraints: vConstraints,
            leftLimit: vLimits.leftLimit,
            rightLimit: vLimits.rightLimit,
            strategicValue: this.calculateStrategicValue(row, col, board)
          });
        }
      }
    }

    // Sort by strategic value
    return anchors.sort((a, b) => b.strategicValue - a.strategicValue);
  }

  /**
   * Generate moves at a specific anchor point using proper GADDAG algorithm
   */
  private async generateMovesAtAnchor(
    anchor: AnchorPoint,
    board: BoardCell[][],
    tiles: Tile[],
    config: MoveGenerationConfig
  ): Promise<MoveCandidate[]> {
    if (!this.gaddag) return [];

    const candidates: MoveCandidate[] = [];
    const rack = this.createTileRack(tiles);
    
    // Check if this is the first move
    const isFirstMove = !board.some(row => row.some(cell => cell.tile));
    
    if (isFirstMove) {
      // First move: generate words that pass through center
      await this.generateFirstMoveWords(anchor, board, rack, candidates);
    } else {
      // Subsequent moves: use proper GADDAG left-part/right-part generation
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

    return candidates;
  }

  /**
   * Generate words for the first move (must pass through center)
   */
  private async generateFirstMoveWords(
    anchor: AnchorPoint,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[]
  ): Promise<void> {
    if (!this.gaddag) return;

    // For first move, try different word lengths that pass through center (7,7)
    const maxLength = Math.min(7, Array.from(rack.values()).reduce((a, b) => a + b, 0));
    
    for (let wordLength = 2; wordLength <= maxLength; wordLength++) {
      // Try different positions where the word passes through center
      for (let centerOffset = 0; centerOffset < wordLength; centerOffset++) {
        let startRow: number, startCol: number;
        
        if (anchor.direction === 'HORIZONTAL') {
          startRow = 7;
          startCol = 7 - centerOffset;
          
          // Check bounds
          if (startCol < 0 || startCol + wordLength > BOARD_SIZE) continue;
        } else {
          startRow = 7 - centerOffset;
          startCol = 7;
          
          // Check bounds
          if (startRow < 0 || startRow + wordLength > BOARD_SIZE) continue;
        }

        // Generate words at this position using GADDAG traversal
        await this.traverseGADDAGForFirstMove(
          this.gaddag,
          '',
          startRow,
          startCol,
          anchor.direction,
          wordLength,
          board,
          rack,
          candidates,
          0
        );
      }
    }
  }

  /**
   * Traverse GADDAG for first move word generation
   */
  private async traverseGADDAGForFirstMove(
    node: GADDAGNode,
    currentWord: string,
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    targetLength: number,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    position: number
  ): Promise<void> {
    // Check if we have a valid word
    if (position >= 2 && position <= targetLength && node.isEndOfWord) {
      const passesThroughCenter = this.wordPassesThroughCenter(
        startRow, startCol, direction, currentWord.length
      );
      
      if (passesThroughCenter) {
        const move = await this.createMoveCandidate(
          currentWord,
          {
            row: startRow,
            col: startCol,
            direction,
            crossWordConstraints: new Set(),
            leftLimit: 0,
            rightLimit: 0,
            strategicValue: 1
          },
          board,
          rack,
          startRow,
          startCol
        );
        
        if (move) {
          candidates.push(move);
        }
      }
    }

    // If we've reached target length, stop
    if (position >= targetLength) {
      return;
    }

    // Try each letter from our rack
    for (const [letter, count] of rack.entries()) {
      if (letter === '?' || count <= 0) continue;

      // Check if this letter can extend the current GADDAG node
      const childNode = node.getChild(letter);
      if (!childNode) continue;

      // Calculate position for this letter
      const row = direction === 'VERTICAL' ? startRow + position : startRow;
      const col = direction === 'HORIZONTAL' ? startCol + position : startCol;

      // Check bounds
      if (row >= BOARD_SIZE || col >= BOARD_SIZE) continue;

      // Use this letter and recurse
      const newRack = new Map(rack);
      newRack.set(letter, count - 1);
      
      await this.traverseGADDAGForFirstMove(
        childNode,
        currentWord + letter,
        startRow,
        startCol,
        direction,
        targetLength,
        board,
        newRack,
        candidates,
        position + 1
      );
    }
  }

  /**
   * Generate the left part of words using proper GADDAG algorithm
   * This is the core of the GADDAG move generation algorithm
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
      anchor.col,
      true // we're at the anchor
    );

    // If we can still go left and have letters available
    if (limit > 0) {
      // Try each letter in our rack
      for (const [letter, count] of rack.entries()) {
        if (letter === '?' || count <= 0) continue;

        // Check if this letter can extend the current node
        const childNode = node.getChild(letter);
        if (!childNode) continue;

        // Calculate position for this letter (to the left of anchor)
        const newRow = anchor.direction === 'VERTICAL' ? anchor.row - partialWord.length - 1 : anchor.row;
        const newCol = anchor.direction === 'HORIZONTAL' ? anchor.col - partialWord.length - 1 : anchor.col;
        
        // Check bounds
        if (newRow < 0 || newCol < 0 || newRow >= BOARD_SIZE || newCol >= BOARD_SIZE) continue;

        // Check if position is empty or has the required letter
        if (!board[newRow][newCol].tile) {
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
        } else if (board[newRow][newCol].tile!.letter === letter) {
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
   * Extend right from the anchor position using GADDAG
   */
  private async extendRight(
    leftPart: string,
    node: GADDAGNode,
    anchor: AnchorPoint,
    board: BoardCell[][],
    rack: Map<string, number>,
    candidates: MoveCandidate[],
    currentRow: number,
    currentCol: number,
    atAnchor: boolean = false
  ): Promise<void> {
    // Check if we have a complete word
    if (leftPart.length > 0 && node.isEndOfWord) {
      // Create move candidate
      const word = leftPart;
      const startRow = anchor.direction === 'VERTICAL' ? currentRow - leftPart.length + 1 : currentRow;
      const startCol = anchor.direction === 'HORIZONTAL' ? currentCol - leftPart.length + 1 : currentCol;
      
      const move = await this.createMoveCandidate(
        word, anchor, board, rack, startRow, startCol
      );
      
      if (move) {
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
          nextCol,
          false
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
        nextCol,
        false
      );
    }
  }

  /**
   * Check if placing a letter creates valid cross-words
   */
  private isValidCrossWord(
    row: number,
    col: number,
    letter: string,
    mainDirection: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][]
  ): boolean {
    // Check perpendicular direction
    const perpDirection = mainDirection === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';
    
    // Build the cross-word that would be formed
    let crossWord = '';
    let hasAdjacentTiles = false;

    if (perpDirection === 'VERTICAL') {
      // Check above
      let r = row - 1;
      while (r >= 0 && board[r][col].tile) {
        crossWord = board[r][col].tile!.letter + crossWord;
        hasAdjacentTiles = true;
        r--;
      }
      
      // Add our letter
      crossWord += letter;
      
      // Check below
      r = row + 1;
      while (r < BOARD_SIZE && board[r][col].tile) {
        crossWord += board[r][col].tile!.letter;
        hasAdjacentTiles = true;
        r++;
      }
    } else {
      // Check left
      let c = col - 1;
      while (c >= 0 && board[row][c].tile) {
        crossWord = board[row][c].tile!.letter + crossWord;
        hasAdjacentTiles = true;
        c--;
      }
      
      // Add our letter
      crossWord += letter;
      
      // Check right
      c = col + 1;
      while (c < BOARD_SIZE && board[row][c].tile) {
        crossWord += board[row][c].tile!.letter;
        hasAdjacentTiles = true;
        c++;
      }
    }

    // If no adjacent tiles, no cross-word constraint
    if (!hasAdjacentTiles) return true;

    // If cross-word is formed, it must be valid
    if (crossWord.length > 1) {
      return this.isValidWord(crossWord);
    }

    return true;
  }

  /**
   * Check if a word exists in the GADDAG
   */
  private isValidWord(word: string): boolean {
    if (!this.gaddag || word.length < 2) return false;

    // Traverse GADDAG to check if word exists
    let node = this.gaddag;
    
    for (const letter of word) {
      const child = node.getChild(letter);
      if (!child) return false;
      node = child;
    }
    
    return node.isEndOfWord;
  }

  /**
   * Check if a word placement passes through the center square
   */
  private wordPassesThroughCenter(
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    wordLength: number
  ): boolean {
    const centerRow = 7;
    const centerCol = 7;

    if (direction === 'HORIZONTAL') {
      return startRow === centerRow && 
             startCol <= centerCol && 
             startCol + wordLength > centerCol;
    } else {
      return startCol === centerCol && 
             startRow <= centerRow && 
             startRow + wordLength > centerRow;
    }
  }

  /**
   * Create a move candidate from a word placement
   */
  private async createMoveCandidate(
    word: string,
    anchor: AnchorPoint,
    board: BoardCell[][],
    originalRack: Map<string, number>,
    startRow: number,
    startCol: number
  ): Promise<MoveCandidate | null> {
    try {
      // Validate bounds
      if (startRow < 0 || startCol < 0 || 
          startRow + (anchor.direction === 'VERTICAL' ? word.length - 1 : 0) >= BOARD_SIZE ||
          startCol + (anchor.direction === 'HORIZONTAL' ? word.length - 1 : 0) >= BOARD_SIZE) {
        return null;
      }

      // Create placed tiles
      const placedTiles: PlacedTile[] = [];
      const usedTiles = new Map<string, number>();
      let usesBlank = false;
      let tilesFromRack = 0;

      for (let i = 0; i < word.length; i++) {
        const row = anchor.direction === 'VERTICAL' ? startRow + i : startRow;
        const col = anchor.direction === 'HORIZONTAL' ? startCol + i : startCol;
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

      // Calculate score
      let score = 0;
      for (const placedTile of placedTiles) {
        score += placedTile.tile.value;
      }
      
      // Basic scoring - this should be enhanced with proper Scrabble scoring
      if (tilesFromRack === 7) {
        score += 50; // Bingo bonus
      }

      return {
        word,
        tiles: placedTiles,
        score,
        row: startRow,
        col: startCol,
        direction: anchor.direction,
        usesBlank,
        anchorPoint: anchor
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

  private getCrossWordConstraints(
    row: number, 
    col: number, 
    direction: 'HORIZONTAL' | 'VERTICAL', 
    board: BoardCell[][]
  ): Set<string> {
    const constraints = new Set<string>();
    
    // Check perpendicular direction for existing letters
    if (direction === 'HORIZONTAL') {
      // Check above and below
      if ((row > 0 && board[row - 1][col].tile) || (row < BOARD_SIZE - 1 && board[row + 1][col].tile)) {
        constraints.add('CROSS_WORD');
      }
    } else {
      // Check left and right
      if ((col > 0 && board[row][col - 1].tile) || (col < BOARD_SIZE - 1 && board[row][col + 1].tile)) {
        constraints.add('CROSS_WORD');
      }
    }
    
    return constraints;
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

  private calculateStrategicValue(row: number, col: number, board: BoardCell[][]): number {
    let value = 0;
    
    // Premium square value
    const multiplier = board[row][col].multiplier;
    switch (multiplier) {
      case 'TRIPLE_WORD': value += 15; break;
      case 'DOUBLE_WORD': value += 10; break;
      case 'TRIPLE_LETTER': value += 5; break;
      case 'DOUBLE_LETTER': value += 3; break;
      case 'CENTER': value += 8; break;
      default: value += 1; break;
    }
    
    // Adjacent tile bonus
    const adjacentCount = this.countAdjacentTiles(row, col, board);
    value += adjacentCount * 2;
    
    return value;
  }

  private countAdjacentTiles(row: number, col: number, board: BoardCell[][]): number {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let count = 0;
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
        if (board[newRow][newCol].tile) {
          count++;
        }
      }
    }
    
    return count;
  }

  private getLetterValue(letter: string): number {
    const letterValues: Record<string, number> = {
      'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
      'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
      'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
    };
    return letterValues[letter.toUpperCase()] || 0;
  }

  /**
   * Get the current GADDAG statistics
   */
  getStatistics() {
    if (!this.gaddag) return null;
    return this.builder.getStatistics();
  }

  /**
   * Check if the generator is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.gaddag !== null;
  }
}

/**
 * Singleton instance
 */
export const gaddagMoveGenerator = new GADDAGMoveGenerator();
