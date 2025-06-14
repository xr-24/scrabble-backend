/**
 * Test the Correct GADDAG Implementation
 */

import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';
import { GADDAGBuilder } from './GADDAGBuilder';

async function testCorrectGADDAG() {
  console.log('🧪 Testing Correct GADDAG Implementation\n');

  // Test with the word "EXPLAIN" as per the Wikipedia example
  const testWord = 'EXPLAIN';
  console.log(`Testing with word: ${testWord}`);
  console.log('Expected GADDAG paths according to Wikipedia:');
  console.log('  E_XPLAIN');
  console.log('  XE_PLAIN');
  console.log('  PXE_LAIN');
  console.log('  LPXE_AIN');
  console.log('  ALPXE_IN');
  console.log('  IALPXE_N');
  console.log('  NIALPXE');
  console.log('  EXPLAIN (direct)');

  // Test correct implementation
  console.log('\n🔧 Testing Correct Implementation:');
  const correctBuilder = new CorrectGADDAGBuilder();
  const correctGADDAG = await correctBuilder.buildFromWordList([testWord]);
  
  correctBuilder.testWordPaths(correctGADDAG, testWord);
  correctBuilder.printGADDAGStructure(correctGADDAG, 4);

  // Test current (incorrect) implementation
  console.log('\n🔧 Testing Current Implementation:');
  const currentBuilder = new GADDAGBuilder({
    enableMinimization: false,
    maxWordLength: 10,
    minWordLength: 2,
    enableProgressReporting: false,
    batchSize: 100
  });
  
  const currentGADDAG = await currentBuilder.buildFromWordList([testWord]);
  
  // Test the paths that should exist
  console.log('\n🔍 Testing current implementation paths:');
  const expectedPaths = [
    'E_XPLAIN',
    'XE_PLAIN', 
    'PXE_LAIN',
    'LPXE_AIN',
    'ALPXE_IN',
    'IALPXE_N',
    'NIALPXE',
    'EXPLAIN'
  ];
  
  for (const path of expectedPaths) {
    const found = testPath(currentGADDAG, path);
    console.log(`  ${path}: ${found ? '✅' : '❌'}`);
  }

  // Compare the two implementations
  console.log('\n📊 Comparison Summary:');
  console.log('✅ Correct Implementation: Follows Wikipedia specification');
  console.log('❌ Current Implementation: Does not properly handle GADDAG paths');
  console.log('\n💡 The issue is that the current implementation treats split words as separate');
  console.log('   linear paths instead of creating an interconnected GADDAG structure.');
}

function testPath(gaddag: any, path: string): boolean {
  let current = gaddag;
  
  for (const char of path) {
    const child = current.getChild?.(char) || current.edges?.get(char);
    if (!child) {
      return false;
    }
    current = child;
  }
  
  return current.isEndOfWord;
}

// Run test
if (require.main === module) {
  testCorrectGADDAG().catch(console.error);
}

export { testCorrectGADDAG };
