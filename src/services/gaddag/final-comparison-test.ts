/**
 * Final Comparison Test for GADDAG Implementations
 * Tests all three implementations to identify the best approach
 */

import { GADDAGBuilder } from './GADDAGBuilder';
import { CorrectGADDAGBuilder } from './CorrectGADDAGBuilder';
import { OptimizedGADDAGBuilder } from './OptimizedGADDAGBuilder';

interface TestResult {
  implementation: string;
  nodeCount: number;
  memoryUsage: number;
  buildTime: number;
  wikipediaPaths: number;
  twoLetterPaths: number;
  efficiency: string;
  score: number;
}

class FinalGADDAGComparison {
  
  async runComparison(): Promise<void> {
    console.log('🔬 Final GADDAG Implementation Comparison');
    console.log('=' .repeat(60));
    
    const testWords = ['CAT', 'DOG', 'HELLO', 'EXPLAIN', 'AT', 'GO'];
    const results: TestResult[] = [];
    
    // Test Current Implementation
    console.log('\n📝 Testing Current GADDAGBuilder...');
    const currentResult = await this.testImplementation('Current', async () => {
      const builder = new GADDAGBuilder({
        enableMinimization: false,
        maxWordLength: 10,
        minWordLength: 2,
        enableProgressReporting: false,
        batchSize: 100
      });
      return await builder.buildFromWordList(testWords);
    }, testWords);
    results.push(currentResult);
    
    // Test Correct Implementation
    console.log('\n📝 Testing CorrectGADDAGBuilder...');
    const correctResult = await this.testImplementation('Correct', async () => {
      const builder = new CorrectGADDAGBuilder();
      return await builder.buildFromWordList(testWords);
    }, testWords);
    results.push(correctResult);
    
    // Test Optimized Implementation
    console.log('\n📝 Testing OptimizedGADDAGBuilder...');
    const optimizedResult = await this.testImplementation('Optimized', async () => {
      const builder = new OptimizedGADDAGBuilder();
      return await builder.buildFromWordList(testWords);
    }, testWords);
    results.push(optimizedResult);
    
    // Print comparison
    this.printComparison(results);
    
    // Test specific edge cases
    await this.testEdgeCases();
  }
  
  private async testImplementation(
    name: string, 
    builderFactory: () => Promise<any>, 
    testWords: string[]
  ): Promise<TestResult> {
    const startTime = Date.now();
    const gaddag = await builderFactory();
    const buildTime = Date.now() - startTime;
    
    const nodeCount = this.countNodes(gaddag);
    const memoryUsage = this.calculateMemoryUsage(gaddag);
    
    // Test Wikipedia paths for EXPLAIN
    const wikipediaPaths = this.testWikipediaPaths(gaddag);
    
    // Test two-letter word paths
    const twoLetterPaths = this.testTwoLetterPaths(gaddag);
    
    // Calculate efficiency
    const nodesPerWord = nodeCount / testWords.length;
    const efficiency = nodesPerWord < 10 ? 'Excellent' : 
                      nodesPerWord < 20 ? 'Good' : 
                      nodesPerWord < 30 ? 'Fair' : 'Poor';
    
    // Calculate overall score
    let score = 0;
    score += Math.max(0, 50 - nodeCount); // Lower node count is better
    score += wikipediaPaths * 5; // 5 points per Wikipedia path
    score += twoLetterPaths * 10; // 10 points per two-letter path
    score += buildTime < 100 ? 20 : 0; // Speed bonus
    
    console.log(`   Nodes: ${nodeCount}, Memory: ${(memoryUsage/1024).toFixed(1)}KB`);
    console.log(`   Wikipedia paths: ${wikipediaPaths}/8, Two-letter paths: ${twoLetterPaths}/6`);
    console.log(`   Build time: ${buildTime}ms, Efficiency: ${efficiency}`);
    console.log(`   Score: ${score}`);
    
    return {
      implementation: name,
      nodeCount,
      memoryUsage,
      buildTime,
      wikipediaPaths,
      twoLetterPaths,
      efficiency,
      score
    };
  }
  
  private testWikipediaPaths(gaddag: any): number {
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
    
    let found = 0;
    for (const path of expectedPaths) {
      if (this.canTraversePath(gaddag, path)) {
        found++;
      }
    }
    
    return found;
  }
  
  private testTwoLetterPaths(gaddag: any): number {
    const expectedPaths = [
      'A_T', 'T_A', 'AT',  // For word "AT"
      'G_O', 'O_G', 'GO'   // For word "GO"
    ];
    
    let found = 0;
    for (const path of expectedPaths) {
      if (this.canTraversePath(gaddag, path)) {
        found++;
      }
    }
    
    return found;
  }
  
  private canTraversePath(gaddag: any, path: string): boolean {
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
  
  private countNodes(gaddag: any, visited: Set<number> = new Set()): number {
    if (visited.has(gaddag.id)) return 0;
    visited.add(gaddag.id);
    
    let count = 1;
    for (const child of gaddag.edges.values()) {
      count += this.countNodes(child, visited);
    }
    return count;
  }
  
  private calculateMemoryUsage(gaddag: any, visited: Set<number> = new Set()): number {
    if (visited.has(gaddag.id)) return 0;
    visited.add(gaddag.id);
    
    let size = 64; // Base node size
    size += gaddag.edges.size * 32; // Edge storage
    
    for (const child of gaddag.edges.values()) {
      size += this.calculateMemoryUsage(child, visited);
    }
    return size;
  }
  
  private printComparison(results: TestResult[]): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL COMPARISON RESULTS');
    console.log('='.repeat(60));
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    console.log('Implementation    | Nodes | Memory | Wiki | 2-Letter | Score');
    console.log('-'.repeat(60));
    
    for (const result of results) {
      const line = `${result.implementation.padEnd(15)} | ${result.nodeCount.toString().padStart(5)} | ${(result.memoryUsage/1024).toFixed(0).padStart(4)}KB | ${result.wikipediaPaths.toString().padStart(4)} | ${result.twoLetterPaths.toString().padStart(8)} | ${result.score.toString().padStart(5)}`;
      console.log(line);
    }
    
    console.log('\n🏆 Winner: ' + results[0].implementation);
    
    if (results[0].score < 100) {
      console.log('⚠️  All implementations need improvement!');
      this.printRecommendations();
    }
  }
  
  private printRecommendations(): void {
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('1. Implement proper incremental construction with minimization');
    console.log('2. Use suffix links for better node sharing');
    console.log('3. Implement proper GADDAG minimization algorithm');
    console.log('4. Fix two-letter word handling');
    console.log('5. Optimize memory usage with better data structures');
  }
  
  private async testEdgeCases(): Promise<void> {
    console.log('\n🧪 Testing Edge Cases...');
    
    // Test single letter
    console.log('\n📝 Single Letter Test:');
    const singleBuilder = new OptimizedGADDAGBuilder();
    const singleGaddag = await singleBuilder.buildFromWordList(['A']);
    const singleStats = singleBuilder.getDetailedStats(singleGaddag);
    console.log(`   A: Nodes=${singleStats.nodeCount}, Memory=${(singleStats.memoryUsage/1024).toFixed(1)}KB`);
    
    // Test two letters
    console.log('\n📝 Two Letter Test:');
    const twoBuilder = new OptimizedGADDAGBuilder();
    const twoGaddag = await twoBuilder.buildFromWordList(['AT']);
    const twoTest = twoBuilder.testWordPaths(twoGaddag, 'AT');
    console.log(`   AT: Found ${twoTest.found}/${twoTest.total} paths`);
    twoTest.details.forEach(detail => console.log(`     ${detail}`));
    
    // Test complex word
    console.log('\n📝 Complex Word Test:');
    const complexBuilder = new OptimizedGADDAGBuilder();
    const complexGaddag = await complexBuilder.buildFromWordList(['EXPLAIN']);
    const complexTest = complexBuilder.testWordPaths(complexGaddag, 'EXPLAIN');
    console.log(`   EXPLAIN: Found ${complexTest.found}/${complexTest.total} paths`);
    complexTest.details.forEach(detail => console.log(`     ${detail}`));
  }
}

// Run the comparison
async function runFinalComparison() {
  const comparison = new FinalGADDAGComparison();
  await comparison.runComparison();
}

// Export for use in other files
export { runFinalComparison, FinalGADDAGComparison };

// Run if this file is executed directly
if (require.main === module) {
  runFinalComparison().catch(console.error);
}
