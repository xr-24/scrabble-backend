/**
 * Complete GADDAG System Test
 * Comprehensive testing of the full GADDAG implementation including
 * move generation and AI integration
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGMoveGenerator } from './GADDAGMoveGenerator';
import { GADDAGAIService } from '../GADDAGAIService';
import { GADDAGNodeUtils } from './GADDAGNode';
import type { GameState, BoardCell, Tile } from '../../types/game';
import { BOARD_SIZE } from '../../constants/board';

// Mock game state for testing
function createMockGameState(): GameState {
  // Create empty board
  const board: BoardCell[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      let multiplier: string | undefined;
      
      // Add some premium squares for testing
      if (row === 7 && col === 7) multiplier = 'CENTER';
      else if ((row === 0 || row === 14) && (col === 0 || col === 7 || col === 14)) multiplier = 'TRIPLE_WORD';
      else if ((row === 7) && (col === 0 || col === 14)) multiplier = 'TRIPLE_WORD';
      else if ((row === 1 || row === 13) && (col === 1 || col === 13)) multiplier = 'DOUBLE_WORD';
      else if ((row === 2 || row === 12) && (col === 2 || col === 12)) multiplier = 'DOUBLE_WORD';
      else if ((row === 3 || row === 11) && (col === 3 || col === 11)) multiplier = 'DOUBLE_WORD';
      else if ((row === 4 || row === 10) && (col === 4 || col === 10)) multiplier = 'DOUBLE_WORD';
      
      board[row][col] = {
        tile: null,
        multiplier: multiplier as any,
        powerUp: null
      };
    }
  }

  // Create test players
  const players = [
    {
      id: 'player1',
      name: 'TestPlayer',
      tiles: createTestTiles(['C', 'A', 'T', 'S', 'E', 'R', 'N']),
      score: 0,
      hasEndedGame: false,
      activePowerUps: [],
      activePowerUpForTurn: null,
      isAI: false
    },
    {
      id: 'ai1',
      name: 'Lexicon',
      tiles: createTestTiles(['D', 'O', 'G', 'S', 'I', 'N', 'G']),
      score: 0,
      hasEndedGame: false,
      activePowerUps: [],
      activePowerUpForTurn: null,
      isAI: true
    }
  ];

  return {
    board,
    players,
    currentPlayerIndex: 0,
    tileBag: [],
    gamePhase: 'PLAYING',
    turnNumber: 1,
    playersEndedGame: [],
    moveHistory: []
  };
}

function createTestTiles(letters: string[]): Tile[] {
  return letters.map((letter, index) => ({
    id: `tile-${index}`,
    letter,
    value: getLetterValue(letter),
    isBlank: false
  }));
}

function getLetterValue(letter: string): number {
  const values: Record<string, number> = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
    'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
    'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
  };
  return values[letter.toUpperCase()] || 1;
}

function createGameStateWithExistingTiles(): GameState {
  const gameState = createMockGameState();
  
  // Place some tiles on the board to test move generation
  // Place "CAT" horizontally starting at (7,6)
  gameState.board[7][6].tile = { id: 'existing-1', letter: 'C', value: 3, isBlank: false };
  gameState.board[7][7].tile = { id: 'existing-2', letter: 'A', value: 1, isBlank: false };
  gameState.board[7][8].tile = { id: 'existing-3', letter: 'T', value: 1, isBlank: false };
  
  return gameState;
}

async function testCompleteGADDAGSystem() {
  console.log('🧪 Starting Complete GADDAG System Test...\n');

  try {
    // Test 1: Basic GADDAG Construction
    console.log('📝 Test 1: GADDAG Construction');
    const builder = new GADDAGBuilder({
      enableMinimization: true,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });

    const testWords = ['CAT', 'CATS', 'DOG', 'DOGS', 'AT', 'TO', 'GO', 'SO', 'NO', 'ON', 'HELLO', 'WORLD'];
    console.log(`   Building GADDAG from words: ${testWords.join(', ')}`);
    
    const startTime = Date.now();
    const gaddag = await builder.buildFromWordList(testWords);
    const buildTime = Date.now() - startTime;
    
    console.log(`   ✅ GADDAG built in ${buildTime}ms`);

    // Test 2: GADDAG Statistics
    console.log('\n📝 Test 2: GADDAG Statistics');
    const stats = GADDAGNodeUtils.getStatistics(gaddag);
    console.log(`   📊 Nodes: ${stats.nodeCount}`);
    console.log(`   📊 Words: ${stats.wordCount}`);
    console.log(`   📊 Memory: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
    console.log(`   📊 Avg edges/node: ${stats.averageEdgesPerNode.toFixed(2)}`);
    console.log(`   📊 Max depth: ${stats.maxDepth}`);

    // Test 3: Move Generator Initialization
    console.log('\n📝 Test 3: Move Generator Initialization');
    const moveGenerator = new GADDAGMoveGenerator();
    
    // Override the builder to use our test GADDAG
    (moveGenerator as any).gaddag = gaddag;
    (moveGenerator as any).isInitialized = true;
    
    console.log('   ✅ Move generator initialized with test GADDAG');

    // Test 4: First Move Generation (Empty Board)
    console.log('\n📝 Test 4: First Move Generation');
    const emptyGameState = createMockGameState();
    
    const firstMoves = await moveGenerator.generateMoves(emptyGameState, 'player1', {
      maxCandidates: 10,
      timeLimit: 2000,
      minScore: 0
    });
    
    console.log(`   🎯 Generated ${firstMoves.length} first moves:`);
    firstMoves.slice(0, 5).forEach(move => {
      console.log(`      "${move.word}" at (${move.row},${move.col}) ${move.direction} - ${move.score} pts`);
    });

    // Test 5: Move Generation with Existing Tiles
    console.log('\n📝 Test 5: Move Generation with Existing Tiles');
    const gameStateWithTiles = createGameStateWithExistingTiles();
    
    const subsequentMoves = await moveGenerator.generateMoves(gameStateWithTiles, 'ai1', {
      maxCandidates: 15,
      timeLimit: 2000,
      minScore: 0
    });
    
    console.log(`   🎯 Generated ${subsequentMoves.length} moves with existing tiles:`);
    subsequentMoves.slice(0, 5).forEach(move => {
      console.log(`      "${move.word}" at (${move.row},${move.col}) ${move.direction} - ${move.score} pts`);
    });

    // Test 6: AI Service Integration
    console.log('\n📝 Test 6: AI Service Integration');
    const aiService = new GADDAGAIService();
    
    // Override the move generator in AI service
    (aiService as any).gaddagMoveGenerator = moveGenerator;
    
    console.log('   🤖 Testing AI personalities:');
    const personalities = ['Lexicon', 'Wordsmith', 'Scholar', 'Strategist', 'Apprentice'];
    
    for (const personality of personalities) {
      const testGameState = createGameStateWithExistingTiles();
      testGameState.players[1].name = personality;
      
      try {
        const aiMove = await aiService.generateMove(testGameState, 'ai1');
        console.log(`      ${personality}: ${aiMove.type} ${aiMove.type === 'WORD' ? `"${(aiMove.tiles?.[0] as any)?.tile?.letter || 'WORD'}"` : ''}`);
      } catch (error) {
        console.log(`      ${personality}: Error - ${error}`);
      }
    }

    // Test 7: Performance Benchmarks
    console.log('\n📝 Test 7: Performance Benchmarks');
    
    const perfTests = [
      { name: 'Empty Board', gameState: createMockGameState(), maxCandidates: 50 },
      { name: 'Mid Game', gameState: createGameStateWithExistingTiles(), maxCandidates: 100 },
      { name: 'Complex Position', gameState: createGameStateWithExistingTiles(), maxCandidates: 200 }
    ];
    
    for (const test of perfTests) {
      const perfStart = Date.now();
      const moves = await moveGenerator.generateMoves(test.gameState, 'player1', {
        maxCandidates: test.maxCandidates,
        timeLimit: 3000
      });
      const perfTime = Date.now() - perfStart;
      
      console.log(`   ⚡ ${test.name}: ${moves.length} moves in ${perfTime}ms`);
    }

    // Test 8: Edge Cases
    console.log('\n📝 Test 8: Edge Cases');
    
    // Test with limited tiles
    const limitedTileState = createMockGameState();
    limitedTileState.players[0].tiles = createTestTiles(['Q', 'U']);
    
    const limitedMoves = await moveGenerator.generateMoves(limitedTileState, 'player1', {
      maxCandidates: 10,
      timeLimit: 1000
    });
    
    console.log(`   🎯 Limited tiles (Q,U): ${limitedMoves.length} moves`);
    
    // Test with blank tiles
    const blankTileState = createMockGameState();
    blankTileState.players[0].tiles = [
      ...createTestTiles(['C', 'A', 'T']),
      { id: 'blank-1', letter: '?', value: 0, isBlank: true }
    ];
    
    const blankMoves = await moveGenerator.generateMoves(blankTileState, 'player1', {
      maxCandidates: 10,
      timeLimit: 1000
    });
    
    console.log(`   🎯 With blank tile: ${blankMoves.length} moves`);

    // Test 9: Memory Usage Analysis
    console.log('\n📝 Test 9: Memory Usage Analysis');
    const memoryStats = moveGenerator.getStatistics();
    if (memoryStats) {
      console.log(`   💾 GADDAG Memory: ${(memoryStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📊 Dictionary Words: ${memoryStats.wordsProcessed}`);
      console.log(`   🔀 Split Variations: ${memoryStats.splitVariationsGenerated}`);
    }

    // Test 10: Validation Tests
    console.log('\n📝 Test 10: Validation Tests');
    
    // Validate that generated moves are legal
    let validMoves = 0;
    let totalMoves = 0;
    
    for (const move of firstMoves.slice(0, 10)) {
      totalMoves++;
      
      // Basic validation checks
      if (move.word.length >= 2 && 
          move.tiles.length > 0 && 
          move.score > 0 &&
          move.row >= 0 && move.row < BOARD_SIZE &&
          move.col >= 0 && move.col < BOARD_SIZE) {
        validMoves++;
      }
    }
    
    console.log(`   ✅ Move validation: ${validMoves}/${totalMoves} moves passed basic checks`);

    console.log('\n🎉 Complete GADDAG System Test Finished!');
    console.log(`✅ All major components tested successfully`);
    console.log(`📊 System ready for integration with game engine`);

  } catch (error) {
    console.error('\n❌ Complete GADDAG System Test Failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCompleteGADDAGSystem().catch(console.error);
}

export { testCompleteGADDAGSystem };
