/**
 * GADDAG AI Service
 * Professional Scrabble AI using GADDAG algorithm for move generation
 * 
 * This service replaces the existing AI implementations with a GADDAG-based
 * approach that finds optimal moves efficiently and integrates with the
 * existing power-up system.
 */

import type { GameState, Player, Tile, PlacedTile } from '../types/game';
import { productionGADDAGMoveGenerator } from './gaddag/ProductionGADDAGImplementation';

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
    // Production GADDAG initializes automatically via singleton pattern
    const isReady = await productionGADDAGMoveGenerator.isReady();
    if (isReady) {
      console.log('✅ GADDAG AI Service ready!');
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
      
      // Configure move generation based on personality
      const config = this.createMoveGenerationConfig(personality, gameState);
      
      // Convert game state to format expected by production GADDAG
      const board = this.convertGameStateToBoard(gameState);
      const rack = player.tiles.map(tile => tile.letter);
      
      // Generate moves using Production GADDAG
      const rawMoves = await productionGADDAGMoveGenerator.generateMoves(board, rack);
      
      // Convert to our MoveCandidate format
      const candidates = this.convertToMoveCandidates(rawMoves, player.tiles);
      
      if (candidates.length === 0) {
        console.log(`🔄 ${player.name} executes strategic exchange`);
        return this.generateStrategicExchange(player.tiles, personality);
      }

      // Select move based on personality and game state
      const selectedMove = this.selectMoveByPersonality(candidates, personality, gameState, player);
      
      const elapsedTime = Date.now() - startTime;
      console.log(`🎯 ${player.name} plays "${selectedMove.word}" for ${selectedMove.score} points (${elapsedTime}ms)`);
      
      return {
        type: 'WORD',
        tiles: selectedMove.tiles
      };

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
    return rawMoves.map(move => {
      const placedTiles: PlacedTile[] = move.tiles.map(tilePos => {
        // Find matching tile from player's rack
        const matchingTile = playerTiles.find(t => 
          t.letter === tilePos.letter || t.isBlank
        );
        
        return {
          tile: matchingTile || {
            id: `temp-${tilePos.letter}`,
            letter: tilePos.letter,
            value: this.getLetterValue(tilePos.letter),
            isBlank: false
          },
          row: tilePos.row,
          col: tilePos.col
        };
      });

      return {
        word: move.word,
        tiles: placedTiles,
        score: move.score,
        row: move.row,
        col: move.col,
        direction: move.direction,
        usesBlank: placedTiles.some(pt => pt.tile.isBlank)
      };
    });
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
    const gaddagStats = await productionGADDAGMoveGenerator.getStatistics();
    const isReady = await productionGADDAGMoveGenerator.isReady();
    
    return {
      isReady,
      gaddagStats,
      availablePersonalities: this.AI_PERSONALITIES.length,
      usedNames: this.usedNames.size
    };
  }

  /**
   * Check if the service is ready
   */
  async isReady(): Promise<boolean> {
    return await productionGADDAGMoveGenerator.isReady();
  }
}

/**
 * Singleton instance
 */
export const gaddagAIService = new GADDAGAIService();
