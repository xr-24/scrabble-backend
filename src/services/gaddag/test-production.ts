/**
 * Test the production GADDAG implementation
 */

import { ProductionGADDAGBuilder } from './ProductionGADDAGBuilder';

async function testProduction() {
  console.log('🚀 Testing Production GADDAG Implementation');
  console.log('=' .repeat(50));
  
  const builder = new ProductionGADDAGBuilder();
  
  // Test 1: Two-letter word (critical failure point)
  console.log('\n📝 Test 1: Two-letter word AT');
  const atGaddag = await builder.buildFromWordList(['AT']);
  const atTest = builder.testWordPaths(atGaddag, 'AT');
  console.log(`   Result: ${atTest.found}/${atTest.total} paths`);
  atTest.details.forEach(detail => console.log(`     ${detail}`));
  
  // Test 2: Wikipedia reference EXPLAIN
  console.log('\n📝 Test 2: Wikipedia reference EXPLAIN');
  const explainGaddag = await builder.buildFromWordList(['EXPLAIN']);
  const explainTest = builder.testWordPaths(explainGaddag, 'EXPLAIN');
  console.log(`   Result: ${explainTest.found}/${explainTest.total} paths`);
  explainTest.details.forEach(detail => console.log(`     ${detail}`));
  
  // Test 3: Memory efficiency with 100 words
  console.log('\n📝 Test 3: Memory efficiency (100 words)');
  const words100 = [
    'CAT', 'DOG', 'HELLO', 'WORLD', 'EXPLAIN', 'GADDAG', 'SCRABBLE', 'GAME',
    'AT', 'GO', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'IS', 'IT', 'YOU', 'THAT',
    'HE', 'WAS', 'FOR', 'ON', 'ARE', 'AS', 'WITH', 'HIS', 'THEY', 'I', 'HAVE',
    'FROM', 'OR', 'ONE', 'HAD', 'BY', 'WORD', 'BUT', 'NOT', 'WHAT', 'ALL',
    'WERE', 'WE', 'WHEN', 'YOUR', 'CAN', 'SAID', 'THERE', 'EACH', 'WHICH',
    'SHE', 'DO', 'HOW', 'THEIR', 'IF', 'WILL', 'UP', 'OTHER', 'ABOUT', 'OUT',
    'MANY', 'THEN', 'THEM', 'THESE', 'SO', 'SOME', 'HER', 'WOULD', 'MAKE',
    'LIKE', 'INTO', 'HIM', 'TIME', 'TWO', 'MORE', 'VERY', 'AFTER', 'WORDS',
    'LONG', 'JUST', 'WAY', 'COME', 'COULD', 'PEOPLE', 'MY', 'THAN', 'FIRST',
    'WATER', 'BEEN', 'CALL', 'WHO', 'ITS', 'NOW', 'FIND', 'DID', 'GET', 'MAY'
  ];
  
  const bigGaddag = await builder.buildFromWordList(words100);
  const stats = builder.getStats(bigGaddag);
  
  console.log(`   Nodes: ${stats.nodeCount} (target: <800)`);
  console.log(`   Memory: ${(stats.memoryUsage/1024).toFixed(1)}KB (target: <60KB)`);
  console.log(`   Cache hits: ${stats.cacheHits}`);
  console.log(`   Efficiency: ${stats.efficiency}`);
  console.log(`   Nodes per word: ${(stats.nodeCount/stats.wordCount).toFixed(1)}`);
  
  // Calculate score
  let score = 0;
  
  // Two-letter test (30 points)
  if (atTest.found === atTest.total) score += 30;
  else score += (atTest.found / atTest.total) * 30;
  
  // Wikipedia test (30 points)
  if (explainTest.found === explainTest.total) score += 30;
  else score += (explainTest.found / explainTest.total) * 30;
  
  // Memory efficiency (40 points)
  if (stats.nodeCount < 800) score += 20;
  else if (stats.nodeCount < 1500) score += 10;
  
  if (stats.memoryUsage < 60000) score += 20;
  else if (stats.memoryUsage < 100000) score += 10;
  
  console.log(`\n🎯 PRODUCTION SCORE: ${score.toFixed(1)}/100`);
  
  if (score >= 90) {
    console.log('✅ PRODUCTION READY!');
  } else if (score >= 70) {
    console.log('⚠️  Good but needs optimization');
  } else {
    console.log('❌ Still needs work');
  }
  
  return score;
}

// Run the test
testProduction().catch(console.error);
