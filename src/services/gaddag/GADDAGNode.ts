/**
 * GADDAG Node Implementation
 * Based on Steven Gordon's "A Faster Scrabble Move Generation Algorithm"
 * 
 * This represents a single node in the GADDAG (Generalized Acyclic Directed Graph)
 * data structure used for efficient Scrabble move generation.
 */

export interface GADDAGNode {
  /** Map of letter -> child node for efficient traversal */
  edges: Map<string, GADDAGNode>;
  
  /** True if this node represents the end of a valid word */
  isEndOfWord: boolean;
  
  /** Unique identifier for this node (used in minimization) */
  id: number;
  
  /** Optional: The complete word if this is an end node */
  word?: string;
  
  /** Optional: Whether this node has been minimized (for debugging) */
  isMinimized?: boolean;
  
  /** Add an edge to another node */
  addEdge(letter: string, node: GADDAGNode): void;
  
  /** Get child node for a letter */
  getChild(letter: string): GADDAGNode | undefined;
  
  /** Check if this node has an edge for a letter */
  hasEdge(letter: string): boolean;
  
  /** Mark this node as the end of a word */
  markEndOfWord(word?: string): void;
  
  /** Get all outgoing letters from this node */
  getOutgoingLetters(): string[];
  
  /** Get the number of outgoing edges */
  getEdgeCount(): number;
}

/**
 * Concrete implementation of GADDAGNode
 */
export class GADDAGNodeImpl implements GADDAGNode {
  public edges: Map<string, GADDAGNode> = new Map();
  public isEndOfWord: boolean = false;
  public word?: string;
  public isMinimized?: boolean = false;

  constructor(public id: number) {}

  /**
   * Add an edge to another node
   */
  addEdge(letter: string, node: GADDAGNode): void {
    // Keep the underscore character as-is for GADDAG split marker
    const key = letter === '_' ? '_' : letter.toUpperCase();
    this.edges.set(key, node);
  }

  /**
   * Get child node for a letter
   */
  getChild(letter: string): GADDAGNode | undefined {
    // Keep the underscore character as-is for GADDAG split marker
    const key = letter === '_' ? '_' : letter.toUpperCase();
    return this.edges.get(key);
  }

  /**
   * Check if this node has an edge for a letter
   */
  hasEdge(letter: string): boolean {
    // Keep the underscore character as-is for GADDAG split marker
    const key = letter === '_' ? '_' : letter.toUpperCase();
    return this.edges.has(key);
  }

  /**
   * Mark this node as the end of a word
   */
  markEndOfWord(word?: string): void {
    this.isEndOfWord = true;
    if (word) {
      this.word = word.toUpperCase();
    }
  }

  /**
   * Get all outgoing letters from this node
   */
  getOutgoingLetters(): string[] {
    return Array.from(this.edges.keys());
  }

  /**
   * Get the number of outgoing edges
   */
  getEdgeCount(): number {
    return this.edges.size;
  }

  /**
   * Create a signature for this node (used in minimization)
   * Two nodes with the same signature can be merged
   */
  getSignature(): string {
    const endMarker = this.isEndOfWord ? '1' : '0';
    const edgeSignatures = Array.from(this.edges.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, node]) => `${letter}:${node.id}`)
      .join('|');
    
    return `${endMarker}#${edgeSignatures}`;
  }

  /**
   * Clone this node (for minimization purposes)
   */
  clone(newId: number): GADDAGNodeImpl {
    const cloned = new GADDAGNodeImpl(newId);
    cloned.isEndOfWord = this.isEndOfWord;
    cloned.word = this.word;
    cloned.isMinimized = this.isMinimized;
    
    // Note: edges are not cloned here - they need to be set separately
    // to avoid circular references during minimization
    
    return cloned;
  }

  /**
   * Get memory usage estimate for this node
   */
  getMemoryUsage(): number {
    let size = 64; // Base object size
    size += this.edges.size * 32; // Map entries
    size += (this.word?.length || 0) * 2; // String storage
    return size;
  }

  /**
   * Debug representation of this node
   */
  toString(): string {
    const edges = Array.from(this.edges.keys()).join(',');
    const endMarker = this.isEndOfWord ? '*' : '';
    return `Node[${this.id}]${endMarker}(${edges})`;
  }
}

/**
 * Factory for creating GADDAG nodes
 */
export class GADDAGNodeFactory {
  private nextId: number = 1;

  /**
   * Create a new GADDAG node with unique ID
   */
  createNode(): GADDAGNodeImpl {
    return new GADDAGNodeImpl(this.nextId++);
  }

  /**
   * Reset the ID counter (useful for testing)
   */
  reset(): void {
    this.nextId = 1;
  }

  /**
   * Get the next ID that would be assigned
   */
  getNextId(): number {
    return this.nextId;
  }
}

/**
 * Utility functions for working with GADDAG nodes
 */
export class GADDAGNodeUtils {
  /**
   * Calculate the total memory usage of a GADDAG tree
   */
  static calculateMemoryUsage(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) {
      return 0; // Already counted
    }
    
    visited.add(root.id);
    let totalSize = (root as GADDAGNodeImpl).getMemoryUsage();
    
    for (const child of root.edges.values()) {
      totalSize += this.calculateMemoryUsage(child, visited);
    }
    
    return totalSize;
  }

  /**
   * Count the total number of nodes in a GADDAG tree
   */
  static countNodes(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) {
      return 0;
    }
    
    visited.add(root.id);
    let count = 1;
    
    for (const child of root.edges.values()) {
      count += this.countNodes(child, visited);
    }
    
    return count;
  }

  /**
   * Count the number of words stored in a GADDAG tree
   */
  static countWords(root: GADDAGNode, visited: Set<number> = new Set()): number {
    if (visited.has(root.id)) {
      return 0;
    }
    
    visited.add(root.id);
    let count = root.isEndOfWord ? 1 : 0;
    
    for (const child of root.edges.values()) {
      count += this.countWords(child, visited);
    }
    
    return count;
  }

  /**
   * Find all words in a GADDAG tree (for debugging)
   */
  static findAllWords(root: GADDAGNode, prefix: string = '', visited: Set<number> = new Set()): string[] {
    if (visited.has(root.id)) {
      return [];
    }
    
    visited.add(root.id);
    const words: string[] = [];
    
    if (root.isEndOfWord) {
      words.push(prefix);
    }
    
    for (const [letter, child] of root.edges) {
      words.push(...this.findAllWords(child, prefix + letter, visited));
    }
    
    return words;
  }

  /**
   * Validate the integrity of a GADDAG tree
   */
  static validateIntegrity(root: GADDAGNode, visited: Set<number> = new Set()): boolean {
    if (visited.has(root.id)) {
      return true; // Already validated
    }
    
    visited.add(root.id);
    
    // Check that all edges point to valid nodes
    for (const [letter, child] of root.edges) {
      if (!child || typeof child.id !== 'number') {
        console.error(`Invalid child node for letter ${letter} in node ${root.id}`);
        return false;
      }
      
      if (!this.validateIntegrity(child, visited)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get statistics about a GADDAG tree
   */
  static getStatistics(root: GADDAGNode): {
    nodeCount: number;
    wordCount: number;
    memoryUsage: number;
    averageEdgesPerNode: number;
    maxDepth: number;
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
    const calculateMaxDepth = (node: GADDAGNode, depth: number = 0, visited: Set<number> = new Set()): number => {
      if (visited.has(node.id)) return depth;
      visited.add(node.id);
      
      let maxDepth = depth;
      for (const child of node.edges.values()) {
        maxDepth = Math.max(maxDepth, calculateMaxDepth(child, depth + 1, visited));
      }
      return maxDepth;
    };
    
    const maxDepth = calculateMaxDepth(root);
    
    return {
      nodeCount,
      wordCount,
      memoryUsage,
      averageEdgesPerNode,
      maxDepth
    };
  }
}
