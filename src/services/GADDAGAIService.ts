/**
 * GADDAG AI Service
 * Professional Scrabble AI using GADDAG algorithm for move generation
 * 
 * This service replaces the existing AI implementations with a GADDAG-based
 * approach that finds optimal moves efficiently and integrates with the
 * existing power-up system.
 */

import type { GameState, Player, Tile, PlacedTile } from '../types/game';
import { correctGADDAGMoveGenerator, resetCorrectGADDAG } from './gaddag/CorrectGADDAGImplementation';

// Define interfaces for compatibility
interface MoveCandidate {
  word: string;
  tiles: PlacedTile[];
  score: number;
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  usesBlank: boolean;
}

interface MoveGenerationConfig {
  maxCandidates: number;
  timeLimit: number;
  enablePruning: boolean;
  minScore: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
}

interface AIMove {
  type: 'WORD' | 'EXCHANGE' | 'PASS';
  tiles?: PlacedTile[];
  exchangeTileIds?: string[];
}

interface AIPersonality {
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  aggressiveness: number; // 0-1, affects risk-taking
  vocabulary: number; // 0-1, affects word knowledge
  strategy: 'OFFENSIVE' | 'DEFENSIVE' | 'BALANCED';
}

export class GADDAGAIService {
  private usedNames: Set<string> = new Set();
  
  // AI Personalities with different playing styles
  private readonly AI_PERSONALITIES: AIPersonality[] = [
    {
      name: 'Lexicon',
      difficulty: 'EXPERT',
      aggressiveness: 0.9,
      vocabulary: 1.0,
      strategy: 'OFFENSIVE'
    },
    {
      name: 'Wordsmith',
      difficulty: 'HARD',
      aggressiveness: 0.7,
      vocabulary: 0.9,
      strategy: 'BALANCED'
    },
    {
      name: 'Scholar',
      difficulty: 'HARD',
      aggressiveness: 0.5,
      vocabulary: 0.95,
      strategy: 'DEFENSIVE'
    },
    {
      name: 'Strategist',
      difficulty: 'MEDIUM',
      aggressiveness: 0.6,
      vocabulary: 0.8,
      strategy: 'BALANCED'
    },
    {
      name: 'Challenger',
      difficulty: 'MEDIUM',
      aggressiveness: 0.8,
      vocabulary: 0.7,
      strategy: 'OFFENSIVE'
    },
    {
      name: 'Apprentice',
      difficulty: 'EASY',
      aggressiveness: 0.4,
      vocabulary: 0.6,
      strategy: 'DEFENSIVE'
    },
    {
      name: 'Novice',
      difficulty: 'EASY',
      aggressiveness: 0.3,
      vocabulary: 0.5,
      strategy: 'BALANCED'
    }
  ];

  /**
   * Initialize the GADDAG AI Service
   */
  async initialize(): Promise<void> {
    console.log('🤖 Initializing GADDAG AI Service...');
    
    // Reset the GADDAG singleton to ensure it rebuilds with proper dictionary
    console.log('🔄 Resetting GADDAG to use proper dictionary...');
    resetCorrectGADDAG();
    
    // Correct GADDAG initializes automatically via singleton pattern
    const isReady = await correctGADDAGMoveGenerator.isReady();
    if (isReady) {
      console.log('✅ GADDAG AI Service ready with proper dictionary!');
    } else {
      throw new Error('Failed to initialize Production GADDAG');
    }
  }

  /**
   * Generate a unique AI name based on personality
   */
  generateAIName(): string {
    const availablePersonalities = this.AI_PERSONALITIES.filter(p => !this.usedNames.has(p.name));
    
    if (availablePersonalities.length === 0) {
      // Reset if all names used
      this.usedNames.clear();
      const personality = this.AI_PERSONALITIES[Math.floor(Math.random() * this.AI_PERSONALITIES.length)];
      this.usedNames.add(personality.name);
      return personality.name;
    }
    
    const personality = availablePersonalities[Math.floor(Math.random() * availablePersonalities.length)];
    this.usedNames.add(personality.name);
    return personality.name;
  }

  /**
   * Generate the best move for an AI player
   */
  async generateMove(gameState: GameState, playerId: string): Promise<AIMove> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.error(`AI player ${playerId} not found`);
      return { type: 'PASS' };
    }

    console.log(`🧠 ${player.name} analyzing position...`);
    const startTime = Date.now();

    try {
      // Get AI personality
      const personality = this.getPlayerPersonality(player.name);
      
      // Try GADDAG first, but with validation
      const gaddagMove = await this.tryGADDAGMove(gameState, player, personality);
      if (gaddagMove) {
        const elapsedTime = Date.now() - startTime;
        console.log(`🎯 ${player.name} plays "${gaddagMove.word}" for ${gaddagMove.score} points (${elapsedTime}ms)`);
        
        return {
          type: 'WORD',
          tiles: gaddagMove.tiles
        };
      }

      // Fallback to simple word generation if GADDAG fails
      console.log(`⚠️ ${player.name} falling back to simple word generation`);
      const simpleMove = await this.generateSimpleMove(gameState, player, personality);
      if (simpleMove) {
        const elapsedTime = Date.now() - startTime;
        console.log(`🎯 ${player.name} plays "${simpleMove.word}" for ${simpleMove.score} points (${elapsedTime}ms)`);
        
        return {
          type: 'WORD',
          tiles: simpleMove.tiles
        };
      }

      // If all else fails, exchange tiles
      console.log(`🔄 ${player.name} executes strategic exchange`);
      return this.generateStrategicExchange(player.tiles, personality);

    } catch (error) {
      console.error(`💀 ${player.name} AI error:`, error);
      return { type: 'PASS' };
    }
  }

  /**
   * Get AI personality for a player name
   */
  private getPlayerPersonality(playerName: string): AIPersonality {
    const personality = this.AI_PERSONALITIES.find(p => p.name === playerName);
    return personality || this.AI_PERSONALITIES[3]; // Default to Strategist
  }

  /**
   * Create move generation configuration based on AI personality
   */
  private createMoveGenerationConfig(
    personality: AIPersonality, 
    gameState: GameState
  ): Partial<MoveGenerationConfig> {
    const config: Partial<MoveGenerationConfig> = {
      difficulty: personality.difficulty,
      enablePruning: true
    };

    // Adjust based on difficulty
    switch (personality.difficulty) {
      case 'EASY':
        config.maxCandidates = 20;
        config.timeLimit = 1000;
        config.minScore = 5;
        break;
      case 'MEDIUM':
        config.maxCandidates = 50;
        config.timeLimit = 2000;
        config.minScore = 8;
        break;
      case 'HARD':
        config.maxCandidates = 100;
        config.timeLimit = 3000;
        config.minScore = 10;
        break;
      case 'EXPERT':
        config.maxCandidates = 200;
        config.timeLimit = 5000;
        config.minScore = 12;
        break;
    }

    // Adjust based on game state
    const tilesRemaining = this.countRemainingTiles(gameState);
    if (tilesRemaining < 20) {
      // Endgame - be more aggressive
      config.minScore = Math.max(0, (config.minScore || 0) - 5);
      config.timeLimit = (config.timeLimit || 2000) * 1.5;
    }

    return config;
  }

  /**
   * Select move based on AI personality
   */
  private selectMoveByPersonality(
    candidates: MoveCandidate[],
    personality: AIPersonality,
    gameState: GameState,
    player: Player
  ): MoveCandidate {
    if (candidates.length === 0) {
      throw new Error('No candidates available');
    }

    // Apply vocabulary filter
    const vocabularyFiltered = this.filterByVocabulary(candidates, personality.vocabulary);
    const availableCandidates = vocabularyFiltered.length > 0 ? vocabularyFiltered : candidates;

    // Apply strategy-based selection
    switch (personality.strategy) {
      case 'OFFENSIVE':
        return this.selectOffensiveMove(availableCandidates, personality, gameState);
      
      case 'DEFENSIVE':
        return this.selectDefensiveMove(availableCandidates, personality, gameState);
      
      case 'BALANCED':
      default:
        return this.selectBalancedMove(availableCandidates, personality, gameState);
    }
  }

  /**
   * Filter moves by vocabulary level (simulates AI not knowing all words)
   */
  private filterByVocabulary(candidates: MoveCandidate[], vocabularyLevel: number): MoveCandidate[] {
    if (vocabularyLevel >= 1.0) return candidates;

    // Remove some percentage of moves to simulate limited vocabulary
    const keepPercentage = 0.5 + (vocabularyLevel * 0.5); // 50% to 100%
    const keepCount = Math.ceil(candidates.length * keepPercentage);
    
    // Keep the highest scoring moves (AI knows common high-value words)
    return candidates.slice(0, keepCount);
  }

  /**
   * Select move with offensive strategy (maximize points)
   */
  private selectOffensiveMove(
    candidates: MoveCandidate[],
    personality: AIPersonality,
    gameState: GameState
  ): MoveCandidate {
    // Sort by score with some randomness based on aggressiveness
    const scored = candidates.map(candidate => ({
      candidate,
      adjustedScore: candidate.score + (Math.random() * personality.aggressiveness * 10)
    }));

    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);
    return scored[0].candidate;
  }

  /**
   * Select move with defensive strategy (block opponent opportunities)
   */
  private selectDefensiveMove(
    candidates: MoveCandidate[],
    personality: AIPersonality,
    gameState: GameState
  ): MoveCandidate {
    // Prefer moves that don't open up premium squares for opponents
    const evaluated = candidates.map(candidate => {
      let defensiveScore = candidate.score;
      
      // Penalty for opening premium squares
      const opensTripleWord = this.opensTripleWordSquare(candidate, gameState.board);
      if (opensTripleWord) defensiveScore -= 15;
      
      const opensDoubleWord = this.opensDoubleWordSquare(candidate, gameState.board);
      if (opensDoubleWord) defensiveScore -= 8;
      
      // Bonus for using premium squares ourselves
      if (candidate.tiles.some(t => gameState.board[t.row][t.col].multiplier?.includes('WORD'))) {
        defensiveScore += 5;
      }
      
      return { candidate, defensiveScore };
    });

    evaluated.sort((a, b) => b.defensiveScore - a.defensiveScore);
    return evaluated[0].candidate;
  }

  /**
   * Select move with balanced strategy
   */
  private selectBalancedMove(
    candidates: MoveCandidate[],
    personality: AIPersonality,
    gameState: GameState
  ): MoveCandidate {
    // Balance between score and strategic considerations
    const evaluated = candidates.map(candidate => {
      let balancedScore = candidate.score;
      
      // Slight bonus for longer words
      if (candidate.word.length >= 6) balancedScore += 3;
      if (candidate.word.length >= 7) balancedScore += 5; // Bingo bonus consideration
      
      // Slight penalty for using blanks unless high scoring
      if (candidate.usesBlank && candidate.score < 25) balancedScore -= 3;
      
      // Random factor based on aggressiveness
      balancedScore += (Math.random() - 0.5) * personality.aggressiveness * 8;
      
      return { candidate, balancedScore };
    });

    evaluated.sort((a, b) => b.balancedScore - a.balancedScore);
    return evaluated[0].candidate;
  }

  /**
   * Generate strategic tile exchange
   */
  private generateStrategicExchange(tiles: Tile[], personality: AIPersonality): AIMove {
    // Exchange strategy based on personality
    const tileAnalysis = tiles.map(tile => ({
      tile,
      keepValue: this.calculateTileKeepValue(tile, personality)
    }));

    // Sort by keep value (lower = more likely to exchange)
    tileAnalysis.sort((a, b) => a.keepValue - b.keepValue);

    // Exchange 3-6 tiles based on personality
    let exchangeCount = 3;
    if (personality.aggressiveness > 0.7) exchangeCount = 4; // More aggressive exchange
    if (personality.difficulty === 'EASY') exchangeCount = Math.min(3, tiles.length);
    if (personality.difficulty === 'EXPERT') exchangeCount = Math.min(5, tiles.length);

    const tilesToExchange = tileAnalysis
      .slice(0, Math.min(exchangeCount, tiles.length))
      .map(ta => ta.tile);

    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }

  /**
   * Calculate how valuable a tile is to keep
   */
  private calculateTileKeepValue(tile: Tile, personality: AIPersonality): number {
    let value = 0;

    // Base letter value
    value += tile.value;

    // Vowel bonus (vowels are generally useful)
    if ('AEIOU'.includes(tile.letter.toUpperCase())) value += 2;

    // Common letter bonus
    if ('ERSTLAIN'.includes(tile.letter.toUpperCase())) value += 1;

    // High-value letter consideration
    if (tile.value >= 8) {
      // Expert players keep high-value tiles longer
      if (personality.difficulty === 'EXPERT') value += 3;
      else value -= 1; // Others might exchange them if stuck
    }

    // Blank tiles are always valuable
    if (tile.isBlank) value += 10;

    return value;
  }

  /**
   * Check if a move opens up triple word squares for opponents
   */
  private opensTripleWordSquare(candidate: MoveCandidate, board: any[][]): boolean {
    // Simplified check - in a full implementation, this would analyze
    // if the move creates opportunities for opponents to reach premium squares
    return candidate.tiles.some(tile => {
      const adjacent = [
        [tile.row - 1, tile.col], [tile.row + 1, tile.col],
        [tile.row, tile.col - 1], [tile.row, tile.col + 1]
      ];
      
      return adjacent.some(([r, c]) => {
        if (r >= 0 && r < 15 && c >= 0 && c < 15) {
          return board[r][c].multiplier === 'TRIPLE_WORD' && !board[r][c].tile;
        }
        return false;
      });
    });
  }

  /**
   * Check if a move opens up double word squares for opponents
   */
  private opensDoubleWordSquare(candidate: MoveCandidate, board: any[][]): boolean {
    return candidate.tiles.some(tile => {
      const adjacent = [
        [tile.row - 1, tile.col], [tile.row + 1, tile.col],
        [tile.row, tile.col - 1], [tile.row, tile.col + 1]
      ];
      
      return adjacent.some(([r, c]) => {
        if (r >= 0 && r < 15 && c >= 0 && c < 15) {
          return board[r][c].multiplier === 'DOUBLE_WORD' && !board[r][c].tile;
        }
        return false;
      });
    });
  }

  /**
   * Count remaining tiles in the game
   */
  private countRemainingTiles(gameState: GameState): number {
    // This would need to be implemented based on your tile bag system
    // For now, return a reasonable estimate
    const totalPlayerTiles = gameState.players.reduce((sum, player) => sum + player.tiles.length, 0);
    return Math.max(0, 100 - totalPlayerTiles); // Assuming 100 total tiles
  }

  /**
   * Convert GameState board to string array format expected by Production GADDAG
   */
  private convertGameStateToBoard(gameState: GameState): string[][] {
    const board: string[][] = [];
    
    for (let row = 0; row < 15; row++) {
      board[row] = [];
      for (let col = 0; col < 15; col++) {
        const cell = gameState.board[row][col];
        board[row][col] = cell.tile ? cell.tile.letter : ' ';
      }
    }
    
    return board;
  }

  /**
   * Convert Production GADDAG moves to MoveCandidate format
   */
  private convertToMoveCandidates(
    rawMoves: Array<{
      word: string;
      row: number;
      col: number;
      direction: 'HORIZONTAL' | 'VERTICAL';
      score: number;
      tiles: Array<{letter: string, row: number, col: number}>;
    }>,
    playerTiles: Tile[]
  ): MoveCandidate[] {
    const validMoves: MoveCandidate[] = [];
    
    for (const move of rawMoves) {
      const placedTiles: PlacedTile[] = [];
      let isValidMove = true;
      const usedTileIds = new Set<string>();
      
      for (const tilePos of move.tiles) {
        // Find matching tile from player's rack that hasn't been used yet
        const matchingTile = playerTiles.find(t => 
          !usedTileIds.has(t.id) && (
            t.letter === tilePos.letter || 
            (t.isBlank && tilePos.letter !== ' ')
          )
        );
        
        if (!matchingTile) {
          // Can't find a valid tile for this position - skip this move
          isValidMove = false;
          break;
        }
        
        // Mark this tile as used for this move
        usedTileIds.add(matchingTile.id);
        
        placedTiles.push({
          tile: matchingTile,
          row: tilePos.row,
          col: tilePos.col
        });
      }
      
      // Only add moves where we can satisfy all tile requirements
      if (isValidMove && placedTiles.length > 0) {
        validMoves.push({
          word: move.word,
          tiles: placedTiles,
          score: move.score,
          row: move.row,
          col: move.col,
          direction: move.direction,
          usesBlank: placedTiles.some(pt => pt.tile.isBlank)
        });
      }
    }
    
    return validMoves;
  }

  /**
   * Get letter value for scoring
   */
  private getLetterValue(letter: string): number {
    const letterValues: Record<string, number> = {
      'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
      'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
      'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
    };
    return letterValues[letter.toUpperCase()] || 0;
  }

  /**
   * Get AI service statistics
   */
  async getStatistics() {
    const gaddagStats = await correctGADDAGMoveGenerator.getStatistics();
    const isReady = await correctGADDAGMoveGenerator.isReady();
    
    return {
      isReady,
      gaddagStats,
      availablePersonalities: this.AI_PERSONALITIES.length,
      usedNames: this.usedNames.size
    };
  }

  /**
   * Try to generate a move using GADDAG with validation
   */
  private async tryGADDAGMove(gameState: GameState, player: Player, personality: AIPersonality): Promise<MoveCandidate | null> {
    try {
      // Configure move generation based on personality
      const config = this.createMoveGenerationConfig(personality, gameState);
      
      // Convert game state to format expected by production GADDAG
      const board = this.convertGameStateToBoard(gameState);
      const rack = player.tiles.map(tile => tile.letter);
      
      // Generate moves using Correct GADDAG
      const rawMoves = await correctGADDAGMoveGenerator.generateMoves(board, rack);
      
      // Convert to our MoveCandidate format
      const candidates = this.convertToMoveCandidates(rawMoves, player.tiles);
      
      if (candidates.length === 0) {
        return null;
      }

      // Select move based on personality and game state
      const selectedMove = this.selectMoveByPersonality(candidates, personality, gameState, player);
      return selectedMove;
      
    } catch (error) {
      console.error(`GADDAG move generation failed for ${player.name}:`, error);
      return null;
    }
  }

  /**
   * Generate a simple move using basic word patterns (fallback)
   */
  private async generateSimpleMove(gameState: GameState, player: Player, personality: AIPersonality): Promise<MoveCandidate | null> {
    try {
      // Simple fallback: try to form basic 2-3 letter words
      const board = gameState.board;
      const rack = player.tiles;
      
      // Look for existing tiles on the board to build off of
      for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
          const cell = board[row][col];
          if (cell.tile) {
            // Try to add a letter before or after this tile
            const moves = this.generateSimpleAdjacentMoves(board, rack, row, col, personality);
            if (moves.length > 0) {
              return moves[0]; // Return the first valid move
            }
          }
        }
      }
      
      // If no existing tiles, try to place a simple word at center
      if (this.isBoardEmpty(board)) {
        return this.generateCenterMove(rack, personality);
      }
      
      return null;
    } catch (error) {
      console.error(`Simple move generation failed for ${player.name}:`, error);
      return null;
    }
  }

  /**
   * Generate simple moves adjacent to existing tiles
   */
  private generateSimpleAdjacentMoves(board: any[][], rack: Tile[], row: number, col: number, personality: AIPersonality): MoveCandidate[] {
    const moves: MoveCandidate[] = [];
    const existingLetter = board[row][col].tile?.letter;
    
    if (!existingLetter) return moves;
    
    // Try simple 2-letter combinations
    const simpleWords = this.getSimpleWords(existingLetter, rack);
    
    for (const wordData of simpleWords) {
      // Try horizontal placement (add letter to the right)
      if (col + 1 < 15 && !board[row][col + 1].tile) {
        const move = this.createSimpleMove(wordData.word, row, col, 'HORIZONTAL', wordData.tiles, rack);
        if (move) moves.push(move);
      }
      
      // Try horizontal placement (add letter to the left)
      if (col - 1 >= 0 && !board[row][col - 1].tile) {
        const move = this.createSimpleMove(wordData.word, row, col - 1, 'HORIZONTAL', wordData.tiles, rack);
        if (move) moves.push(move);
      }
      
      // Try vertical placement (add letter below)
      if (row + 1 < 15 && !board[row + 1][col].tile) {
        const move = this.createSimpleMove(wordData.word, row, col, 'VERTICAL', wordData.tiles, rack);
        if (move) moves.push(move);
      }
      
      // Try vertical placement (add letter above)
      if (row - 1 >= 0 && !board[row - 1][col].tile) {
        const move = this.createSimpleMove(wordData.word, row - 1, col, 'VERTICAL', wordData.tiles, rack);
        if (move) moves.push(move);
      }
    }
    
    return moves;
  }

  /**
   * Get simple 2-letter words that can be formed
   */
  private getSimpleWords(existingLetter: string, rack: Tile[]): Array<{word: string, tiles: Tile[]}> {
    const words: Array<{word: string, tiles: Tile[]}> = [];
    
    // Common 2-letter words
    const commonWords = [
      'AN', 'AT', 'BE', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'WE'
    ];
    
    for (const word of commonWords) {
      if (word.includes(existingLetter)) {
        const neededLetter = word.replace(existingLetter, '');
        const tile = rack.find(t => t.letter === neededLetter || t.isBlank);
        if (tile) {
          words.push({ word, tiles: [tile] });
        }
      }
    }
    
    return words;
  }

  /**
   * Create a simple move object
   */
  private createSimpleMove(word: string, row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL', tiles: Tile[], rack: Tile[]): MoveCandidate | null {
    try {
      const placedTiles: PlacedTile[] = [];
      
      for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const tileRow = direction === 'VERTICAL' ? row + i : row;
        const tileCol = direction === 'HORIZONTAL' ? col + i : col;
        
        // Find tile from rack for this letter
        const tile = tiles.find(t => t.letter === letter || t.isBlank);
        if (tile) {
          placedTiles.push({
            tile,
            row: tileRow,
            col: tileCol
          });
        }
      }
      
      if (placedTiles.length === 0) return null;
      
      // Calculate basic score
      const score = word.length * 3; // Simple scoring
      
      return {
        word,
        tiles: placedTiles,
        score,
        row,
        col,
        direction,
        usesBlank: placedTiles.some(pt => pt.tile.isBlank)
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if the board is empty
   */
  private isBoardEmpty(board: any[][]): boolean {
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        if (board[row][col].tile) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Generate a move for the center of the board (first move)
   */
  private generateCenterMove(rack: Tile[], personality: AIPersonality): MoveCandidate | null {
    // Try to form a simple word starting at center (7,7)
    const centerRow = 7;
    const centerCol = 7;
    
    // Simple 3-letter words that are commonly known
    const simpleWords = ['CAT', 'DOG', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL'];
    
    for (const word of simpleWords) {
      const tiles: PlacedTile[] = [];
      let canForm = true;
      const usedTileIds = new Set<string>();
      
      for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const tile = rack.find(t => !usedTileIds.has(t.id) && (t.letter === letter || t.isBlank));
        
        if (!tile) {
          canForm = false;
          break;
        }
        
        usedTileIds.add(tile.id);
        tiles.push({
          tile,
          row: centerRow,
          col: centerCol + i
        });
      }
      
      if (canForm && tiles.length > 0) {
        return {
          word,
          tiles,
          score: word.length * 4, // Center square bonus
          row: centerRow,
          col: centerCol,
          direction: 'HORIZONTAL',
          usesBlank: tiles.some(pt => pt.tile.isBlank)
        };
      }
    }
    
    return null;
  }

  /**
   * Check if the service is ready
   */
  async isReady(): Promise<boolean> {
    return await correctGADDAGMoveGenerator.isReady();
  }
}

/**
 * Singleton instance
 */
export const gaddagAIService = new GADDAGAIService();
