/**
 * Simple GADDAG Debug Test
 */

import { GADDAGMoveGenerator } from './src/services/gaddag/GADDAGMoveGenerator';
import { BOARD_SIZE } from './src/constants/board';

async function debugTest() {
  console.log('🔍 GADDAG Debug Test');
  console.log('===================\n');

  const generator = new GADDAGMoveGenerator();
  
  // Initialize
  console.log('1️⃣ Initializing GADDAG...');
  await generator.initialize();
  console.log('   ✅ GADDAG initialized\n');

  // Create empty board
  const board = Array(BOARD_SIZE).fill(null).map(() => 
    Array(BOARD_SIZE).fill(null).map(() => ({
      tile: null,
      multiplier: null,
      powerUp: null
    }))
  );
  board[7][7].multiplier = 'CENTER' as any;

  // Create simple game state
  const gameState = {
    board,
    players: [{
      id: 'test-player',
      name: 'Test Player',
      tiles: [
        { id: '1', letter: 'C', value: 3, isBlank: false },
        { id: '2', letter: 'A', value: 1, isBlank: false },
        { id: '3', letter: 'T', value: 1, isBlank: false }
      ],
      score: 0,
      hasEndedGame: false,
      activePowerUps: [],
      activePowerUpForTurn: null,
      isAI: true
    }],
    currentPlayerIndex: 0,
    tileBag: [],
    gamePhase: 'PLAYING' as const,
    turnNumber: 1,
    playersEndedGame: [],
    moveHistory: []
  };

  console.log('2️⃣ Testing move generation...');
  console.log('   Tiles: C, A, T');
  
  try {
    const moves = await generator.generateMoves(gameState, 'test-player');
    console.log(`   Found ${moves.length} moves:`);
    
    for (const move of moves) {
      console.log(`   - ${move.word} (${move.score} points) at (${move.row}, ${move.col}) ${move.direction}`);
    }
    
    if (moves.length === 0) {
      console.log('   ❌ No moves found - debugging needed');
    } else {
      console.log('   ✅ Moves found successfully');
    }
    
  } catch (error) {
    console.error('   ❌ Error:', error);
  }

  console.log('\n3️⃣ Testing word validation...');
  
  // Test the isValidWord method directly
  const testWords = ['CAT', 'ACT', 'TAC', 'AT', 'TO'];
  for (const word of testWords) {
    // We need to access the private method, so we'll test through the public interface
    console.log(`   Testing "${word}": Need to check GADDAG structure`);
  }
}

debugTest().catch(console.error);
