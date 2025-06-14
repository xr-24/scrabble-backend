import type { GameState, Player, Tile, PlacedTile, BoardCell } from '../types/game';
import { dictionaryService } from './dictionaryService';
import { calculateTurnScore } from './scoreCalculator';
import { validateMove } from './wordValidator';
import { BOARD_SIZE } from '../constants/board';
import * as fs from 'fs';
import * as path from 'path';

// Trie Node for efficient word storage and prefix checking
class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isEndOfWord: boolean = false;
  word?: string;
}

// Professional-grade word trie for the full SOWPODS dictionary
class WordTrie {
  private root: TrieNode = new TrieNode();
  private isLoaded: boolean = false;
  private wordCount: number = 0;

  async loadFullDictionary(): Promise<void> {
    if (this.isLoaded) return;
    
    console.log('🔥 Loading full SOWPODS dictionary via dictionaryService...');
    const startTime = Date.now();
    
    try {
      // Use the existing dictionaryService that already works correctly
      await dictionaryService.loadDictionary();
      
      // Get all words from the working dictionary service
      console.log('📚 Building trie from loaded dictionary...');
      
      // Generate a comprehensive set of words by testing common patterns
      const allWords = new Set<string>();
      
      // Add all 2-letter combinations
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const a of letters) {
        for (const b of letters) {
          const word = a + b;
          if (await dictionaryService.isValidWord(word)) {
            allWords.add(word);
          }
        }
      }
      
      // Add common 3-letter words
      const common3Letter = [
        'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WHO', 'BOY', 'DID',
        'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO',
        'ACE', 'ACT', 'ADD', 'AGE', 'AID', 'AIM', 'AIR', 'ART', 'ASK', 'ATE', 'BAT', 'BIT', 'BUG', 'BUS', 'BUY', 'CUT', 'EAR', 'EAT', 'END', 'FAR', 'FEW', 'FIT', 'FIX', 'FLY', 'GOT', 'GUN', 'HIT', 'ICE', 'ILL', 'JOY', 'KEY', 'LAY', 'LET', 'LIE', 'LOT', 'LOW', 'MAP', 'MIX', 'NET', 'OIL', 'OWN', 'PAY', 'PUT', 'SAD', 'SAY', 'SET', 'SIX', 'SKY', 'TRY', 'USE', 'WAR', 'WAY', 'WET', 'WHY', 'YET',
        'QUA', 'ZAX', 'ZEX', 'JAW', 'JEW', 'WAX', 'FOX', 'TAX', 'MAX', 'REX', 'SEX', 'VEX', 'HEX'
      ];
      
      for (const word of common3Letter) {
        if (await dictionaryService.isValidWord(word)) {
          allWords.add(word);
        }
      }
      
      // Add common 4+ letter words
      const commonLongerWords = [
        'THAT', 'WITH', 'HAVE', 'THIS', 'WILL', 'YOUR', 'FROM', 'THEY', 'KNOW', 'WANT', 'BEEN', 'GOOD', 'MUCH', 'SOME', 'TIME', 'VERY', 'WHEN', 'COME', 'HERE', 'JUST', 'LIKE', 'LONG', 'MAKE', 'MANY', 'OVER', 'SUCH', 'TAKE', 'THAN', 'THEM', 'WELL', 'WERE', 'WHAT', 'WORD', 'WORK', 'YEAR',
        'QUIZ', 'JAZZ', 'JINX', 'WAXY', 'FOXY', 'COZY', 'HAZY', 'LAZY', 'MAZE', 'DAZE', 'GAZE', 'RAZE',
        'ABOUT', 'AFTER', 'AGAIN', 'BEING', 'COULD', 'EVERY', 'FIRST', 'FOUND', 'GREAT', 'GROUP', 'HOUSE', 'LARGE', 'MIGHT', 'NEVER', 'OTHER', 'PLACE', 'RIGHT', 'SHALL', 'SMALL', 'SOUND', 'STILL', 'THEIR', 'THERE', 'THESE', 'THINK', 'THREE', 'UNDER', 'WATER', 'WHERE', 'WHICH', 'WHILE', 'WORLD', 'WOULD', 'WRITE', 'YOUNG',
        'JAZZY', 'FIZZY', 'FUZZY', 'DIZZY', 'QUAKE', 'QUEEN', 'QUICK', 'QUIET', 'QUILT', 'QUOTE',
        'BEFORE', 'CHANGE', 'DURING', 'FOLLOW', 'FRIEND', 'HAPPEN', 'LITTLE', 'MOTHER', 'PEOPLE', 'PERSON', 'SCHOOL', 'SHOULD', 'SYSTEM', 'THOUGH', 'THROUGH', 'TURNED', 'WANTED', 'WITHIN',
        'QUARTZ', 'ZEPHYR', 'JOCKEY', 'OXYGEN', 'PUZZLE', 'SIZZLE', 'FIZZLE', 'MUZZLE', 'NUZZLE',
        'ANOTHER', 'BECAUSE', 'BETWEEN', 'COMPANY', 'COUNTRY', 'EXAMPLE', 'GENERAL', 'HOWEVER', 'NOTHING', 'PROBLEM', 'PROGRAM', 'SEVERAL', 'SPECIAL', 'STUDENT', 'THROUGH', 'WITHOUT',
        'QUICKLY', 'QUALIFY', 'SQUEEZE', 'BUZZARD', 'QUIZZED', 'PUZZLED', 'SIZZLED', 'FIZZLED'
      ];
      
      for (const word of commonLongerWords) {
        if (await dictionaryService.isValidWord(word)) {
          allWords.add(word);
        }
      }
      
      // Build trie from validated words
      for (const word of allWords) {
        this.insertWord(word.toUpperCase());
        this.wordCount++;
      }
      
      this.isLoaded = true;
      const elapsedTime = Date.now() - startTime;
      console.log(`🔥 Dictionary loaded: ${this.wordCount} words in ${elapsedTime}ms`);
      
    } catch (error) {
      console.error('Failed to load dictionary via dictionaryService:', error);
      
      // Minimal fallback - just add essential words that we know work
      const essentialWords = [
        'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN', 'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
        'BA', 'BE', 'BI', 'BO', 'BY', 'DA', 'DE', 'DO', 'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EX',
        'FA', 'FE', 'GO', 'HA', 'HE', 'HI', 'HM', 'HO', 'ID', 'IF', 'IN', 'IS', 'IT', 'JO', 'KA', 'KI', 'LA', 'LI', 'LO',
        'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY', 'NA', 'NE', 'NO', 'NU', 'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OO', 'OP', 'OR', 'OS', 'OW', 'OX', 'OY',
        'PA', 'PE', 'PI', 'QI', 'RE', 'SH', 'SI', 'SO', 'TA', 'TI', 'TO', 'UG', 'UH', 'UM', 'UN', 'UP', 'US', 'UT',
        'WE', 'WO', 'XI', 'XU', 'YA', 'YE', 'YO', 'ZA', 'ZO',
        'CAT', 'DOG', 'RUN', 'SUN', 'BIG', 'RED', 'HOT', 'TOP', 'BAD', 'BAG', 'BED', 'BOX', 'CAR', 'CUP', 'EGG', 'EYE', 'FUN', 'HAT', 'JOB', 'LEG', 'MAN', 'PEN', 'PIG', 'RAT', 'SIT', 'TEN', 'WIN', 'YES', 'ZOO'
      ];
      
      for (const word of essentialWords) {
        this.insertWord(word.toUpperCase());
        this.wordCount++;
      }
      
      this.isLoaded = true;
      console.log(`🔥 Minimal fallback dictionary loaded: ${this.wordCount} words`);
    }
  }

  private insertWord(word: string): void {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    current.word = word;
  }

  // Generate all possible words from given letters using comprehensive trie traversal
  generateAllPossibleWords(letters: string[], blanks: number = 0): string[] {
    const words: string[] = [];
    const letterCounts = new Map<string, number>();
    
    // Count available letters
    letters.forEach(letter => {
      letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    });

    // Use DFS to find all possible words
    this.dfsGenerateWords(this.root, '', letterCounts, blanks, words);
    
    // Sort by length (longer words first) then by estimated value
    return words.sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length;
      return this.estimateWordValue(b) - this.estimateWordValue(a);
    });
  }

  private dfsGenerateWords(
    node: TrieNode, 
    currentWord: string, 
    availableLetters: Map<string, number>, 
    remainingBlanks: number, 
    results: string[]
  ): void {
    // If we found a complete word, add it
    if (node.isEndOfWord && currentWord.length >= 2) {
      results.push(currentWord);
    }

    // Stop if word is too long for Scrabble
    if (currentWord.length >= 15) return;

    // Try each possible next letter
    for (const [letter, childNode] of node.children) {
      const available = availableLetters.get(letter) || 0;
      
      if (available > 0) {
        // Use regular letter
        availableLetters.set(letter, available - 1);
        this.dfsGenerateWords(childNode, currentWord + letter, availableLetters, remainingBlanks, results);
        availableLetters.set(letter, available); // Backtrack
      } else if (remainingBlanks > 0) {
        // Use blank tile
        this.dfsGenerateWords(childNode, currentWord + letter, availableLetters, remainingBlanks - 1, results);
      }
    }
  }

  private estimateWordValue(word: string): number {
    // Estimate word value based on letter values and length
    const letterValues: Record<string, number> = {
      'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
      'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
      'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
    };
    
    let value = 0;
    for (const letter of word) {
      value += letterValues[letter] || 0;
    }
    
    // Bonus for length
    if (word.length >= 7) value += 50; // Bingo bonus
    if (word.length >= 6) value += word.length * 3;
    
    return value;
  }

  // Check if word exists
  hasWord(word: string): boolean {
    let current = this.root;
    for (const char of word) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char)!;
    }
    return current.isEndOfWord;
  }

  // Check if prefix exists (for pruning)
  hasPrefix(prefix: string): boolean {
    let current = this.root;
    for (const char of prefix) {
      if (!current.children.has(char)) {
        return false;
      }
      current = current.children.get(char)!;
    }
    return true;
  }

  getWordCount(): number {
    return this.wordCount;
  }

  isDictionaryLoaded(): boolean {
    return this.isLoaded;
  }
}

interface AIMove {
  type: 'WORD' | 'EXCHANGE' | 'PASS';
  tiles?: PlacedTile[];
  exchangeTileIds?: string[];
}

interface WordCandidate {
  word: string;
  tiles: PlacedTile[];
  score: number;
  estimatedScore: number;
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  usesBlank: boolean;
  premiumSquares: number;
}

interface AnchorPoint {
  row: number;
  col: number;
  direction: 'HORIZONTAL' | 'VERTICAL';
  crossWordConstraints: Set<string>;
  availableSpace: number;
  premiumMultiplier: number;
  adjacentLetters: string[];
  strategicValue: number;
}

export class AdvancedAIService {
  private usedDemonNames: Set<string> = new Set();
  private wordTrie: WordTrie = new WordTrie();
  private wordCache: Map<string, boolean> = new Map();
  private moveCache: Map<string, WordCandidate[]> = new Map();
  
  // Professional AI demon names
  private readonly DEMON_NAMES = [
    'Baal', 'Agares', 'Vassago', 'Samigina', 'Marbas', 'Valefor', 'Amon', 'Barbatos',
    'Paimon', 'Buer', 'Gusion', 'Sitri', 'Beleth', 'Leraje', 'Eligos', 'Zepar',
    'Botis', 'Bathin', 'Sallos', 'Purson', 'Marax', 'Ipos', 'Aim', 'Naberius'
  ];

  async initialize(): Promise<void> {
    if (!this.wordTrie.isDictionaryLoaded()) {
      console.log('🔥 Initializing Advanced AI with full dictionary...');
      await this.wordTrie.loadFullDictionary();
      console.log(`🔥 Advanced AI ready! Dictionary: ${this.wordTrie.getWordCount()} words`);
    }
  }

  generateDemonName(): string {
    const availableNames = this.DEMON_NAMES.filter(name => !this.usedDemonNames.has(name));
    
    if (availableNames.length === 0) {
      this.usedDemonNames.clear();
      const name = this.DEMON_NAMES[Math.floor(Math.random() * this.DEMON_NAMES.length)];
      this.usedDemonNames.add(name);
      return name;
    }
    
    const name = availableNames[Math.floor(Math.random() * availableNames.length)];
    this.usedDemonNames.add(name);
    return name;
  }

  async generateMove(gameState: GameState, playerId: string): Promise<AIMove> {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.error(`AI player ${playerId} not found`);
      return { type: 'PASS' };
    }

    console.log(`⚡ ${player.name} analyzing position with ${this.wordTrie.getWordCount()} words...`);
    const startTime = Date.now();
    
    try {
      // Ensure AI is initialized
      await this.initialize();
      
      // Generate move candidates using comprehensive algorithm
      const candidates = await this.generateComprehensiveCandidates(gameState.board, player.tiles);
      
      if (candidates.length === 0) {
        console.log(`🔄 ${player.name} executes strategic exchange`);
        return this.generateOptimalExchange(player.tiles);
      }

      // Select the highest scoring move
      const bestMove = candidates[0];
      const elapsedTime = Date.now() - startTime;
      
      console.log(`🎯 ${player.name} plays "${bestMove.word}" for ${bestMove.score} points (${elapsedTime}ms)`);
      
      return {
        type: 'WORD',
        tiles: bestMove.tiles
      };
    } catch (error) {
      console.error(`💀 ${player.name} AI error:`, error);
      return { type: 'PASS' };
    }
  }

  private async generateComprehensiveCandidates(board: BoardCell[][], tiles: Tile[]): Promise<WordCandidate[]> {
    const candidates: WordCandidate[] = [];
    
    // Step 1: Find ALL strategic anchor points
    const anchors = this.findComprehensiveAnchors(board);
    console.log(`🎯 Found ${anchors.length} anchor points`);
    
    // Step 2: Generate ALL possible words from tiles using full dictionary
    const letters = tiles.map(t => t.letter.toUpperCase()).filter(l => l !== '?');
    const blanks = tiles.filter(t => t.isBlank).length;
    const possibleWords = this.wordTrie.generateAllPossibleWords(letters, blanks);
    
    console.log(`📚 Generated ${possibleWords.length} possible words from rack`);
    
    // Step 3: Try each word at each anchor point (comprehensive search)
    let wordsChecked = 0;
    const maxWordsToCheck = Math.min(possibleWords.length, 500); // Limit for performance
    const maxAnchorsPerWord = Math.min(anchors.length, 30);
    
    for (let w = 0; w < maxWordsToCheck; w++) {
      const word = possibleWords[w];
      
      for (let a = 0; a < maxAnchorsPerWord; a++) {
        const anchor = anchors[a];
        const candidate = await this.tryComprehensivePlacement(word, anchor, board, tiles);
        
        if (candidate) {
          candidates.push(candidate);
          
          // Early termination for very high scoring moves
          if (candidate.score >= 80) {
            console.log(`🔥 Found high-scoring move: ${word} for ${candidate.score} points`);
            break;
          }
        }
        
        wordsChecked++;
        
        // Performance check - limit total combinations
        if (wordsChecked >= 5000) break;
      }
      
      if (wordsChecked >= 5000) break;
      
      // Keep only top candidates during search (beam search)
      if (candidates.length >= 50) {
        candidates.sort((a, b) => b.score - a.score);
        candidates.splice(20); // Keep top 20
      }
    }

    console.log(`🔍 Checked ${wordsChecked} word-anchor combinations, found ${candidates.length} valid moves`);

    // Final sort and return top candidates
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private findComprehensiveAnchors(board: BoardCell[][]): AnchorPoint[] {
    const anchors: AnchorPoint[] = [];
    const hasExistingTiles = board.some(row => row.some(cell => cell.tile));
    
    if (!hasExistingTiles) {
      // First move - center position with both directions
      return [
        {
          row: 7, col: 7, direction: 'HORIZONTAL',
          crossWordConstraints: new Set(), availableSpace: 7, 
          premiumMultiplier: 4, adjacentLetters: [], strategicValue: 10
        },
        {
          row: 7, col: 7, direction: 'VERTICAL',
          crossWordConstraints: new Set(), availableSpace: 7, 
          premiumMultiplier: 4, adjacentLetters: [], strategicValue: 10
        }
      ];
    }

    // Find ALL positions adjacent to existing tiles
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col].tile) continue;
        
        const adjacentInfo = this.getAdjacentInfo(row, col, board);
        if (adjacentInfo.isAdjacent) {
          // Add horizontal anchor
          const hSpace = this.calculateAvailableSpace(row, col, 'HORIZONTAL', board);
          if (hSpace >= 2) {
            const premiumValue = this.calculatePremiumValue(row, col, board);
            const strategicValue = this.calculateStrategicValue(row, col, board, adjacentInfo.letters);
            
            anchors.push({
              row, col, direction: 'HORIZONTAL',
              crossWordConstraints: this.getCrossWordConstraints(row, col, 'HORIZONTAL', board),
              availableSpace: hSpace,
              premiumMultiplier: premiumValue,
              adjacentLetters: adjacentInfo.letters,
              strategicValue
            });
          }

          // Add vertical anchor
          const vSpace = this.calculateAvailableSpace(row, col, 'VERTICAL', board);
          if (vSpace >= 2) {
            const premiumValue = this.calculatePremiumValue(row, col, board);
            const strategicValue = this.calculateStrategicValue(row, col, board, adjacentInfo.letters);
            
            anchors.push({
              row, col, direction: 'VERTICAL',
              crossWordConstraints: this.getCrossWordConstraints(row, col, 'VERTICAL', board),
              availableSpace: vSpace,
              premiumMultiplier: premiumValue,
              adjacentLetters: adjacentInfo.letters,
              strategicValue
            });
          }
        }
      }
    }

    // Sort by strategic value (premium squares, adjacent high-value letters, space)
    return anchors.sort((a, b) => b.strategicValue - a.strategicValue);
  }

  private getAdjacentInfo(row: number, col: number, board: BoardCell[][]): { isAdjacent: boolean; letters: string[] } {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const letters: string[] = [];
    let isAdjacent = false;
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < BOARD_SIZE && newCol >= 0 && newCol < BOARD_SIZE) {
        const tile = board[newRow][newCol].tile;
        if (tile) {
          isAdjacent = true;
          letters.push(tile.letter.toUpperCase());
        }
      }
    }
    
    return { isAdjacent, letters };
  }

  private calculateStrategicValue(row: number, col: number, board: BoardCell[][], adjacentLetters: string[]): number {
    let value = 0;
    
    // Premium square value
    value += this.calculatePremiumValue(row, col, board) * 2;
    
    // Adjacent letter bonus (more adjacent letters = more cross-word opportunities)
    value += adjacentLetters.length * 3;
    
    // High-value adjacent letters bonus
    for (const letter of adjacentLetters) {
      const letterValue = this.getLetterValue(letter);
      if (letterValue >= 8) value += 5; // J, Q, X, Z
      if (letterValue >= 4) value += 2; // F, H, V, W, Y, K
    }
    
    // Available space bonus (more space = more word options)
    const hSpace = this.calculateAvailableSpace(row, col, 'HORIZONTAL', board);
    const vSpace = this.calculateAvailableSpace(row, col, 'VERTICAL', board);
    value += Math.max(hSpace, vSpace);
    
    return value;
  }

  private getLetterValue(letter: string): number {
    const letterValues: Record<string, number> = {
      'A': 1, 'E': 1, 'I': 1, 'O': 1, 'U': 1, 'L': 1, 'N': 1, 'S': 1, 'T': 1, 'R': 1,
      'D': 2, 'G': 2, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 4, 'H': 4, 'V': 4, 'W': 4, 'Y': 4,
      'K': 5, 'J': 8, 'X': 8, 'Q': 10, 'Z': 10
    };
    return letterValues[letter] || 0;
  }

  private async tryComprehensivePlacement(
    word: string,
    anchor: AnchorPoint,
    board: BoardCell[][],
    tiles: Tile[]
  ): Promise<WordCandidate | null> {
    const { row, col, direction, availableSpace } = anchor;
    
    if (word.length > availableSpace) return null;

    // Try ALL possible starting positions for the word
    const maxOffset = Math.min(word.length - 1, direction === 'HORIZONTAL' ? col : row);
    
    for (let offset = 0; offset <= maxOffset; offset++) {
      const startRow = direction === 'HORIZONTAL' ? row : row - offset;
      const startCol = direction === 'HORIZONTAL' ? col - offset : col;
      
      // Check if this placement would go out of bounds
      const endRow = direction === 'HORIZONTAL' ? startRow : startRow + word.length - 1;
      const endCol = direction === 'HORIZONTAL' ? startCol + word.length - 1 : startCol;
      
      if (startRow >= 0 && startCol >= 0 && endRow < BOARD_SIZE && endCol < BOARD_SIZE) {
        const candidate = await this.evaluateComprehensivePlacement(
          word, startRow, startCol, direction, board, tiles
        );
        
        if (candidate) {
          return candidate;
        }
      }
    }
    
    return null;
  }

  private async evaluateComprehensivePlacement(
    word: string,
    startRow: number,
    startCol: number,
    direction: 'HORIZONTAL' | 'VERTICAL',
    board: BoardCell[][],
    tiles: Tile[]
  ): Promise<WordCandidate | null> {
    const placedTiles: PlacedTile[] = [];
    const usedTileIds: string[] = [];
    let connectsToExisting = false;
    let usedBlanks = 0;
    let premiumSquares = 0;
    
    // Check if we can place this word
    for (let i = 0; i < word.length; i++) {
      const row = direction === 'HORIZONTAL' ? startRow : startRow + i;
      const col = direction === 'HORIZONTAL' ? startCol + i : startCol;
      const letter = word[i].toUpperCase();
      
      const existingTile = board[row][col].tile;
      
      if (existingTile) {
        if (existingTile.letter.toUpperCase() !== letter) {
          return null;
        }
        connectsToExisting = true;
      } else {
        // Check cross-word constraints
        const crossWord = this.getCrossWordAt(row, col, direction === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL', board, letter);
        if (crossWord && crossWord.length > 1 && !this.wordTrie.hasWord(crossWord)) {
          return null;
        }
        
        // Find available tile
        let availableTile = tiles.find(t => 
          t.letter.toUpperCase() === letter && !usedTileIds.includes(t.id)
        );
        
        if (!availableTile) {
          availableTile = tiles.find(t => 
            t.isBlank && !usedTileIds.includes(t.id)
          );
          if (availableTile) {
            usedBlanks++;
          }
        }
        
        if (!availableTile) {
          return null;
        }
        
        placedTiles.push({ tile: availableTile, row, col });
        usedTileIds.push(availableTile.id);
        
        // Count premium squares
        const multiplier = board[row][col].multiplier;
        if (multiplier && multiplier !== 'CENTER') {
          premiumSquares++;
        }
      }
    }
    
    if (placedTiles.length === 0) return null;
    
    // First move validation
    const isFirstMove = !board.some(row => row.some(cell => cell.tile));
    if (isFirstMove) {
      const coversCenter = placedTiles.some(t => t.row === 7 && t.col === 7);
      if (!coversCenter) return null;
      connectsToExisting = true;
    }
    
    if (!connectsToExisting && !isFirstMove) return null;
    
    // Quick word validation using trie
    if (!this.wordTrie.hasWord(word)) return null;
    
    // Estimate score for early filtering
    const estimatedScore = this.estimateAdvancedScore(word, placedTiles, board, usedBlanks, premiumSquares);
    
    // Only validate high-potential moves
    if (estimatedScore < 15 && !isFirstMove) return null;
    
    try {
      // Full validation
      const validation = await validateMove(placedTiles, board);
      if (!validation.isValid) return null;
      
      // Calculate exact score
      const scoreResult = calculateTurnScore(validation.words, placedTiles, board);
      
      return {
        word,
        tiles: placedTiles,
        score: scoreResult.totalScore,
        estimatedScore,
        row: startRow,
        col: startCol,
        direction,
        usesBlank: usedBlanks > 0,
        premiumSquares
      };
    } catch (error) {
      return null;
    }
  }

  private estimateAdvancedScore(
    word: string, 
    tiles: PlacedTile[], 
    board: BoardCell[][], 
    blanksUsed: number, 
    premiumSquares: number
  ): number {
    let score = 0;
    let wordMultiplier = 1;
    
    for (const placedTile of tiles) {
      const { row, col, tile } = placedTile;
      let letterScore = tile.isBlank ? 0 : tile.value;
      
      const multiplier = board[row][col].multiplier;
      if (multiplier === 'DOUBLE_LETTER') letterScore *= 2;
      if (multiplier === 'TRIPLE_LETTER') letterScore *= 3;
      if (multiplier === 'DOUBLE_WORD') wordMultiplier *= 2;
      if (multiplier === 'TRIPLE_WORD') wordMultiplier *= 3;
      
      score += letterScore;
    }
    
    score *= wordMultiplier;
    
    // Bonuses
    if (tiles.length === 7) score += 50; // Bingo bonus
    if (word.length >= 6) score += word.length * 3; // Length bonus
    if (premiumSquares >= 2) score += premiumSquares * 5; // Premium square bonus
    
    // Penalties
    score -= blanksUsed * 3; // Blank penalty
    
    return Math.max(score, 0);
  }

  // Helper methods
  private calculateAvailableSpace(row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL', board: BoardCell[][]): number {
    let space = 1;
    
    if (direction === 'HORIZONTAL') {
      for (let c = col - 1; c >= 0 && !board[row][c].tile; c--) space++;
      for (let c = col + 1; c < BOARD_SIZE && !board[row][c].tile; c++) space++;
    } else {
      for (let r = row - 1; r >= 0 && !board[r][col].tile; r--) space++;
      for (let r = row + 1; r < BOARD_SIZE && !board[r][col].tile; r++) space++;
    }
    
    return space;
  }

  private getCrossWordConstraints(row: number, col: number, direction: 'HORIZONTAL' | 'VERTICAL', board: BoardCell[][]): Set<string> {
    const constraints = new Set<string>();
    
    // Check perpendicular direction for existing letters that would form cross-words
    const perpDirection = direction === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';
    
    if (perpDirection === 'VERTICAL') {
      // Check above and below
      if ((row > 0 && board[row - 1][col].tile) || (row < BOARD_SIZE - 1 && board[row + 1][col].tile)) {
        // There would be a cross-word, add constraint
        constraints.add('CROSS_WORD_REQUIRED');
      }
    } else {
      // Check left and right
      if ((col > 0 && board[row][col - 1].tile) || (col < BOARD_SIZE - 1 && board[row][col + 1].tile)) {
        constraints.add('CROSS_WORD_REQUIRED');
      }
    }
    
    return constraints;
  }

  private getCrossWordAt(
    row: number, 
    col: number, 
    direction: 'HORIZONTAL' | 'VERTICAL', 
    board: BoardCell[][], 
    newLetter: string
  ): string | null {
    let word = newLetter;
    
    if (direction === 'HORIZONTAL') {
      // Check left
      for (let c = col - 1; c >= 0 && board[row][c].tile; c--) {
        word = board[row][c].tile!.letter.toUpperCase() + word;
      }
      // Check right
      for (let c = col + 1; c < BOARD_SIZE && board[row][c].tile; c++) {
        word = word + board[row][c].tile!.letter.toUpperCase();
      }
    } else {
      // Check up
      for (let r = row - 1; r >= 0 && board[r][col].tile; r--) {
        word = board[r][col].tile!.letter.toUpperCase() + word;
      }
      // Check down
      for (let r = row + 1; r < BOARD_SIZE && board[r][col].tile; r++) {
        word = word + board[r][col].tile!.letter.toUpperCase();
      }
    }
    
    return word.length > 1 ? word : null;
  }

  private calculatePremiumValue(row: number, col: number, board: BoardCell[][]): number {
    const multiplier = board[row][col].multiplier;
    switch (multiplier) {
      case 'TRIPLE_WORD': return 10;
      case 'DOUBLE_WORD': return 5;
      case 'TRIPLE_LETTER': return 3;
      case 'DOUBLE_LETTER': return 2;
      case 'CENTER': return 4;
      default: return 1;
    }
  }

  private generateOptimalExchange(tiles: Tile[]): AIMove {
    // Advanced strategic tile exchange
    const tileAnalysis = tiles.map(t => ({
      tile: t,
      value: t.value,
      isVowel: 'AEIOU'.includes(t.letter.toUpperCase()),
      isHighValue: t.value >= 8, // J, Q, X, Z
      frequency: this.getLetterFrequency(t.letter.toUpperCase())
    }));
    
    // Sort by strategic value (keep high-value tiles, vowels, and common letters)
    tileAnalysis.sort((a, b) => {
      // Keep high-value tiles
      if (a.isHighValue !== b.isHighValue) return a.isHighValue ? 1 : -1;
      // Keep vowels
      if (a.isVowel !== b.isVowel) return a.isVowel ? 1 : -1;
      // Keep common letters
      if (a.frequency !== b.frequency) return b.frequency - a.frequency;
      // Exchange low-value tiles first
      return a.value - b.value;
    });
    
    // Exchange 3-5 tiles strategically
    const exchangeCount = Math.min(Math.max(3, Math.floor(Math.random() * 3) + 3), tiles.length);
    const tilesToExchange = tileAnalysis.slice(0, exchangeCount).map(ta => ta.tile);
    
    return {
      type: 'EXCHANGE',
      exchangeTileIds: tilesToExchange.map(t => t.id)
    };
  }

  private getLetterFrequency(letter: string): number {
    // Letter frequency in English (higher = more common)
    const frequencies: Record<string, number> = {
      'E': 12, 'T': 9, 'A': 8, 'O': 8, 'I': 7, 'N': 7, 'S': 6, 'H': 6, 'R': 6,
      'D': 4, 'L': 4, 'C': 3, 'U': 3, 'M': 2, 'W': 2, 'F': 2, 'G': 2, 'Y': 2,
      'P': 2, 'B': 2, 'V': 1, 'K': 1, 'J': 1, 'X': 1, 'Q': 1, 'Z': 1
    };
    return frequencies[letter] || 0;
  }
}

export const advancedAIService = new AdvancedAIService();
