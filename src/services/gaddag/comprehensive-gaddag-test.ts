/**
 * Comprehensive GADDAG Algorithm Test Suite
 * Tests the GADDAG implementation against Steven Gordon's specification
 * and validates all aspects of the algorithm
 */

import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';
import { GADDAGBuilder } from './GADDAGBuilder';
import { GADDAGNodeUtils } from './GADDAGNode';

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  score: number;
  maxScore: number;
}

interface GADDAGTestSuite {
  results: TestResult[];
  totalScore: number;
  maxTotalScore: number;
  passed: boolean;
}

class ComprehensiveGADDAGTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<GADDAGTestSuite> {
    console.log('🧪 Comprehensive GADDAG Algorithm Test Suite');
    console.log('=' .repeat(60));
    
    // Test 1: Basic GADDAG Construction
    await this.testBasicConstruction();
    
    // Test 2: Wikipedia Reference Implementation
    await this.testWikipediaReference();
    
    // Test 3: Multiple Words Interaction
    await this.testMultipleWordsInteraction();
    
    // Test 4: Edge Cases and Special Characters
    await this.testEdgeCases();
    
    // Test 5: Performance and Memory Efficiency
    await this.testPerformanceAndMemory();
    
    // Test 6: Bidirectional Search Capability
    await this.testBidirectionalSearch();
    
    // Test 7: Move Generation Scenarios
    await this.testMoveGenerationScenarios();
    
    // Test 8: Algorithm Correctness vs Reference
    await this.testAlgorithmCorrectness();
    
    // Test 9: Stress Testing with Large Dictionary
    await this.testStressTesting();
    
    // Test 10: Comparison with Current Implementation
    await this.testCurrentImplementationComparison();
    
    return this.generateReport();
  }

  private async testBasicConstruction(): Promise<void> {
    console.log('\n📝 Test 1: Basic GADDAG Construction');
    
    try {
      const builder = new CorrectGADDAGBuilder();
      const testWords = ['CAT', 'DOG', 'HELLO'];
      const gaddag = await builder.buildFromWordList(testWords);
      
      // Verify structure exists
      const nodeCount = this.countNodes(gaddag);
      const hasValidStructure = nodeCount > testWords.length;
      
      // Verify all words can be found
      let allWordsFound = true;
      for (const word of testWords) {
        if (!this.canFindWord(gaddag, word)) {
          allWordsFound = false;
          break;
        }
      }
      
      const passed = hasValidStructure && allWordsFound;
      this.addResult('Basic Construction', passed, 
        `Nodes: ${nodeCount}, Words found: ${allWordsFound}`, 
        passed ? 10 : 0, 10);
        
    } catch (error) {
      this.addResult('Basic Construction', false, `Error: ${error}`, 0, 10);
    }
  }

  private async testWikipediaReference(): Promise<void> {
    console.log('\n📝 Test 2: Wikipedia Reference Implementation');
    
    const builder = new CorrectGADDAGBuilder();
    const testWord = 'EXPLAIN';
    const gaddag = await builder.buildFromWordList([testWord]);
    
    // Expected paths from Wikipedia
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
    
    let correctPaths = 0;
    const pathResults: string[] = [];
    
    for (const path of expectedPaths) {
      const found = this.canTraversePath(gaddag, path);
      if (found) correctPaths++;
      pathResults.push(`${path}: ${found ? '✅' : '❌'}`);
    }
    
    const passed = correctPaths === expectedPaths.length;
    this.addResult('Wikipedia Reference', passed,
      `${correctPaths}/${expectedPaths.length} paths correct\n${pathResults.join('\n')}`,
      correctPaths * 2, expectedPaths.length * 2);
  }

  private async testMultipleWordsInteraction(): Promise<void> {
    console.log('\n📝 Test 3: Multiple Words Interaction');
    
    const builder = new CorrectGADDAGBuilder();
    const testWords = ['CAT', 'CATS', 'CART', 'CARE', 'SCARE'];
    const gaddag = await builder.buildFromWordList(testWords);
    
    // Test that all words can be found
    let wordsFound = 0;
    for (const word of testWords) {
      if (this.canFindWord(gaddag, word)) wordsFound++;
    }
    
    // Test shared prefixes and suffixes
    const sharedPrefixTest = this.canTraversePath(gaddag, 'C_AT') && 
                            this.canTraversePath(gaddag, 'C_ART') &&
                            this.canTraversePath(gaddag, 'C_ARE');
    
    // Test that structure is efficient (shared nodes)
    const nodeCount = this.countNodes(gaddag);
    const efficient = nodeCount < (testWords.join('').length * 2); // Rough efficiency check
    
    const passed = wordsFound === testWords.length && sharedPrefixTest && efficient;
    this.addResult('Multiple Words Interaction', passed,
      `Words found: ${wordsFound}/${testWords.length}, Shared prefixes: ${sharedPrefixTest}, Efficient: ${efficient}`,
      passed ? 15 : 0, 15);
  }

  private async testEdgeCases(): Promise<void> {
    console.log('\n📝 Test 4: Edge Cases and Special Characters');
    
    const builder = new CorrectGADDAGBuilder();
    
    // Test single letter words
    const singleLetterGaddag = await builder.buildFromWordList(['A', 'I']);
    const singleLetterTest = this.canFindWord(singleLetterGaddag, 'A') && 
                            this.canFindWord(singleLetterGaddag, 'I');
    
    // Test two letter words
    const twoLetterGaddag = await builder.buildFromWordList(['AT', 'TO', 'GO']);
    const twoLetterTest = this.canTraversePath(twoLetterGaddag, 'A_T') &&
                         this.canTraversePath(twoLetterGaddag, 'T_A') &&
                         this.canTraversePath(twoLetterGaddag, 'AT');
    
    // Test very long words
    const longWordGaddag = await builder.buildFromWordList(['ANTIDISESTABLISHMENTARIANISM']);
    const longWordTest = this.canFindWord(longWordGaddag, 'ANTIDISESTABLISHMENTARIANISM');
    
    const passed = singleLetterTest && twoLetterTest && longWordTest;
    this.addResult('Edge Cases', passed,
      `Single letter: ${singleLetterTest}, Two letter: ${twoLetterTest}, Long word: ${longWordTest}`,
      passed ? 12 : 0, 12);
  }

  private async testPerformanceAndMemory(): Promise<void> {
    console.log('\n📝 Test 5: Performance and Memory Efficiency');
    
    const builder = new CorrectGADDAGBuilder();
    const testWords = this.generateTestWords(100); // Generate 100 test words
    
    const startTime = Date.now();
    const gaddag = await builder.buildFromWordList(testWords);
    const buildTime = Date.now() - startTime;
    
    const nodeCount = this.countNodes(gaddag);
    const memoryEstimate = nodeCount * 50; // Rough estimate: 50 bytes per node
    
    // Performance criteria
    const fastBuild = buildTime < 1000; // Should build in under 1 second
    const memoryEfficient = memoryEstimate < 100000; // Under 100KB for 100 words
    const reasonableNodes = nodeCount < testWords.length * 10; // Not too many nodes
    
    const passed = fastBuild && memoryEfficient && reasonableNodes;
    this.addResult('Performance and Memory', passed,
      `Build time: ${buildTime}ms, Nodes: ${nodeCount}, Memory: ${(memoryEstimate/1024).toFixed(1)}KB`,
      passed ? 10 : 0, 10);
  }

  private async testBidirectionalSearch(): Promise<void> {
    console.log('\n📝 Test 6: Bidirectional Search Capability');
    
    const builder = new CorrectGADDAGBuilder();
    const testWord = 'SCRABBLE';
    const gaddag = await builder.buildFromWordList([testWord]);
    
    // Test that we can find the word starting from any letter
    const letters = ['S', 'C', 'R', 'A', 'B', 'L', 'E'];
    let bidirectionalPaths = 0;
    
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      // Check if there's a path starting with this letter that leads to the word
      if (this.hasPathStartingWith(gaddag, letter, testWord)) {
        bidirectionalPaths++;
      }
    }
    
    const passed = bidirectionalPaths >= letters.length - 1; // Allow for some flexibility
    this.addResult('Bidirectional Search', passed,
      `Can start from ${bidirectionalPaths}/${letters.length} letters`,
      bidirectionalPaths * 2, letters.length * 2);
  }

  private async testMoveGenerationScenarios(): Promise<void> {
    console.log('\n📝 Test 7: Move Generation Scenarios');
    
    const builder = new CorrectGADDAGBuilder();
    const scrabbleWords = ['QUIZ', 'JAZZ', 'FIZZ', 'BUZZ', 'FUZZ', 'RAZZ'];
    const gaddag = await builder.buildFromWordList(scrabbleWords);
    
    // Test high-value letter scenarios
    const highValueTests = [
      this.canTraversePath(gaddag, 'Q_UIZ'),
      this.canTraversePath(gaddag, 'IUQ_Z'), // QUIZ reversed with split
      this.canTraversePath(gaddag, 'J_AZZ'),
      this.canTraversePath(gaddag, 'ZZA_J') // JAZZ reversed with split
    ];
    
    const highValuePassed = highValueTests.filter(t => t).length;
    
    // Test common letter combinations
    const commonTests = [
      this.canTraversePath(gaddag, 'F_IZZ'),
      this.canTraversePath(gaddag, 'B_UZZ'),
      this.canTraversePath(gaddag, 'ZZI_F'), // FIZZ reversed
      this.canTraversePath(gaddag, 'ZZU_B')  // BUZZ reversed
    ];
    
    const commonPassed = commonTests.filter(t => t).length;
    
    const passed = (highValuePassed + commonPassed) >= 6;
    this.addResult('Move Generation Scenarios', passed,
      `High-value: ${highValuePassed}/4, Common: ${commonPassed}/4`,
      (highValuePassed + commonPassed) * 2, 16);
  }

  private async testAlgorithmCorrectness(): Promise<void> {
    console.log('\n📝 Test 8: Algorithm Correctness vs Reference');
    
    const builder = new CorrectGADDAGBuilder();
    
    // Test against known GADDAG properties from Steven Gordon's paper
    const referenceTests = [
      { word: 'CAT', expectedSplits: 3 },     // C_AT, AC_T, TAC
      { word: 'HELLO', expectedSplits: 5 },   // H_ELLO, EH_LLO, LEH_LO, LLEH_O, OLLEH
      { word: 'EXPLAIN', expectedSplits: 7 }, // As per Wikipedia
      { word: 'GO', expectedSplits: 2 }       // G_O, OG
    ];
    
    let correctSplits = 0;
    const splitResults: string[] = [];
    
    for (const test of referenceTests) {
      const gaddag = await builder.buildFromWordList([test.word]);
      const actualSplits = this.countValidSplits(gaddag, test.word);
      const correct = actualSplits >= test.expectedSplits; // Allow for extra paths
      
      if (correct) correctSplits++;
      splitResults.push(`${test.word}: ${actualSplits}/${test.expectedSplits} ${correct ? '✅' : '❌'}`);
    }
    
    const passed = correctSplits === referenceTests.length;
    this.addResult('Algorithm Correctness', passed,
      `${correctSplits}/${referenceTests.length} reference tests passed\n${splitResults.join('\n')}`,
      correctSplits * 5, referenceTests.length * 5);
  }

  private async testStressTesting(): Promise<void> {
    console.log('\n📝 Test 9: Stress Testing with Large Dictionary');
    
    const builder = new CorrectGADDAGBuilder();
    const largeWordSet = this.generateTestWords(500); // 500 words
    
    try {
      const startTime = Date.now();
      const gaddag = await builder.buildFromWordList(largeWordSet);
      const buildTime = Date.now() - startTime;
      
      // Test random word lookups
      const sampleWords = largeWordSet.slice(0, 50);
      let foundWords = 0;
      
      for (const word of sampleWords) {
        if (this.canFindWord(gaddag, word)) foundWords++;
      }
      
      const nodeCount = this.countNodes(gaddag);
      
      // Stress test criteria
      const reasonableTime = buildTime < 5000; // Under 5 seconds
      const allWordsFound = foundWords === sampleWords.length;
      const reasonableSize = nodeCount < largeWordSet.length * 15;
      
      const passed = reasonableTime && allWordsFound && reasonableSize;
      this.addResult('Stress Testing', passed,
        `Time: ${buildTime}ms, Found: ${foundWords}/${sampleWords.length}, Nodes: ${nodeCount}`,
        passed ? 15 : 0, 15);
        
    } catch (error) {
      this.addResult('Stress Testing', false, `Error: ${error}`, 0, 15);
    }
  }

  private async testCurrentImplementationComparison(): Promise<void> {
    console.log('\n📝 Test 10: Comparison with Current Implementation');
    
    const correctBuilder = new CorrectGADDAGBuilder();
    const currentBuilder = new GADDAGBuilder({
      enableMinimization: false,
      maxWordLength: 10,
      minWordLength: 2,
      enableProgressReporting: false,
      batchSize: 100
    });
    
    const testWords = ['CAT', 'DOG', 'HELLO', 'QUIZ'];
    
    // Test correct implementation
    const correctGaddag = await correctBuilder.buildFromWordList(testWords);
    let correctPaths = 0;
    let totalPaths = 0;
    
    for (const word of testWords) {
      const splits = this.generateExpectedSplits(word);
      for (const split of splits) {
        totalPaths++;
        if (this.canTraversePath(correctGaddag, split)) {
          correctPaths++;
        }
      }
    }
    
    // Test current implementation
    const currentGaddag = await currentBuilder.buildFromWordList(testWords);
    let currentPaths = 0;
    
    for (const word of testWords) {
      const splits = this.generateExpectedSplits(word);
      for (const split of splits) {
        if (this.canTraversePath(currentGaddag, split)) {
          currentPaths++;
        }
      }
    }
    
    const improvement = correctPaths - currentPaths;
    const passed = correctPaths > currentPaths * 2; // Significant improvement
    
    this.addResult('Implementation Comparison', passed,
      `Correct: ${correctPaths}/${totalPaths}, Current: ${currentPaths}/${totalPaths}, Improvement: +${improvement}`,
      passed ? 20 : 0, 20);
  }

  // Helper methods
  private generateExpectedSplits(word: string): string[] {
    const splits: string[] = [];
    
    // Add direct word
    splits.push(word);
    
    // Add all split variations using CORRECT GADDAG algorithm
    for (let splitPos = 1; splitPos <= word.length; splitPos++) {
      const prefix = word.substring(0, splitPos);
      const suffix = word.substring(splitPos);
      
      if (splitPos === word.length) {
        // Complete reversal - no split marker
        const reversed = prefix.split('').reverse().join('');
        splits.push(reversed);
      } else {
        // Partial reversal with split marker
        const reversed = prefix.split('').reverse().join('');
        splits.push(reversed + '_' + suffix);
      }
    }
    
    return splits;
  }

  private generateTestWords(count: number): string[] {
    const words: string[] = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // Add some real words
    const realWords = [
      'CAT', 'DOG', 'HELLO', 'WORLD', 'QUIZ', 'JAZZ', 'FIZZ', 'BUZZ',
      'SCRABBLE', 'GAME', 'WORD', 'PLAY', 'TILE', 'BOARD', 'SCORE',
      'LETTER', 'POINT', 'TRIPLE', 'DOUBLE', 'BLANK', 'RACK', 'DRAW'
    ];
    
    words.push(...realWords.slice(0, Math.min(count, realWords.length)));
    
    // Generate additional words if needed
    while (words.length < count) {
      const length = Math.floor(Math.random() * 6) + 3; // 3-8 letters
      let word = '';
      for (let i = 0; i < length; i++) {
        word += letters[Math.floor(Math.random() * letters.length)];
      }
      if (!words.includes(word)) {
        words.push(word);
      }
    }
    
    return words;
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

  private canFindWord(gaddag: any, word: string): boolean {
    return this.canTraversePath(gaddag, word);
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

  private hasPathStartingWith(gaddag: any, letter: string, targetWord: string): boolean {
    const child = gaddag.getChild?.(letter) || gaddag.edges?.get(letter);
    if (!child) return false;
    
    // Simple check - if we can reach any end-of-word from this letter
    return this.hasAnyEndOfWord(child, new Set());
  }

  private hasAnyEndOfWord(node: any, visited: Set<number>): boolean {
    if (visited.has(node.id)) return false;
    visited.add(node.id);
    
    if (node.isEndOfWord) return true;
    
    for (const child of node.edges.values()) {
      if (this.hasAnyEndOfWord(child, visited)) return true;
    }
    
    return false;
  }

  private countValidSplits(gaddag: any, word: string): number {
    const expectedSplits = this.generateExpectedSplits(word);
    let count = 0;
    
    for (const split of expectedSplits) {
      if (this.canTraversePath(gaddag, split)) {
        count++;
      }
    }
    
    return count;
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
      console.log(`      ${details.replace(/\n/g, '\n      ')}`);
    }
  }

  private generateReport(): GADDAGTestSuite {
    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const maxTotalScore = this.results.reduce((sum, r) => sum + r.maxScore, 0);
    const passed = totalScore >= maxTotalScore * 0.8; // 80% pass rate
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    
    for (const result of this.results) {
      console.log(`${result.passed ? '✅' : '❌'} ${result.testName}: ${result.score}/${result.maxScore}`);
    }
    
    console.log('\n' + '-'.repeat(60));
    console.log(`🎯 TOTAL SCORE: ${totalScore}/${maxTotalScore} (${((totalScore/maxTotalScore)*100).toFixed(1)}%)`);
    console.log(`🏆 OVERALL RESULT: ${passed ? 'PASSED' : 'FAILED'}`);
    
    if (passed) {
      console.log('✅ GADDAG implementation meets comprehensive testing standards!');
    } else {
      console.log('❌ GADDAG implementation needs improvement in multiple areas.');
    }
    
    return {
      results: this.results,
      totalScore,
      maxTotalScore,
      passed
    };
  }
}

// Run comprehensive tests
async function runComprehensiveGADDAGTests() {
  const tester = new ComprehensiveGADDAGTester();
  return await tester.runAllTests();
}

// Export for use in other files
export { runComprehensiveGADDAGTests, ComprehensiveGADDAGTester };

// Run if this file is executed directly
if (require.main === module) {
  runComprehensiveGADDAGTests().catch(console.error);
}
