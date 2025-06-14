import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';

async function debugTwoLetterWords() {
  console.log('🔍 Debugging Two-Letter Words');
  
  const builder = new CorrectGADDAGBuilder();
  const gaddag = await builder.buildFromWordList(['AT']);
  
  console.log('\n📋 Expected paths for AT:');
  const expectedPaths = [
    'AT',      // direct
    'A_T',     // split after A
    'TA'       // complete reversal
  ];
  
  for (const path of expectedPaths) {
    const found = canTraversePath(gaddag, path);
    console.log(`  ${path}: ${found ? '✅' : '❌'}`);
  }
  
  // Debug the structure
  console.log('\n🌳 GADDAG Structure for AT:');
  builder.printGADDAGStructure(gaddag, 4);
}

function canTraversePath(gaddag: any, path: string): boolean {
  let current = gaddag;
  
  for (const char of path) {
    const child = current.getChild?.(char) || current.edges?.get(char);
    if (!child) {
      console.log(`    Failed at character '${char}' in path '${path}'`);
      return false;
    }
    current = child;
  }
  
  const result = current.isEndOfWord;
  if (!result) {
    console.log(`    Reached end of path '${path}' but not marked as end of word`);
  }
  return result;
}

debugTwoLetterWords().catch(console.error);
