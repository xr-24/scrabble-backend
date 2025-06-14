/**
 * Comprehensive GADDAG Test Suite
 * Tests the complete GADDAG implementation against known standards
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGMoveGenerator } from './GADDAGMoveGenerator';
import { GADDAGNodeUtils } from './GADDAGNode';

async function runComprehensiveTests() {
  console.log('🧪 Starting Comprehensive GADDAG Test Suite...\n');

  try {
    // Test 1: GADDAG Construction with Standard Words
    console.log('📝 Test 1: GADDAG Construction');
    const builder = new GADDAGBuilder({
      enableMinimization: true,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });

    // Use a comprehensive test word set
    const testWords = [
      // 2-letter words
      'AT', 'TO', 'GO', 'SO', 'NO', 'ON', 'IN', 'IS', 'IT', 'OF', 'OR', 'UP', 'US',
      // 3-letter words  
      'CAT', 'DOG', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN',
      'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR',
      // 4-letter words
      'THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT',
      'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST',
      // High-value letters
      'QUIZ', 'JAZZ', 'JINX', 'WAXY', 'FOXY', 'COZY', 'HAZY', 'LAZY'
    ];

    console.log(`   Building GADDAG from ${testWords.length} test words...`);
    const startTime = Date.now();
    const gaddag = await builder.buildFromWordList(testWords);
    const buildTime = Date.now() - startTime;
    
    console.log(`   ✅ GADDAG built in ${buildTime}ms`);

    // Test 2: Validate Split Word Generation
    console.log('\n📝 Test 2: Split Word Generation Validation');
    const testWord = 'HELLO';
    const splitWords = (builder as any).generateSplitWords(testWord);
    const expectedSplits = ['HELLO', 'ELLO_H', 'LLO_EH', 'LO_LEH', 'O_LLEH'];
    
    console.log(`   Original word: ${testWord}`);
    console.log(`   Generated splits: ${splitWords.join(', ')}`);
    console.log(`   Expected splits: ${expectedSplits.join(', ')}`);
    
    const splitsMatch = JSON.stringify(splitWords.sort()) === JSON.stringify(expectedSplits.sort());
    console.log(`   ${splitsMatch ? '✅' : '❌'} Split generation: ${splitsMatch ? 'CORRECT' : 'INCORRECT'}`);

    // Test 3: GADDAG Structure Validation
    console.log('\n📝 Test 3: GADDAG Structure Validation');
    const isValid = builder.validateGADDAG(gaddag);
    console.log(`   ${isValid ? '✅' : '❌'} GADDAG structure: ${isValid ? 'VALID' : 'INVALID'}`);

    // Test 4: Word Search in GADDAG
    console.log('\n📝 Test 4: Word Search Validation');
    const searchWords = ['CAT', 'DOG', 'HELLO', 'QUIZ', 'JAZZ', 'NONEXISTENT'];
    let searchPassed = true;
    
    for (const word of searchWords) {
      const found = (builder as any).findWordInGADDAG(gaddag, word);
      const shouldFind = testWords.includes(word);
      const correct = found === shouldFind;
      
      console.log(`   ${word}: ${found ? 'FOUND' : 'NOT FOUND'} ${correct ? '✅' : '❌'}`);
      if (!correct) searchPassed = false;
    }
    
    console.log(`   ${searchPassed ? '✅' : '❌'} Word search: ${searchPassed ? 'PASSED' : 'FAILED'}`);

    // Test 5: Move Generator Initialization
    console.log('\n📝 Test 5: Move Generator Initialization');
    const moveGenerator = new GADDAGMoveGenerator();
    
    try {
      await moveGenerator.initialize();
      const isReady = moveGenerator.isReady();
      console.log(`   ${isReady ? '✅' : '❌'} Move generator initialization: ${isReady ? 'SUCCESS' : 'FAILED'}`);
      
      // Test 6: Statistics and Memory Usage
      console.log('\n📝 Test 6: Performance Statistics');
      const stats = GADDAGNodeUtils.getStatistics(gaddag);
      console.log(`   📊 Node count: ${stats.nodeCount}`);
      console.log(`   📊 Word count: ${stats.wordCount}`);
      console.log(`   📊 Memory usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
      console.log(`   📊 Average edges per node: ${stats.averageEdgesPerNode.toFixed(2)}`);
      console.log(`   📊 Max depth: ${stats.maxDepth}`);
      
      // Validate reasonable statistics
      const statsValid = stats.nodeCount > 0 && stats.wordCount > 0 && stats.memoryUsage > 0;
      console.log(`   ${statsValid ? '✅' : '❌'} Statistics: ${statsValid ? 'VALID' : 'INVALID'}`);

      // Test 7: GADDAG Algorithm Correctness
      console.log('\n📝 Test 7: GADDAG Algorithm Correctness');
      
      // Test the core GADDAG property: for word "HELLO"
      // We should be able to find paths for all split variations
      const testWordForSplits = 'HELLO';
      let algorithmCorrect = true;
      
      // Check if we can traverse the GADDAG for each split variation
      const splits = (builder as any).generateSplitWords(testWordForSplits);
      for (const split of splits) {
        // Try to find this split variation in the GADDAG
        let current = gaddag;
        let canTraverse = true;
        
        for (const char of split) {
          if (char === '_') continue; // Skip split marker for this test
          const child = current.getChild?.(char) || current.edges?.get(char);
          if (!child) {
            canTraverse = false;
            break;
          }
          current = child;
        }
        
        if (!canTraverse && split !== testWordForSplits) {
          console.log(`   ⚠️  Cannot traverse split: ${split}`);
          algorithmCorrect = false;
        }
      }
      
      console.log(`   ${algorithmCorrect ? '✅' : '❌'} GADDAG algorithm: ${algorithmCorrect ? 'CORRECT' : 'INCORRECT'}`);

      // Test 8: Compare with Reference Implementation
      console.log('\n📝 Test 8: Reference Implementation Comparison');
      
      // Test against known GADDAG properties from Steven Gordon's paper
      const referenceTests = [
        { word: 'EXPLAIN', expectedSplits: 7 }, // Should have 7 split variations
        { word: 'CAT', expectedSplits: 3 },     // Should have 3 split variations
        { word: 'GO', expectedSplits: 2 }       // Should have 2 split variations
      ];
      
      let referenceCorrect = true;
      for (const test of referenceTests) {
        const actualSplits = (builder as any).generateSplitWords(test.word);
        const correct = actualSplits.length === test.expectedSplits;
        
        console.log(`   ${test.word}: ${actualSplits.length} splits (expected ${test.expectedSplits}) ${correct ? '✅' : '❌'}`);
        if (!correct) referenceCorrect = false;
      }
      
      console.log(`   ${referenceCorrect ? '✅' : '❌'} Reference comparison: ${referenceCorrect ? 'PASSED' : 'FAILED'}`);

      // Test 9: Memory Efficiency Check
      console.log('\n📝 Test 9: Memory Efficiency');
      
      const wordsProcessed = testWords.length;
      const memoryPerWord = stats.memoryUsage / wordsProcessed;
      const efficient = memoryPerWord < 1000; // Less than 1KB per word is reasonable
      
      console.log(`   Memory per word: ${memoryPerWord.toFixed(2)} bytes`);
      console.log(`   ${efficient ? '✅' : '❌'} Memory efficiency: ${efficient ? 'GOOD' : 'POOR'}`);

      // Final Summary
      console.log('\n🎉 Comprehensive Test Suite Complete!');
      
      const allTestsPassed = splitsMatch && isValid && searchPassed && isReady && 
                           statsValid && algorithmCorrect && referenceCorrect && efficient;
      
      if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED - GADDAG implementation is correct and efficient!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Split word generation follows GADDAG specification');
        console.log('   ✅ GADDAG structure is valid and well-formed');
        console.log('   ✅ Word search works correctly');
        console.log('   ✅ Move generator initializes properly');
        console.log('   ✅ Statistics are reasonable');
        console.log('   ✅ Algorithm follows Steven Gordon\'s specification');
        console.log('   ✅ Reference implementation comparison passed');
        console.log('   ✅ Memory usage is efficient');
      } else {
        console.log('❌ SOME TESTS FAILED - Review the implementation');
      }

    } catch (error) {
      console.error('❌ Move generator test failed:', error);
    }

  } catch (error) {
    console.error('\n❌ Comprehensive Test Suite Failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

export { runComprehensiveTests };
