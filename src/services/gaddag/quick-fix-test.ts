/**
 * Quick test to verify GADDAG fix
 */

import { GADDAGBuilder } from './GADDAGBuilder';

async function quickTest() {
  console.log('🧪 Quick GADDAG Fix Test');
  console.log('=' .repeat(40));
  
  const builder = new GADDAGBuilder({
    enableMinimization: false,
    maxWordLength: 10,
    minWordLength: 2,
    enableProgressReporting: false,
    batchSize: 100
  });
  
  // Test with EXPLAIN word
  const gaddag = await builder.buildFromWordList(['EXPLAIN']);
  
  // Test Wikipedia paths
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
  
  console.log('\n📝 Testing Wikipedia paths for EXPLAIN:');
  let found = 0;
  for (const path of expectedPaths) {
    const canTraverse = canTraversePath(gaddag, path);
    console.log(`   ${path}: ${canTraverse ? '✅' : '❌'}`);
    if (canTraverse) found++;
  }
  
  console.log(`\n🎯 Result: ${found}/${expectedPaths.length} paths working`);
  
  if (found === expectedPaths.length) {
    console.log('✅ GADDAG fix successful!');
  } else {
    console.log('❌ GADDAG still needs work');
  }
  
  // Test two-letter word
  console.log('\n📝 Testing two-letter word AT:');
  const atGaddag = await builder.buildFromWordList(['AT']);
  const atPaths = ['A_T', 'T_A', 'AT'];
  let atFound = 0;
  
  for (const path of atPaths) {
    const canTraverse = canTraversePath(atGaddag, path);
    console.log(`   ${path}: ${canTraverse ? '✅' : '❌'}`);
    if (canTraverse) atFound++;
  }
  
  console.log(`\n🎯 Two-letter result: ${atFound}/${atPaths.length} paths working`);
}

function canTraversePath(gaddag: any, path: string): boolean {
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

// Run the test
quickTest().catch(console.error);
