/**
 * Debug GADDAG Construction
 * Simple test to understand what's happening with split word storage
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGNodeUtils } from './GADDAGNode';

async function debugGADDAG() {
  console.log('🔍 Debug GADDAG Construction...\n');

  const builder = new GADDAGBuilder({
    enableMinimization: false, // Disable for easier debugging
    maxWordLength: 10,
    minWordLength: 2,
    enableProgressReporting: false,
    batchSize: 100
  });

  // Test with just one word
  const testWord = 'HELLO';
  console.log(`Testing word: ${testWord}`);
  
  // Generate split words
  const splitWords = (builder as any).generateSplitWords(testWord);
  console.log(`Split words: ${splitWords.join(', ')}`);
  
  // Build GADDAG
  const gaddag = await builder.buildFromWordList([testWord]);
  
  // Debug: Find all words in the GADDAG
  const allWords = GADDAGNodeUtils.findAllWords(gaddag);
  console.log(`\nWords found in GADDAG: ${allWords.join(', ')}`);
  
  // Test traversal for each split word
  console.log('\nTesting traversal for each split word:');
  for (const splitWord of splitWords) {
    console.log(`\nTesting: ${splitWord}`);
    
    let current = gaddag;
    let path = '';
    let success = true;
    
    for (let i = 0; i < splitWord.length; i++) {
      const char = splitWord[i];
      path += char;
      
      console.log(`  Step ${i + 1}: Looking for '${char}' from node ${current.id}`);
      console.log(`    Available edges: [${current.getOutgoingLetters().join(', ')}]`);
      
      const child = current.getChild(char);
      if (!child) {
        console.log(`    ❌ No edge for '${char}'`);
        success = false;
        break;
      } else {
        console.log(`    ✅ Found edge to node ${child.id}`);
        current = child;
      }
    }
    
    if (success) {
      console.log(`  ✅ Successfully traversed: ${splitWord}`);
      console.log(`  End of word: ${current.isEndOfWord}`);
    } else {
      console.log(`  ❌ Failed to traverse: ${splitWord}`);
    }
  }
  
  // Debug: Print the entire GADDAG structure
  console.log('\n🌳 GADDAG Structure:');
  printGADDAGStructure(gaddag, '', new Set());
}

function printGADDAGStructure(node: any, prefix: string, visited: Set<number>, depth: number = 0) {
  if (visited.has(node.id) || depth > 10) {
    console.log(`${'  '.repeat(depth)}${prefix} -> [Node ${node.id}] (already visited)`);
    return;
  }
  
  visited.add(node.id);
  
  const endMarker = node.isEndOfWord ? ' *END*' : '';
  console.log(`${'  '.repeat(depth)}${prefix} -> [Node ${node.id}]${endMarker}`);
  
  for (const [letter, child] of node.edges) {
    printGADDAGStructure(child, letter, visited, depth + 1);
  }
}

// Run debug
if (require.main === module) {
  debugGADDAG().catch(console.error);
}

export { debugGADDAG };
