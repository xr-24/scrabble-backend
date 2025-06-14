/**
 * Test the two-letter word fix
 */

import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';

async function testTwoLetterFix() {
  console.log('🔧 Testing Two-Letter Word Fix');
  console.log('=' .repeat(40));
  
  const builder = new CorrectGADDAGBuilder();
  
  // Test AT specifically
  console.log('\n📝 Testing word: AT');
  const gaddag = await builder.buildFromWordList(['AT']);
  
  // Expected paths for AT
  const expectedPaths = ['AT', 'A_T', 'T_A', 'TA'];
  let found = 0;
  
  for (const path of expectedPaths) {
    const canTraverse = canTraversePath(gaddag, path);
    console.log(`   ${path}: ${canTraverse ? '✅' : '❌'}`);
    if (canTraverse) found++;
  }
  
  console.log(`\n🎯 Result: ${found}/${expectedPaths.length} paths working`);
  
  if (found === expectedPaths.length) {
    console.log('✅ Two-letter word fix SUCCESSFUL!');
  } else {
    console.log('❌ Two-letter word fix still needs work');
  }
  
  return found === expectedPaths.length;
}

function canTraversePath(gaddag: any, path: string): boolean {
  let current = gaddag;
  
  for (const char of path) {
    const child = current.getChild?.(char) || current.edges?.get(char);
    if (!child) return false;
    current = child;
  }
  
  return current.isEndOfWord;
}

// Run the test
testTwoLetterFix().catch(console.error);
