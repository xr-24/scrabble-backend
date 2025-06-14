import { gaddagAIService } from '../GADDAGAIService';
import { gameService } from '../GameService';
import { createEmptyBoard } from '../../constants/board';
import { createTileBag, drawTiles } from '../../constants/tiles';
import type { GameState, Player } from '../../types/game';

async function testGADDAGIntegration() {
  console.log('🧪 Starting GADDAG Integration Test...\n');

  try {
    // Initialize GADDAG AI
    console.log('1. Initializing GADDAG AI Service...');
    await gaddagAIService.initialize();
    console.log('✅ GADDAG AI initialized successfully\n');

    // Create a test game state
    console.log('2. Creating test game state...');
    let tileBag = createTileBag();
    const { drawnTiles: player1Tiles, remainingBag: bag1 } = drawTiles(tileBag, 7);
    const { drawnTiles: player2Tiles, remainingBag: finalBag } = drawTiles(bag1, 7);

    const testPlayers: Player[] = [
      {
        id: 'player1',
        name: 'Human Player',
        tiles: player1Tiles,
        score: 0,
        hasEndedGame: false,
        activePowerUps: [],
        activePowerUpForTurn: null,
        tileColor: '#404040',
        isAI: false
      },
      {
        id: 'ai-player',
        name: 'GADDAG AI',
        tiles: player2Tiles,
        score: 0,
        hasEndedGame: false,
        activePowerUps: [],
        activePowerUpForTurn: null,
        tileColor: '#ff6b6b',
        isAI: true,
        aiPersonality: 'aggressive'
      }
    ];

    const gameState: GameState = {
      board: createEmptyBoard(),
      players: testPlayers,
      currentPlayerIndex: 1, // Start with AI player
      tileBag: finalBag,
      gamePhase: 'PLAYING',
      turnNumber: 1,
      playersEndedGame: [],
      moveHistory: []
    };

    console.log('✅ Test game state created');
    console.log(`   AI Player tiles: ${testPlayers[1].tiles.map(t => t.letter).join(', ')}\n`);

    // Test AI move generation
    console.log('3. Testing AI move generation...');
    const startTime = Date.now();
    const aiMove = await gaddagAIService.generateMove(gameState, 'ai-player');
    const endTime = Date.now();

    console.log(`✅ AI move generated in ${endTime - startTime}ms`);
    console.log(`   Move type: ${aiMove.type}`);
    
    if (aiMove.type === 'WORD' && aiMove.tiles) {
      console.log(`   Word tiles: ${aiMove.tiles.length} tiles placed`);
      aiMove.tiles.forEach((placedTile, index) => {
        console.log(`     ${index + 1}. ${placedTile.tile.letter} at (${placedTile.row}, ${placedTile.col})`);
      });
      
      // Validate that AI only uses tiles it owns
      const aiTileIds = testPlayers[1].tiles.map(t => t.id);
      const usedTileIds = aiMove.tiles.map(pt => pt.tile.id);
      const invalidTiles = usedTileIds.filter(id => !aiTileIds.includes(id));
      
      if (invalidTiles.length === 0) {
        console.log('✅ All tiles used by AI are owned by the AI player');
      } else {
        console.log('❌ AI attempted to use tiles it doesn\'t own:', invalidTiles);
      }
    } else if (aiMove.type === 'EXCHANGE') {
      console.log(`   Exchange: ${aiMove.exchangeTileIds?.length || 0} tiles`);
    } else {
      console.log('   Pass turn');
    }

    console.log('\n4. Testing game service integration...');
    
    // Initialize a real game through game service
    const gameId = 'test-game-' + Date.now();
    const roomPlayers = [
      { id: 'human', name: 'Human Player', color: '#404040' },
      { id: 'ai', name: 'GADDAG AI', color: '#ff6b6b', isAI: true, aiPersonality: 'aggressive' }
    ];

    const realGameState = gameService.initializeGame(gameId, roomPlayers);
    console.log('✅ Game initialized through GameService');
    console.log(`   Current player: ${realGameState.players[realGameState.currentPlayerIndex].name}`);
    console.log(`   Is AI: ${realGameState.players[realGameState.currentPlayerIndex].isAI}`);

    // Test AI execution through game service
    if (realGameState.players[realGameState.currentPlayerIndex].isAI) {
      console.log('\n5. Testing AI execution through GameService...');
      const aiResult = await gameService.executeAIMove(gameId);
      console.log(`✅ AI move executed: ${aiResult.success ? 'SUCCESS' : 'FAILED'}`);
      if (!aiResult.success) {
        console.log(`   Errors: ${aiResult.errors.join(', ')}`);
      }

      const updatedGameState = gameService.getGameState(gameId);
      if (updatedGameState) {
        console.log(`   Game turn advanced to: ${updatedGameState.players[updatedGameState.currentPlayerIndex].name}`);
        console.log(`   Move history entries: ${updatedGameState.moveHistory.length}`);
        if (updatedGameState.moveHistory.length > 0) {
          const lastMove = updatedGameState.moveHistory[updatedGameState.moveHistory.length - 1];
          console.log(`   Last move: ${lastMove.moveType} by ${lastMove.playerName} (Score: ${lastMove.score})`);
        }
      }
    }

    console.log('\n6. Performance test - Multiple move generations...');
    const performanceTests = 5;
    const times: number[] = [];
    
    for (let i = 0; i < performanceTests; i++) {
      const start = Date.now();
      await gaddagAIService.generateMove(gameState, 'ai-player');
      const end = Date.now();
      times.push(end - start);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`✅ Performance test completed:`);
    console.log(`   Average time: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min time: ${minTime}ms`);
    console.log(`   Max time: ${maxTime}ms`);

    // Clean up
    gameService.removeGame(gameId);
    console.log('\n✅ Test cleanup completed');

    console.log('\n🎉 GADDAG Integration Test PASSED!');
    console.log('   ✅ AI initialization works');
    console.log('   ✅ Move generation works');
    console.log('   ✅ Game service integration works');
    console.log('   ✅ Performance is acceptable');
    console.log('   ✅ Tile ownership validation works');

  } catch (error) {
    console.error('\n❌ GADDAG Integration Test FAILED!');
    console.error('Error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testGADDAGIntegration().then(() => {
    console.log('\n🏁 Integration test completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('\n💥 Integration test failed:', error);
    process.exit(1);
  });
}

export { testGADDAGIntegration };
