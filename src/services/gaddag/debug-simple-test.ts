/**
 * Simple Debug Test for GADDAG Move Generation
 * This test focuses on the core issue: why no moves are being generated
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGMoveGenerator } from './GADDAGMoveGenerator';
import type { GameState, BoardCell, Tile } from '../../types/game';
import { BOARD_SIZE } from '../../constants/board';

// Create a very simple test case
function createSimpleGameState(): GameState {
  // Create empty board
  const board: BoardCell[][] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      board[row][col] = {
        tile: null,
        multiplier: row === 7 && col === 7 ? 'CENTER' : null,
        powerUp: null
      };
    }
  }

  return {
    board,
    players: [{
      id: 'player1',
      name: 'TestPlayer',
      tiles: [
        { id: 'tile1', letter: 'C', value: 3, isBlank: false },
        { id: 'tile2', letter: 'A', value: 1, isBlank: false },
        { id: 'tile3', letter: 'T', value: 1, isBlank: false }
      ],
      score: 0,
      hasEndedGame: false,
      activePowerUps: [],
      activePowerUpForTurn: null,
      isAI: false
    }],
    currentPlayerIndex: 0,
    tileBag: [],
    gamePhase: 'PLAYING',
    turnNumber: 1,
    playersEndedGame: [],
    moveHistory: []
  };
}

async function debugSimpleTest() {
  console.log('🔍 Starting Simple Debug Test...\n');

  try {
    // Test 1: Build a minimal GADDAG
    console.log('📝 Test 1: Building minimal GADDAG');
    const builder = new GADDAGBuilder({
      enableMinimization: false, // Disable for debugging
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: true,
      batchSize: 10
    });

    const testWords = ['CAT', 'AT', 'TO'];
    console.log(`   Building GADDAG from: ${testWords.join(', ')}`);
    
    const gaddag = await builder.buildFromWordList(testWords);
    console.log('   ✅ GADDAG built successfully');

    // Test 2: Inspect GADDAG structure
    console.log('\n📝 Test 2: Inspecting GADDAG structure');
    console.log('   Root node edges:', Array.from(gaddag.edges.keys()));
    
    // Check for 'CAT' variations
    const catVariations = ['CAT', 'AT_C', 'T_CA'];
    for (const variation of catVariations) {
      console.log(`   Checking path for "${variation}":`);
      let currentNode = gaddag;
      let pathValid = true;
      
      for (let i = 0; i < variation.length; i++) {
        const letter = variation[i];
        const childNode = currentNode.getChild(letter);
        if (childNode) {
          console.log(`     ${letter} -> found`);
          currentNode = childNode;
        } else {
          console.log(`     ${letter} -> NOT FOUND`);
          pathValid = false;
          break;
        }
      }
      
      if (pathValid) {
        console.log(`     End of word: ${currentNode.isEndOfWord}`);
      }
    }

    // Test 3: Manual move generation
    console.log('\n📝 Test 3: Manual move generation');
    const moveGenerator = new GADDAGMoveGenerator();
    
    // Override the GADDAG
    (moveGenerator as any).gaddag = gaddag;
    (moveGenerator as any).isInitialized = true;
    
    const gameState = createSimpleGameState();
    console.log('   Game state created with tiles: C, A, T');
    
    const moves = await moveGenerator.generateMoves(gameState, 'player1', {
      maxCandidates: 10,
      timeLimit: 1000,
      minScore: 0
    });
    
    console.log(`   Generated ${moves.length} moves:`);
    moves.forEach(move => {
      console.log(`     "${move.word}" at (${move.row},${move.col}) ${move.direction} - ${move.score} pts`);
    });

    // Test 4: Debug anchor points
    console.log('\n📝 Test 4: Debug anchor points');
    const anchors = (moveGenerator as any).findAnchorPoints(gameState.board);
    console.log(`   Found ${anchors.length} anchor points:`);
    anchors.forEach((anchor: any, index: number) => {
      console.log(`     ${index + 1}. (${anchor.row},${anchor.col}) ${anchor.direction} - limits: L${anchor.leftLimit} R${anchor.rightLimit}`);
    });

    // Test 5: Debug tile rack
    console.log('\n📝 Test 5: Debug tile rack');
    const rack = (moveGenerator as any).createTileRack(gameState.players[0].tiles);
    console.log('   Tile rack:', Object.fromEntries(rack));

    // Test 6: Manual GADDAG traversal
    console.log('\n📝 Test 6: Manual GADDAG traversal for "CAT"');
    
    // Try to find CAT in the GADDAG manually
    let node = gaddag;
    const word = 'CAT';
    
    console.log('   Traversing forward path:');
    for (let i = 0; i < word.length; i++) {
      const letter = word[i];
      const child = node.getChild(letter);
      if (child) {
        console.log(`     ${letter} -> found (isEndOfWord: ${child.isEndOfWord})`);
        node = child;
      } else {
        console.log(`     ${letter} -> NOT FOUND`);
        break;
      }
    }

    // Try reverse path (TAC_)
    console.log('   Traversing reverse path (TAC_):');
    node = gaddag;
    const reversePath = 'TAC_';
    for (let i = 0; i < reversePath.length; i++) {
      const letter = reversePath[i];
      const child = node.getChild(letter);
      if (child) {
        console.log(`     ${letter} -> found (isEndOfWord: ${child.isEndOfWord})`);
        node = child;
      } else {
        console.log(`     ${letter} -> NOT FOUND`);
        break;
      }
    }

    console.log('\n🎉 Simple Debug Test Complete!');

  } catch (error) {
    console.error('\n❌ Simple Debug Test Failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  debugSimpleTest().catch(console.error);
}

export { debugSimpleTest };
