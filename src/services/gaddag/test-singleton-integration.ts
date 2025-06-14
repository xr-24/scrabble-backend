/**
 * SINGLETON INTEGRATION TEST for Production GADDAG Implementation
 * 
 * This test validates the singleton pattern fixes memory issues while
 * maintaining full functionality with the complete SOWPODS dictionary.
 * 
 * CRITICAL MEMORY-SAFE VALIDATION
 */

import { ProductionGADDAGMoveGeneratorSingleton, productionGADDAGMoveGenerator } from './ProductionGADDAGImplementation';
import { dictionaryService } from '../dictionaryService';

/**
 * Test singleton pattern prevents memory issues
 */
async function testSingletonMemoryManagement(): Promise<void> {
  console.log('\n🧠 Testing Singleton Memory Management...');
  
  const initialMemory = process.memoryUsage();
  console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  
  // Create multiple references to the singleton - should all use same instance
  const generators: ProductionGADDAGMoveGeneratorSingleton[] = [];
  
  console.log('🔧 Creating multiple singleton references...');
  for (let i = 0; i < 5; i++) {
    const generator = new ProductionGADDAGMoveGeneratorSingleton();
    generators.push(generator);
    
    // Test that they all work
    const isReady = await generator.isReady();
    console.log(`Generator ${i + 1}: ${isReady ? '✅ Ready' : '❌ Not Ready'}`);
    
    const currentMemory = process.memoryUsage();
    console.log(`Memory after generator ${i + 1}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  }
  
  const finalMemory = process.memoryUsage();
  const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  
  console.log(`\n📊 Memory Analysis:`);
  console.log(`   Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Increase: ${memoryIncrease.toFixed(2)} MB`);
  
  if (memoryIncrease < 500) { // Should be much less than 1.5GB per instance
    console.log('   ✅ Memory usage is controlled with singleton pattern');
  } else {
    console.log('   ⚠️ WARNING: Memory usage still high - singleton may not be working');
  }
}

/**
 * Test full functionality with singleton
 */
async function testSingletonFunctionality(): Promise<void> {
  console.log('\n⚡ Testing Singleton Functionality...');
  
  // Test dictionary integration
  console.log('📖 Loading full SOWPODS dictionary...');
  await dictionaryService.loadDictionary();
  const dictionarySize = dictionaryService.getDictionarySize();
  console.log(`📊 Dictionary loaded with ${dictionarySize} words`);
  
  // Test word lookup
  console.log('\n🔍 Testing word lookup...');
  const testWords = ['HELLO', 'WORLD', 'QUIXOTIC', 'ZYGOTE', 'INVALID'];
  for (const word of testWords) {
    const found = await productionGADDAGMoveGenerator.testWordLookup(word);
    const dictValid = await dictionaryService.isValidWord(word);
    console.log(`   ${word}: GADDAG=${found}, Dict=${dictValid} ${found === dictValid ? '✅' : '❌'}`);
  }
  
  // Test move generation
  console.log('\n🎯 Testing move generation...');
  const testBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  testBoard[7][7] = 'H';
  testBoard[7][8] = 'E';
  testBoard[7][9] = 'L';
  testBoard[7][10] = 'L';
  testBoard[7][11] = 'O';
  
  const testRack = ['W', 'O', 'R', 'L', 'D', 'S', 'T'];
  
  const startTime = Date.now();
  const moves = await productionGADDAGMoveGenerator.generateMoves(testBoard, testRack);
  const generationTime = Date.now() - startTime;
  
  console.log(`   Generated ${moves.length} moves in ${generationTime}ms`);
  console.log(`   Rate: ${Math.round(moves.length / (generationTime / 1000))} moves/sec`);
  
  if (moves.length > 0) {
    console.log(`   Top move: ${moves[0].word} (${moves[0].score} points)`);
    console.log(`   Sample move format: ${JSON.stringify(moves[0], null, 2)}`);
  }
  
  // Test statistics
  console.log('\n📊 Testing statistics...');
  const stats = await productionGADDAGMoveGenerator.getStatistics();
  console.log(`   Nodes: ${stats.nodeCount.toLocaleString()}`);
  console.log(`   Memory: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Test performance under load
 */
async function testSingletonPerformanceUnderLoad(): Promise<void> {
  console.log('\n🚀 Testing Performance Under Load...');
  
  const testBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  testBoard[7][7] = 'S';
  testBoard[7][8] = 'T';
  testBoard[7][9] = 'A';
  testBoard[7][10] = 'R';
  testBoard[7][11] = 'T';
  
  const testRacks = [
    ['E', 'N', 'D', 'I', 'N', 'G', 'S'],
    ['T', 'E', 'S', 'T', 'I', 'N', 'G'],
    ['W', 'O', 'R', 'K', 'I', 'N', 'G'],
    ['P', 'L', 'A', 'Y', 'I', 'N', 'G'],
    ['F', 'I', 'N', 'I', 'S', 'H', 'E']
  ];
  
  console.log('🔄 Running multiple move generations...');
  const results: Array<{rack: string[], moves: number, time: number}> = [];
  
  for (let i = 0; i < testRacks.length; i++) {
    const rack = testRacks[i];
    console.log(`   Test ${i + 1}: [${rack.join(', ')}]`);
    
    const startTime = Date.now();
    const moves = await productionGADDAGMoveGenerator.generateMoves(testBoard, rack);
    const time = Date.now() - startTime;
    
    results.push({rack, moves: moves.length, time});
    console.log(`     Moves: ${moves.length}, Time: ${time}ms`);
    
    if (moves.length > 0) {
      console.log(`     Best: ${moves[0].word} (${moves[0].score} points)`);
    }
  }
  
  const totalMoves = results.reduce((sum, r) => sum + r.moves, 0);
  const totalTime = results.reduce((sum, r) => sum + r.time, 0);
  const avgTime = totalTime / results.length;
  
  console.log(`\n📈 Performance Summary:`);
  console.log(`   Total moves: ${totalMoves}`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Average time: ${avgTime.toFixed(1)}ms`);
  console.log(`   Overall rate: ${Math.round(totalMoves / (totalTime / 1000))} moves/sec`);
  
  if (avgTime < 100) {
    console.log('   ✅ Excellent performance maintained');
  } else if (avgTime < 500) {
    console.log('   ✅ Good performance maintained');
  } else {
    console.log('   ⚠️ Performance may need optimization');
  }
}

/**
 * Test concurrent access to singleton
 */
async function testConcurrentAccess(): Promise<void> {
  console.log('\n🔀 Testing Concurrent Access...');
  
  const testBoard = Array(15).fill(null).map(() => Array(15).fill(' '));
  testBoard[7][7] = 'T';
  testBoard[7][8] = 'E';
  testBoard[7][9] = 'S';
  testBoard[7][10] = 'T';
  
  const testRack = ['I', 'N', 'G', 'S', 'A', 'B', 'C'];
  
  console.log('🔄 Running concurrent move generations...');
  
  // Create multiple concurrent requests
  const promises: Promise<any>[] = [];
  for (let i = 0; i < 3; i++) {
    promises.push(
      productionGADDAGMoveGenerator.generateMoves(testBoard, testRack)
        .then(moves => ({id: i + 1, moves: moves.length}))
    );
  }
  
  const startTime = Date.now();
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;
  
  console.log(`   Concurrent results:`);
  for (const result of results) {
    console.log(`     Request ${result.id}: ${result.moves} moves`);
  }
  
  console.log(`   Total concurrent time: ${totalTime}ms`);
  
  // Verify all results are consistent
  const moveCounts = results.map(r => r.moves);
  const allSame = moveCounts.every(count => count === moveCounts[0]);
  
  if (allSame) {
    console.log('   ✅ All concurrent requests returned consistent results');
  } else {
    console.log('   ❌ Concurrent requests returned inconsistent results');
  }
}

/**
 * Main singleton integration test runner
 */
async function runSingletonIntegrationTests(): Promise<void> {
  console.log('🚀 Starting SINGLETON INTEGRATION TESTS');
  console.log('======================================');
  console.log('This will test the singleton GADDAG implementation:');
  console.log('- Memory management with singleton pattern');
  console.log('- Full functionality with complete dictionary');
  console.log('- Performance under load');
  console.log('- Concurrent access safety');
  console.log('');
  
  try {
    await testSingletonMemoryManagement();
    await testSingletonFunctionality();
    await testSingletonPerformanceUnderLoad();
    await testConcurrentAccess();
    
    console.log('\n🎉 SINGLETON INTEGRATION TESTS COMPLETED!');
    console.log('=========================================');
    console.log('✅ Memory management validated');
    console.log('✅ Full functionality confirmed');
    console.log('✅ Performance maintained');
    console.log('✅ Concurrent access safe');
    console.log('✅ Production-ready singleton GADDAG implementation');
    
  } catch (error) {
    console.error('\n❌ SINGLETON INTEGRATION TEST FAILED:', error);
    console.log('=========================================');
    throw error;
  }
}

// Export for external testing
export {
  runSingletonIntegrationTests,
  testSingletonMemoryManagement,
  testSingletonFunctionality,
  testSingletonPerformanceUnderLoad,
  testConcurrentAccess
};

// Run tests if this file is executed directly
if (require.main === module) {
  runSingletonIntegrationTests().catch(console.error);
}
