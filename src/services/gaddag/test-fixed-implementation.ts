/**
 * Test for the Fixed GADDAG Implementation
 * This test verifies that the corrected GADDAG algorithm actually generates moves
 */

import { FixedGADDAGMoveGenerator } from './FixedGADDAGMoveGenerator';
import type { GameState, BoardCell, Player, MultiplierType } from '../../types/game';
import { BOARD_SIZE } from '../../constants/board';

// Create a test game state
function createTestGameState(): GameState {
  // Initialize empty board
  const board: BoardCell[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      let multiplier: MultiplierType | null = null;
      
      // Set center square
      if (row === 7 && col === 7) {
        multiplier = 'CENTER';
      }
      
      board[row][col] = {
        multiplier,
        tile: null,
        powerUp: null
      };
    }
  }

  // Create test player with good tiles
  const player: Player = {
    id: 'test-player',
    name: 'Test Player',
    tiles: [
      { id: '1', letter: 'C', value: 3, isBlank: false },
      { id: '2', letter: 'A', value: 1, isBlank: false },
      { id: '3', letter: 'T', value: 1, isBlank: false },
      { id: '4', letter: 'D', value: 2, isBlank: false },
      { id: '5', letter: 'O', value: 1, isBlank: false },
      { id: '6', letter: 'G', value: 2, isBlank: false },
      { id: '7', letter: 'S', value: 1, isBlank: false }
    ],
    score: 0,
    hasEndedGame: false,
    activePowerUps: [],
    activePowerUpForTurn: null
  };

  return {
    players: [player],
    board,
    currentPlayerIndex: 0,
    gamePhase: 'PLAYING',
    tileBag: [],
    turnNumber: 1,
    playersEndedGame: [],
    moveHistory: []
  };
}

async function testFixedGADDAG(): Promise<void> {
  console.log('🧪 Testing Fixed GADDAG Implementation...\n');

  try {
    // Initialize the fixed GADDAG move generator
    const generator = new FixedGADDAGMoveGenerator();
    
    console.log('1. Initializing Fixed GADDAG Move Generator...');
    await generator.initialize();
    
    if (!generator.isReady()) {
      throw new Error('Fixed GADDAG generator failed to initialize');
    }
    console.log('✅ Fixed GADDAG initialized successfully\n');

    // Create test game state
    console.log('2. Creating test game state...');
    const gameState = createTestGameState();
    const player = gameState.players[0];
    console.log(`✅ Test game created with player tiles: ${player.tiles.map(t => t.letter).join('')}\n`);

    // Test first move generation
    console.log('3. Testing first move generation (empty board)...');
    const startTime = Date.now();
    const moves = await generator.generateMoves(gameState, player.id);
    const elapsedTime = Date.now() - startTime;
    
    console.log(`🎯 Generated ${moves.length} moves in ${elapsedTime}ms`);
    
    if (moves.length === 0) {
      console.log('❌ CRITICAL ISSUE: No moves generated for first turn!');
      console.log('   This indicates the GADDAG algorithm is still broken.');
      return;
    }

    console.log('✅ SUCCESS: Moves were generated!\n');

    // Display top moves
    console.log('4. Top generated moves:');
    const topMoves = moves.slice(0, 10);
    for (let i = 0; i < topMoves.length; i++) {
      const move = topMoves[i];
      console.log(`   ${i + 1}. ${move.word} at (${move.row},${move.col}) ${move.direction} - Score: ${move.score}`);
      console.log(`      Tiles: ${move.tiles.map(t => `${t.tile.letter}@(${t.row},${t.col})`).join(', ')}`);
    }

    // Verify moves pass through center
    console.log('\n5. Verifying first moves pass through center (7,7)...');
    let validFirstMoves = 0;
    for (const move of moves) {
      const passesCenter = checkPassesCenter(move.row, move.col, move.direction, move.word.length);
      if (passesCenter) {
        validFirstMoves++;
      }
    }
    
    console.log(`✅ ${validFirstMoves}/${moves.length} moves correctly pass through center`);

    // Test with a board that has existing tiles
    console.log('\n6. Testing subsequent move generation...');
    
    // Place a word on the board
    gameState.board[7][7].tile = { id: 'placed-1', letter: 'C', value: 3, isBlank: false };
    gameState.board[7][8].tile = { id: 'placed-2', letter: 'A', value: 1, isBlank: false };
    gameState.board[7][9].tile = { id: 'placed-3', letter: 'T', value: 1, isBlank: false };
    
    console.log('   Placed "CAT" horizontally at (7,7)');
    
    // Generate moves for the modified board
    const subsequentMoves = await generator.generateMoves(gameState, player.id);
    console.log(`🎯 Generated ${subsequentMoves.length} subsequent moves`);
    
    if (subsequentMoves.length > 0) {
      console.log('✅ SUCCESS: Subsequent moves generated correctly!');
      
      // Show a few examples
      console.log('\n   Top subsequent moves:');
      for (let i = 0; i < Math.min(5, subsequentMoves.length); i++) {
        const move = subsequentMoves[i];
        console.log(`   ${i + 1}. ${move.word} at (${move.row},${move.col}) ${move.direction} - Score: ${move.score}`);
      }
    } else {
      console.log('⚠️  No subsequent moves generated - this may indicate anchor point issues');
    }

    console.log('\n🎉 Fixed GADDAG Implementation Test COMPLETED!');
    console.log(`   ✅ First move generation: ${moves.length > 0 ? 'WORKING' : 'BROKEN'}`);
    console.log(`   ✅ Subsequent move generation: ${subsequentMoves.length > 0 ? 'WORKING' : 'NEEDS WORK'}`);
    console.log(`   ✅ Performance: ${elapsedTime}ms for first moves`);

  } catch (error) {
    console.error('❌ Fixed GADDAG test failed:', error);
    throw error;
  }
}

function checkPassesCenter(row: number, col: number, direction: string, wordLength: number): boolean {
  const centerRow = 7;
  const centerCol = 7;
  
  if (direction === 'HORIZONTAL') {
    return row === centerRow && col <= centerCol && col + wordLength > centerCol;
  } else {
    return col === centerCol && row <= centerRow && row + wordLength > centerRow;
  }
}

// Run the test
if (require.main === module) {
  testFixedGADDAG().catch(console.error);
}

export { testFixedGADDAG };
