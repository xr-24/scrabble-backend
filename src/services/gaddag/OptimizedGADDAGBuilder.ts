/**
 * Optimized GADDAG Builder Implementation
 * This implementation creates a proper shared trie structure for maximum efficiency
 * 
 * Key improvements:
 * 1. Proper node sharing between different split variations
 * 2. Memory-efficient construction
 * 3. Correct GADDAG algorithm implementation
 * 4. Handles edge cases properly
 */

import { GADDAGNode, GADDAGNodeImpl, GADDAGNodeFactory } from './GADDAGNode';

export class OptimizedGADDAGBuilder {
  private nodeFactory: GADDAGNodeFactory;

  constructor() {
    this.nodeFactory = new GADDAGNodeFactory();
  }

  /**
   * Build GADDAG from a list of words using optimized algorithm with proper sharing
   */
  async buildFromWordList(words: string[]): Promise<GADDAGNode> {
    console.log(`🔄 Building optimized GADDAG from ${words.length} words`);
    
    const root = this.nodeFactory.createNode();
    
    // Process each word and add all its variations efficiently
    for (const word of words) {
      this.addWordToGADDAGOptimized(root, word.toUpperCase());
    }
    
    return root;
  }

  /**
   * Add a word to GADDAG using optimized insertion with proper node sharing
   */
  private addWordToGADDAGOptimized(root: GADDAGNode, word: string): void {
    // Generate all GADDAG paths for this word
    const paths = this.generateGADDAGPaths(word);
    
    // Insert each path, reusing existing nodes where possible
    for (const path of paths) {
      this.insertPathWithSharing(root, path, word);
    }
  }

  /**
   * Generate all GADDAG paths for a word using the correct algorithm
   */
  private generateGADDAGPaths(word: string): string[] {
    const paths: string[] = [];
    
    // Add the direct word
    paths.push(word);
    
    // For each possible split position
    for (let splitPos = 1; splitPos <= word.length; splitPos++) {
      const prefix = word.substring(0, splitPos);
      const suffix = word.substring(splitPos);
      
      if (splitPos === word.length) {
        // Complete reversal - no split marker
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

  /**
   * Insert a path with maximum node sharing
   */
  private insertPathWithSharing(root: GADDAGNode, path: string, originalWord: string): void {
    let current = root;
    
    // Traverse the path, creating nodes only when necessary
    for (const char of path) {
      let child = current.getChild(char);
      if (!child) {
        child = this.nodeFactory.createNode();
        current.addEdge(char, child);
      }
      current = child;
    }
    
    // Mark end of word
    (current as GADDAGNodeImpl).markEndOfWord(originalWord);
  }

  /**
   * Test the GADDAG by checking all expected paths for a word
   */
  testWordPaths(root: GADDAGNode, word: string): { total: number; found: number; details: string[] } {
    const expectedPaths = this.generateGADDAGPaths(word);
    const details: string[] = [];
    let found = 0;
    
    for (const path of expectedPaths) {
      const canTraverse = this.canTraversePath(root, path);
      if (canTraverse) found++;
      details.push(`${path}: ${canTraverse ? '✅' : '❌'}`);
    }
    
    return { total: expectedPaths.length, found, details };
  }

  /**
   * Check if we can traverse a path in the GADDAG
   */
  private canTraversePath(root: GADDAGNode, path: string): boolean {
    let current = root;
    
    for (const char of path) {
      const child = current.getChild(char);
      if (!child) {
        return false;
      }
      current = child;
    }
    
    return current.isEndOfWord;
  }

  /**
   * Get detailed statistics about the GADDAG
   */
  getDetailedStats(root: GADDAGNode): {
    nodeCount: number;
    wordCount: number;
    memoryUsage: number;
    averageEdgesPerNode: number;
    maxDepth: number;
    efficiency: string;
  } {
    const nodeCount = this.countNodes(root);
    const wordCount = this.countWords(root);
    const memoryUsage = this.calculateMemoryUsage(root);
    
    // Calculate average edges per node
    let totalEdges = 0;
    const visited = new Set<number>();
    
    const countEdges = (node: GADDAGNode): void => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      totalEdges += node.edges.size;
      for (const child of node.edges.values()) {
        countEdges(child);
      }
    };
    
    countEdges(root);
    const averageEdgesPerNode = nodeCount > 0 ? totalEdges / nodeCount : 0;
    
    // Calculate max depth
    const maxDepth = this.calculateMaxDepth(root);
    
    // Calculate efficiency
    const nodesPerWord = wordCount > 0 ? nodeCount / wordCount : 0;
    const efficiency = nodesPerWord < 10 ? 'Excellent' : 
                      nodesPerWord < 20 ? 'Good' : 
                      nodesPerWord < 30 ? 'Fair' : 'Poor';
    
    return {
      nodeCount,
      wordCount,
      memoryUsage,
      averageEdgesPerNode,
      maxDepth,
      efficiency
    };
  }

  private countNodes(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) return 0;
    visited.add(root.id);
    
    let count = 1;
    for (const child of root.edges.values()) {
      count += this.countNodes(child, visited);
    }
    return count;
  }

  private countWords(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) return 0;
    visited.add(root.id);
    
    let count = root.isEndOfWord ? 1 : 0;
    for (const child of root.edges.values()) {
      count += this.countWords(child, visited);
    }
    return count;
  }

  private calculateMemoryUsage(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) return 0;
    visited.add(root.id);
    
    let size = (root as GADDAGNodeImpl).getMemoryUsage();
    for (const child of root.edges.values()) {
      size += this.calculateMemoryUsage(child, visited);
    }
    return size;
  }

  private calculateMaxDepth(root: GADDAGNode, depth: number = 0, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) return depth;
    visited.add(root.id);
    
    let maxDepth = depth;
    for (const child of root.edges.values()) {
      maxDepth = Math.max(maxDepth, this.calculateMaxDepth(child, depth + 1, visited));
    }
    return maxDepth;
  }

  /**
   * Print GADDAG structure for debugging
   */
  printStructure(root: GADDAGNode, maxDepth: number = 3): void {
    console.log('\n🌳 Optimized GADDAG Structure:');
    this.printNode(root, '', new Set(), 0, maxDepth);
  }

  private printNode(node: GADDAGNode, prefix: string, visited: Set<number>, depth: number, maxDepth: number): void {
    if (visited.has(node.id) || depth > maxDepth) {
      console.log(`${'  '.repeat(depth)}${prefix} -> [Node ${node.id}] ${visited.has(node.id) ? '(visited)' : '(max depth)'}`);
      return;
    }
    
    visited.add(node.id);
    
    const endMarker = node.isEndOfWord ? ' *END*' : '';
    console.log(`${'  '.repeat(depth)}${prefix} -> [Node ${node.id}]${endMarker}`);
    
    // Sort edges for consistent output
    const sortedEdges = Array.from(node.edges.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    for (const [letter, child] of sortedEdges) {
      this.printNode(child, letter, visited, depth + 1, maxDepth);
    }
  }
}
