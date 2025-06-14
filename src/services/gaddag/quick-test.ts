/**
 * Quick test to verify GADDAG functionality
 */

import { GADDAGBuilder } from './GADDAGBuilder';

async function quickTest() {
  console.log('🔍 Quick GADDAG Test...');
  
  try {
    const builder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 10
    });

    const words = ['CAT', 'AT'];
    console.log(`Building GADDAG from: ${words.join(', ')}`);
    
    const gaddag = await builder.buildFromWordList(words);
    console.log('✅ GADDAG built successfully');
    
    // Check structure
    console.log('Root edges:', Array.from(gaddag.edges.keys()));
    
    // Test path traversal
    let node = gaddag;
    const testPath = 'AT_C';
    console.log(`Testing path: ${testPath}`);
    
    for (const letter of testPath) {
      const child = node.getChild(letter);
      if (child) {
        console.log(`  ${letter} -> found`);
        node = child;
      } else {
        console.log(`  ${letter} -> NOT FOUND`);
        break;
      }
    }
    
    console.log(`Final node isEndOfWord: ${node.isEndOfWord}`);
    console.log('🎉 Quick test complete!');
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
}

quickTest();
