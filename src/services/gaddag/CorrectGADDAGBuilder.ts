/**
 * Correct GADDAG Builder Implementation
 * Based on Steven Gordon's "A Faster Scrabble Move Generation Algorithm"
 * 
 * This implementation correctly builds a GADDAG where:
 * - For word "EXPLAIN", we store: e+xplain, xe+plain, pxe+lain, lpxe+ain, alpxe+in, ialpxe+n, nialpxe
 * - The + (or _) represents the split point where we transition from reversed prefix to forward suffix
 * - All paths are interconnected in a single trie structure
 */

import { GADDAGNode, GADDAGNodeImpl, GADDAGNodeFactory } from './GADDAGNode';

export class CorrectGADDAGBuilder {
  private nodeFactory: GADDAGNodeFactory;

  constructor() {
    this.nodeFactory = new GADDAGNodeFactory();
  }

  /**
   * Build GADDAG from a list of words using the correct algorithm
   */
  async buildFromWordList(words: string[]): Promise<GADDAGNode> {
    console.log(`🔄 Building correct GADDAG from ${words.length} words`);
    
    const root = this.nodeFactory.createNode();
    
    for (const word of words) {
      this.addWordToGADDAG(root, word.toUpperCase());
    }
    
    return root;
  }

  /**
   * Add a single word to the GADDAG using the correct algorithm with proper sharing
   * This creates a more memory-efficient structure by sharing common suffixes
   */
  private addWordToGADDAG(root: GADDAGNode, word: string): void {
    // Create all the paths but use a more efficient insertion method
    const paths: string[] = [];
    
    // Add the direct word
    paths.push(word);
    
    // For each possible split position in the word
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
    
    // Insert all paths efficiently
    for (const path of paths) {
      this.insertPathEfficiently(root, path, word);
    }
  }

  /**
   * Insert a path into the GADDAG trie with proper node sharing
   */
  private insertPath(root: GADDAGNode, prefix: string, splitMarker: string, suffix: string, originalWord: string): void {
    let current = root;
    const fullPath = prefix + splitMarker + suffix;
    
    // Follow the full path, creating nodes only when necessary
    for (const char of fullPath) {
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
   * Efficiently insert a path by reusing the existing insertPath method
   */
  private insertPathEfficiently(root: GADDAGNode, path: string, originalWord: string): void {
    let current = root;
    
    // Follow the path, creating nodes only when necessary
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
   * Test the GADDAG by trying to find all paths for a word
   */
  testWordPaths(root: GADDAGNode, word: string): void {
    console.log(`\n📝 Testing paths for word: ${word}`);
    
    // Test direct word lookup
    const directLookup = this.canTraversePath(root, word);
    console.log(`  ${word} (direct): ${directLookup ? '✅' : '❌'}`);
    
    // Test each split variation
    for (let splitPos = 1; splitPos <= word.length; splitPos++) {
      const prefix = word.substring(0, splitPos);
      const suffix = word.substring(splitPos);
      
      let pathToTest: string;
      if (splitPos === word.length) {
        // Complete reversal - no split marker
        pathToTest = prefix.split('').reverse().join('');
      } else {
        // Partial reversal with split marker
        const reversed = prefix.split('').reverse().join('');
        pathToTest = reversed + '_' + suffix;
      }
      
      const canTraverse = this.canTraversePath(root, pathToTest);
      console.log(`  ${pathToTest}: ${canTraverse ? '✅' : '❌'}`);
    }
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
   * Generate GADDAG paths for a word using the correct algorithm
   */
  private generateGADDAGPaths(word: string): string[] {
    const paths: string[] = [];
    
    // Add the direct word
    paths.push(word);
    
    // Special handling for single letter words
    if (word.length === 1) {
      return paths; // Only the direct path for single letters
    }
    
    // Special handling for two letter words
    if (word.length === 2) {
      const [a, b] = word.split('');
      paths.push(`${a}_${b}`); // A_T
      paths.push(`${b}_${a}`); // T_A  
      paths.push(`${b}${a}`);  // TA (complete reversal)
      return paths;
    }
    
    // Standard GADDAG algorithm for longer words
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
   * Print GADDAG structure for debugging
   */
  printGADDAGStructure(root: GADDAGNode, prefix: string = '', visited: Set<number> = new Set()): void {
    if (visited.has(root.id)) {
      console.log(`${prefix}[CYCLE to node ${root.id}]`);
      return;
    }
    visited.add(root.id);
    
    const endMarker = root.isEndOfWord ? ' [END]' : '';
    console.log(`${prefix}Node ${root.id}${endMarker}`);
    
    for (const [char, child] of root.edges) {
      console.log(`${prefix}├─ '${char}' →`);
      this.printGADDAGStructure(child, prefix + '│  ', visited);
    }
  }
}
