/**
 * Simple GADDAG Test - TypeScript version
 */

import { GADDAGAIService } from './src/services/GADDAGAIService';
import { BOARD_SIZE } from './src/constants/board';

async function testGADDAG() {
  console.log('🧪 GADDAG System Test');
  console.log('====================\n');

  try {
    console.log('1️⃣ Creating AI service...');
    const ai = new GADDAGAIService();
    console.log('   ✅ AI service created\n');

    console.log('2️⃣ Creating test game...');
    const board = Array(BOARD_SIZE).fill(null).map(() => 
      Array(BOARD_SIZE).fill(null).map(() => ({
        tile: null,
        multiplier: null,
        powerUp: null
      }))
    );
    board[7][7].multiplier = 'CENTER' as any;

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
    console.log('   ✅ Game state created\n');

    console.log('3️⃣ Testing move generation...');
    const startTime = Date.now();
    
    const move = await ai.generateMove(gameState, 'test-player');
    
    const elapsedTime = Date.now() - startTime;
    console.log(`   ⏱️ Time: ${elapsedTime}ms`);

    if (move) {
      console.log('   ✅ Move generated successfully!');
      console.log(`   📝 Move type: ${move.type}`);
      
      if (move.type === 'WORD' && move.tiles) {
        console.log(`   🎲 Tiles placed: ${move.tiles.length}`);
        console.log(`   📍 First tile: (${move.tiles[0].row}, ${move.tiles[0].col})`);
        console.log(`   🔤 Letters: ${move.tiles.map(t => t.tile.letter).join('')}`);
      } else if (move.type === 'EXCHANGE' && move.exchangeTileIds) {
        console.log(`   🔄 Exchanging ${move.exchangeTileIds.length} tiles`);
      }
      
      console.log('\n🎉 GADDAG TEST PASSED!');
      console.log('Your GADDAG implementation is working correctly.');
    } else {
      console.log('   ❌ No move generated');
      console.log('\n❌ GADDAG TEST FAILED!');
    }

  } catch (error) {
    console.error('\n❌ GADDAG TEST FAILED!');
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

testGADDAG();
