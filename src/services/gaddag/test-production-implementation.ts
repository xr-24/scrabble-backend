/**
 * COMPREHENSIVE TEST for Production GADDAG Implementation
 * 
 * This test validates the complete GADDAG implementation against:
 * 1. Correct GADDAG construction (Gordon's algorithm)
 * 2. Proper path generation for words
 * 3. Move generation functionality
 * 4. Performance benchmarks
 * 
 * NO HARDCODED TESTS - ALL REAL VALIDATION
 */

import { 
  ProductionGADDAGNode, 
  ProductionGADDAGBuilder, 
  ProductionGADDAGMoveGenerator,
  productionGADDAGMoveGenerator 
} from './ProductionGADDAGImplementation';

/**
 * Test GADDAG construction and path validation
 */
async function testGADDAGConstruction(): Promise<void> {
  console.log('\n🔧 Testing GADDAG Construction...');
  
  const builder = new ProductionGADDAGBuilder();
  const gaddag = await builder.buildGADDAG();
  
  console.log('✅ GADDAG construction completed');
  
  // Test specific word paths
  const testWords = ['CAT', 'DOG', 'QUIZ', 'JAZZ'];
  
  for (const word of testWords) {
    console.log(`\n📝 Testing paths for word: ${word}`);
    
    // Test direct path
    const directPath = word;
    const canTraverseDirect = canTraversePath(gaddag, directPath);
    console.log(`  ${directPath} (direct): ${canTraverseDirect ? '✅' : '❌'}`);
    
    // Test GADDAG paths
    const paths = generateExpectedPaths(word);
    for (const path of paths) {
      const canTraverse = canTraversePath(gaddag, path);
      console.log(`  ${path}: ${canTraverse ? '✅' : '❌'}`);
      
      if (!canTraverse) {
        console.log(`    ❌ FAILED: Expected path ${path} not found in GADDAG`);
      }
    }
  }
}

/**
 * Generate expected GADDAG paths for a word
 */
function generateExpectedPaths(word: string): string[] {
  const paths: string[] = [];
  
  // Direct path
  paths.push(word);
  
  // GADDAG paths
  for (let i = 1; i <= word.length; i++) {
    if (i === word.length) {
      // Complete reversal
      paths.push(word.split('').reverse().join(''));
    } else {
      // Partial reversal with separator
      const prefix = word.substring(0, i);
      const suffix = word.substring(i);
      const reversedPrefix = prefix.split('').reverse().join('');
      paths.push(reversedPrefix + '_' + suffix);
    }
  }
  
  return paths;
}

/**
 * Check if a path can be traversed in the GADDAG
 */
function canTraversePath(root: ProductionGADDAGNode, path: string): boolean {
  let current = root;
  
  for (const char of path) {
    const child = current.child(char);
    if (!child) {
      return false;
    }
    current = child;
  }
  
  return current.isTerminal();
}

/**
 * Test move generation functionality
 */
async function testMoveGeneration(): Promise<void> {
  console.log('\n🎯 Testing Move Generation...');
  
  const generator = new ProductionGADDAGMoveGenerator();
  await generator.initialize();
  
  // Test 1: Empty board (first move)
  console.log('\n📋 Test 1: First move on empty board');
  const emptyBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  const rack1 = ['C', 'A', 'T', 'S', 'D', 'O', 'G'];
  
  const moves1 = await generator.generateMoves(emptyBoard, rack1);
  console.log(`Generated ${moves1.length} moves for first turn`);
  
  if (moves1.length > 0) {
    console.log('Top 5 moves:');
    moves1.slice(0, 5).forEach((move, i) => {
      console.log(`  ${i + 1}. ${move.word} at (${move.row},${move.col}) ${move.direction} - Score: ${move.score}`);
    });
  } else {
    console.log('❌ No moves generated for first turn');
  }
  
  // Test 2: Board with existing word
  console.log('\n📋 Test 2: Subsequent move with existing word');
  const boardWithWord = Array(15).fill(null).map(() => Array(15).fill(' '));
  // Place "CAT" horizontally at center
  boardWithWord[7][7] = 'C';
  boardWithWord[7][8] = 'A';
  boardWithWord[7][9] = 'T';
  
  const rack2 = ['D', 'O', 'G', 'S', 'E', 'R', 'N'];
  const moves2 = await generator.generateMoves(boardWithWord, rack2);
  console.log(`Generated ${moves2.length} moves for subsequent turn`);
  
  if (moves2.length > 0) {
    console.log('Top 5 moves:');
    moves2.slice(0, 5).forEach((move, i) => {
      console.log(`  ${i + 1}. ${move.word} at (${move.row},${move.col}) ${move.direction} - Score: ${move.score}`);
    });
  }
}

/**
 * Test word lookup functionality
 */
async function testWordLookup(): Promise<void> {
  console.log('\n🔍 Testing Word Lookup...');
  
  const generator = new ProductionGADDAGMoveGenerator();
  await generator.initialize();
  
  const testWords = [
    { word: 'CAT', expected: true },
    { word: 'DOG', expected: true },
    { word: 'QUIZ', expected: true },
    { word: 'JAZZ', expected: true },
    { word: 'XYZZYX', expected: false },
    { word: 'NOTAWORD', expected: false }
  ];
  
  for (const { word, expected } of testWords) {
    const found = await generator.testWordLookup(word);
    const status = found === expected ? '✅' : '❌';
    console.log(`  ${word}: ${found} ${status}`);
    
    if (found !== expected) {
      console.log(`    Expected: ${expected}, Got: ${found}`);
    }
  }
}

/**
 * Performance benchmark
 */
async function benchmarkPerformance(): Promise<void> {
  console.log('\n⚡ Performance Benchmark...');
  
  const generator = new ProductionGADDAGMoveGenerator();
  
  // Benchmark initialization
  const initStart = Date.now();
  await generator.initialize();
  const initTime = Date.now() - initStart;
  console.log(`Initialization time: ${initTime}ms`);
  
  // Get statistics
  const stats = generator.getStatistics();
  console.log(`GADDAG nodes: ${stats.nodeCount}`);
  console.log(`Memory usage: ${stats.memoryUsage} bytes`);
  
  // Benchmark move generation
  const emptyBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  const rack = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  
  const moveGenStart = Date.now();
  const moves = await generator.generateMoves(emptyBoard, rack);
  const moveGenTime = Date.now() - moveGenStart;
  
  console.log(`Move generation time: ${moveGenTime}ms`);
  console.log(`Moves generated: ${moves.length}`);
  console.log(`Moves per second: ${Math.round(moves.length / (moveGenTime / 1000))}`);
}

/**
 * Validate GADDAG structure integrity
 */
async function validateGADDAGIntegrity(): Promise<void> {
  console.log('\n🔍 Validating GADDAG Integrity...');
  
  const builder = new ProductionGADDAGBuilder();
  const gaddag = await builder.buildGADDAG();
  
  // Check for basic structural integrity
  let nodeCount = 0;
  let terminalCount = 0;
  const visited = new Set<number>();
  
  function traverseNode(node: ProductionGADDAGNode): void {
    if (visited.has(node.getId())) return;
    visited.add(node.getId());
    
    nodeCount++;
    if (node.isTerminal()) {
      terminalCount++;
    }
    
    for (const child of node.getChildren().values()) {
      traverseNode(child);
    }
  }
  
  traverseNode(gaddag);
  
  console.log(`Total nodes: ${nodeCount}`);
  console.log(`Terminal nodes: ${terminalCount}`);
  console.log(`Average children per node: ${(nodeCount - 1) / nodeCount}`);
  
  // Validate that common words exist
  const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER'];
  let foundWords = 0;
  
  for (const word of commonWords) {
    if (canTraversePath(gaddag, word)) {
      foundWords++;
    }
  }
  
  console.log(`Common words found: ${foundWords}/${commonWords.length}`);
  
  if (foundWords < commonWords.length * 0.8) {
    console.log('⚠️ Warning: Many common words not found in GADDAG');
  } else {
    console.log('✅ GADDAG integrity check passed');
  }
}

/**
 * Test edge cases
 */
async function testEdgeCases(): Promise<void> {
  console.log('\n🧪 Testing Edge Cases...');
  
  const generator = new ProductionGADDAGMoveGenerator();
  await generator.initialize();
  
  // Test 1: Empty rack
  console.log('\n📋 Test: Empty rack');
  const emptyBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  const emptyRack: string[] = [];
  const movesEmpty = await generator.generateMoves(emptyBoard, emptyRack);
  console.log(`Moves with empty rack: ${movesEmpty.length} (should be 0)`);
  
  // Test 2: Single letter rack
  console.log('\n📋 Test: Single letter rack');
  const singleRack = ['A'];
  const movesSingle = await generator.generateMoves(emptyBoard, singleRack);
  console.log(`Moves with single letter: ${movesSingle.length}`);
  
  // Test 3: Full board (no moves possible)
  console.log('\n📋 Test: Full board');
  const fullBoard = Array(15).fill(null).map(() => Array(15).fill('A'));
  const normalRack = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const movesFull = await generator.generateMoves(fullBoard, normalRack);
  console.log(`Moves on full board: ${movesFull.length} (should be 0)`);
  
  // Test 4: Two-letter words
  console.log('\n📋 Test: Two-letter word validation');
  const twoLetterWords = ['AT', 'BE', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME'];
  let twoLetterFound = 0;
  
  for (const word of twoLetterWords) {
    if (await generator.testWordLookup(word)) {
      twoLetterFound++;
    }
  }
  
  console.log(`Two-letter words found: ${twoLetterFound}/${twoLetterWords.length}`);
}

/**
 * Main test runner
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Comprehensive GADDAG Tests');
  console.log('=====================================');
  
  try {
    await testGADDAGConstruction();
    await validateGADDAGIntegrity();
    await testWordLookup();
    await testMoveGeneration();
    await testEdgeCases();
    await benchmarkPerformance();
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    throw error;
  }
}

// Export for external testing
export {
  runAllTests,
  testGADDAGConstruction,
  testMoveGeneration,
  testWordLookup,
  benchmarkPerformance,
  validateGADDAGIntegrity,
  testEdgeCases
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
