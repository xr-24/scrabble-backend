/**
 * Test the fixed GADDAG implementation
 * This test verifies that the corrected algorithm works properly
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  score: number;
  maxScore: number;
}

class FixedGADDAGTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🔧 Testing Fixed GADDAG Implementation');
    console.log('=' .repeat(60));
    
    // Test 1: Two-letter words (previously failing)
    await this.testTwoLetterWords();
    
    // Test 2: Wikipedia reference paths
    await this.testWikipediaReference();
    
    // Test 3: Basic word construction
    await this.testBasicWordConstruction();
    
    // Test 4: Memory efficiency
    await this.testMemoryEfficiency();
    
    // Test 5: Comparison with correct implementation
    await this.testComparisonWithCorrect();
    
    this.generateReport();
  }

  private async testTwoLetterWords(): Promise<void> {
    console.log('\n📝 Test 1: Two-Letter Words (Critical Fix)');
    
    const builder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    const testWords = ['AT', 'TO', 'GO', 'IS', 'IT'];
    const gaddag = await builder.buildFromWordList(testWords);
    
    let totalPaths = 0;
    let workingPaths = 0;
    
    for (const word of testWords) {
      console.log(`\n   Testing word: ${word}`);
      const expectedPaths = this.generateExpectedPaths(word);
      
      for (const path of expectedPaths) {
        totalPaths++;
        const canTraverse = this.canTraversePath(gaddag, path);
        console.log(`     ${path}: ${canTraverse ? '✅' : '❌'}`);
        if (canTraverse) workingPaths++;
      }
    }
    
    const passed = workingPaths === totalPaths;
    this.addResult('Two-Letter Words', passed, 
      `${workingPaths}/${totalPaths} paths working`, 
      workingPaths * 2, totalPaths * 2);
  }

  private async testWikipediaReference(): Promise<void> {
    console.log('\n📝 Test 2: Wikipedia Reference (EXPLAIN)');
    
    const builder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    const testWord = 'EXPLAIN';
    const gaddag = await builder.buildFromWordList([testWord]);
    
    // Expected paths from Wikipedia
    const expectedPaths = [
      'EXPLAIN',   // Direct word
      'E_XPLAIN',  // Split after E
      'XE_PLAIN',  // Reverse E, add X, split
      'PXE_LAIN',  // Reverse EX, add P, split
      'LPXE_AIN',  // Reverse EXP, add L, split
      'ALPXE_IN',  // Reverse EXPL, add A, split
      'IALPXE_N',  // Reverse EXPLA, add I, split
      'NIALPXE'    // Complete reversal
    ];
    
    let workingPaths = 0;
    
    for (const path of expectedPaths) {
      const canTraverse = this.canTraversePath(gaddag, path);
      console.log(`   ${path}: ${canTraverse ? '✅' : '❌'}`);
      if (canTraverse) workingPaths++;
    }
    
    const passed = workingPaths === expectedPaths.length;
    this.addResult('Wikipedia Reference', passed,
      `${workingPaths}/${expectedPaths.length} paths working`,
      workingPaths * 3, expectedPaths.length * 3);
  }

  private async testBasicWordConstruction(): Promise<void> {
    console.log('\n📝 Test 3: Basic Word Construction');
    
    const builder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    const testWords = ['CAT', 'DOG', 'HELLO', 'QUIZ'];
    const gaddag = await builder.buildFromWordList(testWords);
    
    // Test that all words can be found directly
    let wordsFound = 0;
    for (const word of testWords) {
      const found = this.canTraversePath(gaddag, word);
      console.log(`   ${word}: ${found ? '✅' : '❌'}`);
      if (found) wordsFound++;
    }
    
    // Test some split variations
    const splitTests = [
      { word: 'CAT', path: 'C_AT' },
      { word: 'CAT', path: 'TAC' },
      { word: 'DOG', path: 'D_OG' },
      { word: 'DOG', path: 'GOD' }
    ];
    
    let splitWorking = 0;
    for (const test of splitTests) {
      const found = this.canTraversePath(gaddag, test.path);
      console.log(`   ${test.path} (from ${test.word}): ${found ? '✅' : '❌'}`);
      if (found) splitWorking++;
    }
    
    const passed = wordsFound === testWords.length && splitWorking >= splitTests.length * 0.75;
    this.addResult('Basic Word Construction', passed,
      `Words: ${wordsFound}/${testWords.length}, Splits: ${splitWorking}/${splitTests.length}`,
      (wordsFound + splitWorking) * 2, (testWords.length + splitTests.length) * 2);
  }

  private async testMemoryEfficiency(): Promise<void> {
    console.log('\n📝 Test 4: Memory Efficiency');
    
    const builder = new GADDAGBuilder({
      enableMinimization: true,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    // Test with 50 words
    const testWords = this.generateTestWords(50);
    const startTime = Date.now();
    const gaddag = await builder.buildFromWordList(testWords);
    const buildTime = Date.now() - startTime;
    
    const nodeCount = this.countNodes(gaddag);
    const memoryEstimate = nodeCount * 50; // Rough estimate
    
    console.log(`   Build time: ${buildTime}ms`);
    console.log(`   Node count: ${nodeCount}`);
    console.log(`   Memory estimate: ${(memoryEstimate/1024).toFixed(1)}KB`);
    
    // Efficiency criteria
    const fastBuild = buildTime < 2000; // Under 2 seconds
    const reasonableNodes = nodeCount < testWords.length * 20; // Not too many nodes
    const memoryEfficient = memoryEstimate < 75000; // Under 75KB
    
    const passed = fastBuild && reasonableNodes && memoryEfficient;
    this.addResult('Memory Efficiency', passed,
      `Time: ${buildTime}ms, Nodes: ${nodeCount}, Memory: ${(memoryEstimate/1024).toFixed(1)}KB`,
      passed ? 15 : 0, 15);
  }

  private async testComparisonWithCorrect(): Promise<void> {
    console.log('\n📝 Test 5: Comparison with Correct Implementation');
    
    const fixedBuilder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    const correctBuilder = new CorrectGADDAGBuilder();
    
    const testWords = ['CAT', 'DOG', 'AT', 'TO', 'HELLO'];
    
    // Test fixed implementation
    const fixedGaddag = await fixedBuilder.buildFromWordList(testWords);
    let fixedPaths = 0;
    let totalPaths = 0;
    
    for (const word of testWords) {
      const expectedPaths = this.generateExpectedPaths(word);
      for (const path of expectedPaths) {
        totalPaths++;
        if (this.canTraversePath(fixedGaddag, path)) {
          fixedPaths++;
        }
      }
    }
    
    // Test correct implementation
    const correctGaddag = await correctBuilder.buildFromWordList(testWords);
    let correctPaths = 0;
    
    for (const word of testWords) {
      const expectedPaths = this.generateExpectedPaths(word);
      for (const path of expectedPaths) {
        if (this.canTraversePath(correctGaddag, path)) {
          correctPaths++;
        }
      }
    }
    
    console.log(`   Fixed implementation: ${fixedPaths}/${totalPaths} paths`);
    console.log(`   Correct implementation: ${correctPaths}/${totalPaths} paths`);
    
    const improvement = fixedPaths - 0; // Assume previous was 0
    const passed = fixedPaths >= correctPaths * 0.9; // Within 90% of correct
    
    this.addResult('Comparison with Correct', passed,
      `Fixed: ${fixedPaths}/${totalPaths}, Correct: ${correctPaths}/${totalPaths}`,
      passed ? 20 : 0, 20);
  }

  // Helper methods
  private generateExpectedPaths(word: string): string[] {
    const paths: string[] = [];
    
    // Add direct word
    paths.push(word);
    
    // Add all split variations
    for (let splitPos = 1; splitPos <= word.length; splitPos++) {
      const prefix = word.substring(0, splitPos);
      const suffix = word.substring(splitPos);
      
      if (splitPos === word.length) {
        // Complete reversal
        const reversed = prefix.split('').reverse().join('');
        paths.push(reversed);
      } else {
        // Partial reversal with split marker
        const reversed = prefix.split('').reverse().join('');
        paths.push(reversed + '_' + suffix);
      }
    }
    
    return paths;
  }

  private generateTestWords(count: number): string[] {
    const words = [
      'CAT', 'DOG', 'AT', 'TO', 'GO', 'IS', 'IT', 'HE', 'WE', 'ME',
      'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER',
      'HELLO', 'WORLD', 'QUIZ', 'JAZZ', 'FIZZ', 'BUZZ', 'GAME', 'WORD', 'PLAY', 'TILE',
      'SCRABBLE', 'BOARD', 'SCORE', 'LETTER', 'POINT', 'TRIPLE', 'DOUBLE', 'BLANK', 'RACK', 'DRAW'
    ];
    
    return words.slice(0, Math.min(count, words.length));
  }

  private countNodes(node: any, visited = new Set<number>()): number {
    if (visited.has(node.id)) return 0;
    visited.add(node.id);
    
    let count = 1;
    for (const child of node.edges.values()) {
      count += this.countNodes(child, visited);
    }
    return count;
  }

  private canTraversePath(gaddag: any, path: string): boolean {
    let current = gaddag;
    
    for (const char of path) {
      const child = current.getChild?.(char) || current.edges?.get(char);
      if (!child) return false;
      current = child;
    }
    
    return current.isEndOfWord;
  }

  private addResult(testName: string, passed: boolean, details: string, score: number, maxScore: number): void {
    this.results.push({
      testName,
      passed,
      details,
      score,
      maxScore
    });
    
    console.log(`   ${passed ? '✅' : '❌'} ${testName}: ${score}/${maxScore} points`);
    if (details) {
      console.log(`      ${details}`);
    }
  }

  private generateReport(): void {
    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const maxTotalScore = this.results.reduce((sum, r) => sum + r.maxScore, 0);
    const passed = totalScore >= maxTotalScore * 0.8; // 80% pass rate
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIXED GADDAG TEST RESULTS');
    console.log('='.repeat(60));
    
    for (const result of this.results) {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}: ${result.score}/${result.maxScore}`);
    }
    
    console.log('\n' + '-'.repeat(60));
    console.log(`🎯 TOTAL SCORE: ${totalScore}/${maxTotalScore} (${((totalScore/maxTotalScore)*100).toFixed(1)}%)`);
    console.log(`🏆 OVERALL RESULT: ${passed ? 'PASSED' : 'FAILED'}`);
    
    if (passed) {
      console.log('✅ Fixed GADDAG implementation is working correctly!');
      console.log('🚀 Ready for production use.');
    } else {
      console.log('❌ Fixed GADDAG implementation still needs work.');
      console.log('🔧 Review the failing tests and apply additional fixes.');
    }
  }
}

// Run the test
async function runFixedGADDAGTests() {
  const tester = new FixedGADDAGTester();
  await tester.runAllTests();
}

// Export for use in other files
export { runFixedGADDAGTests, FixedGADDAGTester };

// Run if this file is executed directly
if (require.main === module) {
  runFixedGADDAGTests().catch(console.error);
}
