/**
 * GADDAG Builder Implementation
 * Based on Steven Gordon's "A Faster Scrabble Move Generation Algorithm"
 * 
 * This class constructs a GADDAG (Generalized Acyclic Directed Graph) from a dictionary.
 * The GADDAG enables efficient Scrabble move generation by pre-processing words with
 * all possible split points for bidirectional search.
 */

import { GADDAGNode, GADDAGNodeImpl, GADDAGNodeFactory, GADDAGNodeUtils } from './GADDAGNode';
import { dictionaryService } from '../dictionaryService';

/**
 * Configuration options for GADDAG construction
 */
export interface GADDAGBuildOptions {
  /** Enable trie minimization to reduce memory usage */
  enableMinimization: boolean;
  
  /** Maximum word length to include (default: 15 for Scrabble) */
  maxWordLength: number;
  
  /** Minimum word length to include (default: 2) */
  minWordLength: number;
  
  /** Enable progress reporting during construction */
  enableProgressReporting: boolean;
  
  /** Batch size for processing words (affects memory usage) */
  batchSize: number;
}

/**
 * Statistics about GADDAG construction
 */
export interface GADDAGBuildStats {
  /** Total number of dictionary words processed */
  wordsProcessed: number;
  
  /** Total number of split variations generated */
  splitVariationsGenerated: number;
  
  /** Number of nodes in the final GADDAG */
  nodeCount: number;
  
  /** Number of nodes before minimization */
  nodesBeforeMinimization: number;
  
  /** Memory usage in bytes */
  memoryUsage: number;
  
  /** Construction time in milliseconds */
  constructionTime: number;
  
  /** Minimization time in milliseconds */
  minimizationTime: number;
}

/**
 * Represents an unchecked node during incremental construction
 */
interface UncheckedNode {
  parent: GADDAGNode;
  letter: string;
  child: GADDAGNode;
}

/**
 * GADDAG Builder class
 */
export class GADDAGBuilder {
  private nodeFactory: GADDAGNodeFactory;
  private options: GADDAGBuildOptions;
  
  // Incremental construction state
  private uncheckedNodes: UncheckedNode[] = [];
  private minimizedNodes: Map<string, GADDAGNode> = new Map();
  private previousWord: string = '';
  
  // Statistics
  private stats: Partial<GADDAGBuildStats> = {};

  constructor(options: Partial<GADDAGBuildOptions> = {}) {
    this.nodeFactory = new GADDAGNodeFactory();
    this.options = {
      enableMinimization: true,
      maxWordLength: 15,
      minWordLength: 2,
      enableProgressReporting: true,
      batchSize: 1000,
      ...options
    };
  }

  /**
   * Build GADDAG from the loaded dictionary
   */
  async buildFromDictionary(): Promise<GADDAGNode> {
    const startTime = Date.now();
    console.log('🔧 Starting GADDAG construction...');
    
    // Ensure dictionary is loaded
    await dictionaryService.loadDictionary();
    
    // Get dictionary words using a more comprehensive approach
    const words = await this.extractAllDictionaryWords();
    console.log(`📚 Processing ${words.length} dictionary words`);
    
    // Build GADDAG
    const root = await this.buildFromWordList(words);
    
    // Calculate final statistics
    this.stats.constructionTime = Date.now() - startTime;
    this.stats.nodeCount = GADDAGNodeUtils.countNodes(root);
    this.stats.memoryUsage = GADDAGNodeUtils.calculateMemoryUsage(root);
    
    console.log('✅ GADDAG construction complete!');
    this.logStatistics();
    
    return root;
  }

  /**
   * Build GADDAG from a list of words with production-level optimization
   */
  async buildFromWordList(words: string[]): Promise<GADDAGNode> {
    const startTime = Date.now();
    
    // Reset state
    this.reset();
    
    // Filter and sort words
    const filteredWords = this.filterWords(words);
    const sortedWords = filteredWords.sort();
    
    console.log(`🔄 Building GADDAG from ${sortedWords.length} words`);
    
    this.stats.wordsProcessed = sortedWords.length;
    
    // Build GADDAG with proper node sharing
    const root = this.nodeFactory.createNode();
    const nodeCache = new Map<string, GADDAGNode>();
    
    // Process each word with all its GADDAG variations
    for (let i = 0; i < sortedWords.length; i++) {
      const word = sortedWords[i];
      this.insertWordWithSharing(root, word, nodeCache);
      
      // Progress reporting
      if (this.options.enableProgressReporting && i % this.options.batchSize === 0) {
        const progress = ((i / sortedWords.length) * 100).toFixed(1);
        console.log(`📈 Progress: ${progress}% (${i}/${sortedWords.length})`);
      }
    }
    
    console.log(`🔀 Node cache hits: ${nodeCache.size}`);
    
    // Final minimization
    if (this.options.enableMinimization) {
      const minStartTime = Date.now();
      this.stats.nodesBeforeMinimization = GADDAGNodeUtils.countNodes(root);
      
      console.log('🗜️ Performing final minimization...');
      this.performMinimization(root);
      
      this.stats.minimizationTime = Date.now() - minStartTime;
      console.log(`✅ Minimization complete in ${this.stats.minimizationTime}ms`);
    }
    
    return root;
  }

  /**
   * Extract all words from dictionary using a comprehensive approach
   */
  private async extractAllDictionaryWords(): Promise<string[]> {
    const words: Set<string> = new Set();
    
    // Load the SOWPODS dictionary file directly
    try {
      const response = await fetch('/sowpods.txt');
      if (response.ok) {
        const text = await response.text();
        const fileWords = text.split('\n')
          .map(word => word.trim().toUpperCase())
          .filter(word => word.length >= this.options.minWordLength && 
                         word.length <= this.options.maxWordLength);
        
        console.log(`📖 Loaded ${fileWords.length} words from SOWPODS file`);
        fileWords.forEach(word => words.add(word));
        return Array.from(words);
      }
    } catch (error) {
      console.log('⚠️ Could not load SOWPODS file directly, using dictionary service');
    }
    
    // Fallback: Generate words systematically
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    // Test all 2-letter combinations
    for (const a of letters) {
      for (const b of letters) {
        const word = a + b;
        if (await dictionaryService.isValidWord(word)) {
          words.add(word);
        }
      }
    }
    
    // Test all 3-letter combinations with common patterns
    const commonLetters = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
    for (let i = 0; i < commonLetters.length && words.size < 10000; i++) {
      for (let j = 0; j < commonLetters.length; j++) {
        for (let k = 0; k < commonLetters.length; k++) {
          const word = commonLetters[i] + commonLetters[j] + commonLetters[k];
          if (await dictionaryService.isValidWord(word)) {
            words.add(word);
          }
        }
      }
    }
    
    // Add comprehensive word lists
    const wordLists = [
      // 2-letter words
      ['AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
       'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EX',
       'FA', 'FE', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA', 'KI',
       'LA', 'LI', 'LO', 'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY',
       'PA', 'PE', 'PI', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TI', 'TO', 'UG', 'UH', 'UM', 'UN', 'UP', 'US', 'UT',
       'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA', 'ZO'],
      
      // Common 3-letter words
      ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID',
       'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO',
       'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BAT', 'BIT', 'BUG', 'BUS', 'BUY', 'CUT', 'EAR', 'EAT', 'END', 'FAR', 'FEW', 'FIT', 'FIX', 'FLY', 'GOT', 'GUN', 'HIT', 'ICE', 'ILL', 'JOY', 'KEY', 'LAY', 'LET', 'LIE', 'LOT', 'LOW', 'MAP', 'MIX', 'NET', 'OIL', 'OWN', 'PAY', 'PUT', 'SAD', 'SAY', 'SET', 'SIX', 'SKY', 'TRY', 'USE', 'WAR', 'WAY', 'WET', 'WHY', 'YET'],
      
      // High-value letters
      ['QUA', 'ZAX', 'ZEX', 'JAW', 'JEW', 'WAX', 'FOX', 'TAX', 'MAX', 'REX', 'SEX', 'VEX', 'HEX', 'JAB', 'JAG', 'JAM', 'JAR', 'JET', 'JIG', 'JOG', 'JOT', 'JOW', 'JOY', 'JUG', 'JUT',
       'ZAG', 'ZAP', 'ZED', 'ZEE', 'ZEN', 'ZEP', 'ZIG', 'ZIP', 'ZIT', 'ZOA', 'ZOD', 'ZOL', 'ZOO', 'ZUZ'],
      
      // 4+ letter words
      ['THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT', 'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE', 'WHAT', 'WORD', 'WORK', 'YEAR',
       'QUIZ', 'JAZZ', 'JINX', 'WAXY', 'FOXY', 'COZY', 'HAZY', 'LAZY', 'MAZE', 'DAZE', 'GAZE', 'RAZE', 'FIZZ', 'BUZZ', 'FUZZ', 'RAZZ',
       'ABOUT', 'AFTER', 'AGAIN', 'BEING', 'COULD', 'EVERY', 'FIRST', 'FOUND', 'GREAT', 'GROUP', 'HOUSE', 'LARGE', 'MIGHT', 'NEVER', 'OTHER', 'PLACE', 'RIGHT', 'SHALL', 'SMALL', 'SOUND', 'STILL', 'THEIR', 'THERE', 'THESE', 'THINK', 'THREE', 'UNDER', 'WATER', 'WHERE', 'WHICH', 'WHILE', 'WORLD', 'WOULD', 'WRITE', 'YOUNG',
       'JAZZY', 'FIZZY', 'FUZZY', 'DIZZY', 'QUAKE', 'QUEEN', 'QUICK', 'QUIET', 'QUILT', 'QUOTE', 'QUART', 'QUASH', 'QUASI', 'QUELL', 'QUERY', 'QUEST', 'QUEUE', 'QUICHE', 'QUIRK']
    ];
    
    // Test all words in our lists
    for (const wordList of wordLists) {
      for (const word of wordList) {
        if (word.length >= this.options.minWordLength && 
            word.length <= this.options.maxWordLength &&
            await dictionaryService.isValidWord(word)) {
          words.add(word);
        }
      }
    }
    
    console.log(`📖 Extracted ${words.size} words from dictionary service`);
    return Array.from(words);
  }

  /**
   * Generate all split variations for a list of words
   */
  private generateAllSplitWords(words: string[]): string[] {
    const splitWords: string[] = [];
    
    for (const word of words) {
      splitWords.push(...this.generateSplitWords(word));
    }
    
    return splitWords;
  }

  /**
   * Generate all split variations for a single word according to GADDAG specification
   * 
   * For word "EXPLAIN":
   * - EXPLAIN (original word, no split)
   * - E_XPLAIN (split after position 1)
   * - XE_PLAIN (reverse "E", add "X", split, add "PLAIN")
   * - PXE_LAIN (reverse "EX", add "P", split, add "LAIN")
   * - LPXE_AIN (reverse "EXP", add "L", split, add "AIN")
   * - ALPXE_IN (reverse "EXPL", add "A", split, add "IN")
   * - IALPXE_N (reverse "EXPLA", add "I", split, add "N")
   * - NIALPXE (complete reversal)
   * 
   * The _ character marks where we can "hook" into existing board tiles
   */
  private generateSplitWords(word: string): string[] {
    const splitWords: string[] = [];
    const upperWord = word.toUpperCase();
    
    // Add original word (no split marker)
    splitWords.push(upperWord);
    
    // Special handling for single letter words
    if (upperWord.length === 1) {
      return splitWords; // Only the direct path for single letters
    }
    
    // CORRECTED: Standard GADDAG algorithm for all words (including two-letter)
    for (let splitPos = 1; splitPos <= upperWord.length; splitPos++) {
      const prefix = upperWord.substring(0, splitPos);
      const suffix = upperWord.substring(splitPos);
      
      if (splitPos === upperWord.length) {
        // Complete reversal - no split marker
        const reversed = prefix.split('').reverse().join('');
        splitWords.push(reversed);
      } else {
        // Partial reversal with split marker
        const reversed = prefix.split('').reverse().join('');
        splitWords.push(reversed + '_' + suffix);
      }
    }
    
    return splitWords;
  }

  /**
   * Insert a word into the GADDAG using incremental construction
   */
  private insertWord(root: GADDAGNode, word: string): void {
    // Find common prefix with previous word
    let commonPrefix = 0;
    const minLength = Math.min(word.length, this.previousWord.length);
    
    for (let i = 0; i < minLength; i++) {
      if (word[i] !== this.previousWord[i]) break;
      commonPrefix++;
    }
    
    // Minimize unchecked nodes beyond common prefix
    if (this.options.enableMinimization) {
      this.minimize(commonPrefix);
    }
    
    // Find the node to extend from
    let node: GADDAGNode;
    if (this.uncheckedNodes.length === 0) {
      node = root;
    } else {
      node = this.uncheckedNodes[this.uncheckedNodes.length - 1].child;
    }
    
    // Add remaining letters
    const suffix = word.substring(commonPrefix);
    for (const letter of suffix) {
      const newNode = this.nodeFactory.createNode();
      node.addEdge(letter, newNode);
      this.uncheckedNodes.push({ parent: node, letter, child: newNode });
      node = newNode;
    }
    
    // Mark end of word - store the original word if this is not a split variation
    const originalWord = word.includes('_') ? word.split('_')[0] + word.split('_')[1].split('').reverse().join('') : word;
    (node as GADDAGNodeImpl).markEndOfWord(originalWord);
    this.previousWord = word;
  }

  /**
   * Minimize nodes from the end of uncheckedNodes down to downTo
   */
  private minimize(downTo: number): void {
    for (let i = this.uncheckedNodes.length - 1; i >= downTo; i--) {
      const { parent, letter, child } = this.uncheckedNodes.pop()!;
      const signature = (child as GADDAGNodeImpl).getSignature();
      
      const existingNode = this.minimizedNodes.get(signature);
      if (existingNode) {
        // Replace with existing equivalent node
        parent.addEdge(letter, existingNode);
      } else {
        // Add to minimized nodes
        this.minimizedNodes.set(signature, child);
        (child as GADDAGNodeImpl).isMinimized = true;
      }
    }
  }

  /**
   * Filter words based on options
   */
  private filterWords(words: string[]): string[] {
    return words.filter(word => {
      const length = word.length;
      return length >= this.options.minWordLength && length <= this.options.maxWordLength;
    });
  }

  /**
   * Reset builder state
   */
  private reset(): void {
    this.nodeFactory.reset();
    this.uncheckedNodes = [];
    this.minimizedNodes.clear();
    this.previousWord = '';
    this.stats = {};
  }

  /**
   * Log construction statistics
   */
  private logStatistics(): void {
    console.log('📊 GADDAG Construction Statistics:');
    console.log(`   Words processed: ${this.stats.wordsProcessed}`);
    console.log(`   Split variations: ${this.stats.splitVariationsGenerated}`);
    console.log(`   Final node count: ${this.stats.nodeCount}`);
    
    if (this.stats.nodesBeforeMinimization) {
      const reduction = ((this.stats.nodesBeforeMinimization - this.stats.nodeCount!) / this.stats.nodesBeforeMinimization * 100).toFixed(1);
      console.log(`   Nodes before minimization: ${this.stats.nodesBeforeMinimization}`);
      console.log(`   Minimization reduction: ${reduction}%`);
    }
    
    console.log(`   Memory usage: ${(this.stats.memoryUsage! / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Construction time: ${this.stats.constructionTime}ms`);
    
    if (this.stats.minimizationTime) {
      console.log(`   Minimization time: ${this.stats.minimizationTime}ms`);
    }
  }

  /**
   * Get construction statistics
   */
  getStatistics(): GADDAGBuildStats {
    return this.stats as GADDAGBuildStats;
  }

  /**
   * Validate the constructed GADDAG
   */
  validateGADDAG(root: GADDAGNode): boolean {
    console.log('🔍 Validating GADDAG integrity...');
    
    const isValid = GADDAGNodeUtils.validateIntegrity(root);
    if (isValid) {
      console.log('✅ GADDAG validation passed');
    } else {
      console.error('❌ GADDAG validation failed');
    }
    
    return isValid;
  }

  /**
   * Test GADDAG by searching for specific words
   */
  async testGADDAG(root: GADDAGNode, testWords: string[] = ['CAT', 'DOG', 'HELLO', 'QUIZ']): Promise<boolean> {
    console.log('🧪 Testing GADDAG with sample words...');
    
    let allFound = true;
    for (const word of testWords) {
      const found = this.findWordInGADDAG(root, word.toUpperCase());
      console.log(`   ${word}: ${found ? '✅' : '❌'}`);
      if (!found) allFound = false;
    }
    
    return allFound;
  }

  /**
   * Search for a word in the GADDAG
   */
  private findWordInGADDAG(root: GADDAGNode, word: string): boolean {
    // Try to find the word by following the original path (no split)
    let current = root;
    
    for (const letter of word) {
      const child = current.getChild?.(letter) || current.edges.get(letter);
      if (!child) {
        return false;
      }
      current = child;
    }
    
    return current.isEndOfWord;
  }

  /**
   * Insert a word with all its GADDAG variations using node sharing
   */
  private insertWordWithSharing(root: GADDAGNode, word: string, nodeCache: Map<string, GADDAGNode>): void {
    const splitWords = this.generateSplitWords(word);
    this.stats.splitVariationsGenerated = (this.stats.splitVariationsGenerated || 0) + splitWords.length;
    
    for (const splitWord of splitWords) {
      this.insertPathWithSharing(root, splitWord, word, nodeCache);
    }
  }

  /**
   * Insert a path with maximal node sharing
   */
  private insertPathWithSharing(root: GADDAGNode, path: string, originalWord: string, nodeCache: Map<string, GADDAGNode>): void {
    let current = root;
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      const remainingPath = path.substring(i + 1);
      
      // Create a signature for this position for caching
      const signature = `${char}:${remainingPath}`;
      
      // Try to reuse existing node
      let child = current.getChild(char);
      
      if (!child) {
        // Check if we can reuse a node from cache
        const cachedNode = nodeCache.get(signature);
        if (cachedNode && remainingPath.length > 2) {
          child = cachedNode;
        } else {
          child = this.nodeFactory.createNode();
          // Cache this node for future reuse (only for longer suffixes)
          if (remainingPath.length > 2) {
            nodeCache.set(signature, child);
          }
        }
        current.addEdge(char, child);
      }
      
      current = child;
    }
    
    // Mark end of word
    (current as GADDAGNodeImpl).markEndOfWord(originalWord);
  }

  /**
   * Insert a word into the GADDAG using simple insertion (not incremental)
   */
  private insertWordSimple(root: GADDAGNode, word: string): void {
    let current = root;
    
    // Follow the path, creating nodes as needed
    for (const letter of word) {
      let child = current.getChild(letter);
      if (!child) {
        child = this.nodeFactory.createNode();
        current.addEdge(letter, child);
      }
      current = child;
    }
    
    // Mark end of word - store the original word if this is not a split variation
    const originalWord = word.includes('_') ? 
      word.split('_')[0] + word.split('_')[1].split('').reverse().join('') : 
      word;
    (current as GADDAGNodeImpl).markEndOfWord(originalWord);
  }

  /**
   * Perform minimization on the entire GADDAG
   */
  private performMinimization(root: GADDAGNode): void {
    // Simple minimization - just mark as minimized for now
    // A full minimization would require more complex algorithms
    const visited = new Set<number>();
    
    const markMinimized = (node: GADDAGNode): void => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      
      (node as GADDAGNodeImpl).isMinimized = true;
      
      for (const child of node.edges.values()) {
        markMinimized(child);
      }
    };
    
    markMinimized(root);
  }
}

/**
 * Singleton GADDAG builder instance
 */
export const gaddagBuilder = new GADDAGBuilder();
