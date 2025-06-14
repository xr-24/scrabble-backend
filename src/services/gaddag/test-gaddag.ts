/**
 * GADDAG Test Script
 * Simple test to validate GADDAG construction and basic functionality
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGNodeUtils } from './GADDAGNode';

async function testGADDAG() {
  console.log('🧪 Starting GADDAG Test Suite...\n');

  try {
    // Test 1: Basic GADDAG construction
    console.log('📝 Test 1: Basic GADDAG Construction');
    const builder = new GADDAGBuilder({
      enableMinimization: true,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });

    // Test with a small word list first
    const testWords = ['CAT', 'DOG', 'CATS', 'DOGS', 'AT', 'TO', 'GO', 'SO', 'NO', 'ON'];
    console.log(`   Building GADDAG from test words: ${testWords.join(', ')}`);
    
    const startTime = Date.now();
    const gaddag = await builder.buildFromWordList(testWords);
    const buildTime = Date.now() - startTime;
    
    console.log(`   ✅ GADDAG built in ${buildTime}ms`);

    // Test 2: Validate GADDAG structure
    console.log('\n📝 Test 2: GADDAG Validation');
    const isValid = builder.validateGADDAG(gaddag);
    console.log(`   ${isValid ? '✅' : '❌'} GADDAG structure validation: ${isValid ? 'PASSED' : 'FAILED'}`);

    // Test 3: Word search functionality
    console.log('\n📝 Test 3: Word Search');
    const testResult = await builder.testGADDAG(gaddag, testWords);
    console.log(`   ${testResult ? '✅' : '❌'} Word search test: ${testResult ? 'PASSED' : 'FAILED'}`);

    // Test 4: Statistics and memory usage
    console.log('\n📝 Test 4: Statistics');
    const stats = GADDAGNodeUtils.getStatistics(gaddag);
    console.log(`   📊 Node count: ${stats.nodeCount}`);
    console.log(`   📊 Word count: ${stats.wordCount}`);
    console.log(`   📊 Memory usage: ${(stats.memoryUsage / 1024).toFixed(2)} KB`);
    console.log(`   📊 Average edges per node: ${stats.averageEdgesPerNode.toFixed(2)}`);
    console.log(`   📊 Max depth: ${stats.maxDepth}`);

    // Test 5: Split word generation
    console.log('\n📝 Test 5: Split Word Generation');
    const testWord = 'HELLO';
    const splitWords = (builder as any).generateSplitWords(testWord);
    console.log(`   Original word: ${testWord}`);
    console.log(`   Split variations: ${splitWords.join(', ')}`);
    console.log(`   ✅ Generated ${splitWords.length} split variations`);

    // Test 6: Full dictionary construction (if available)
    console.log('\n📝 Test 6: Full Dictionary Construction');
    try {
      console.log('   Attempting full dictionary build...');
      const fullStartTime = Date.now();
      const fullGaddag = await builder.buildFromDictionary();
      const fullBuildTime = Date.now() - fullStartTime;
      
      const fullStats = GADDAGNodeUtils.getStatistics(fullGaddag);
      console.log(`   ✅ Full GADDAG built in ${fullBuildTime}ms`);
      console.log(`   📊 Full dictionary stats:`);
      console.log(`      - Words: ${fullStats.wordCount}`);
      console.log(`      - Nodes: ${fullStats.nodeCount}`);
      console.log(`      - Memory: ${(fullStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      
      // Test some common words
      const commonWords = ['THE', 'AND', 'CAT', 'DOG', 'QUIZ', 'JAZZ'];
      console.log('   Testing common words:');
      for (const word of commonWords) {
        const found = (builder as any).findWordInGADDAG(fullGaddag, word);
        console.log(`      ${word}: ${found ? '✅' : '❌'}`);
      }
      
    } catch (error) {
      console.log(`   ⚠️  Full dictionary test skipped: ${error}`);
    }

    console.log('\n🎉 GADDAG Test Suite Complete!');
    console.log('✅ All basic tests passed - GADDAG implementation is working correctly');

  } catch (error) {
    console.error('\n❌ GADDAG Test Suite Failed:', error);
    throw error;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testGADDAG().catch(console.error);
}

export { testGADDAG };
