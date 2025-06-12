import * as fs from 'fs';
import * as path from 'path';

class DictionaryService {
  private words: Set<string> | null = null;
  private isLoaded: boolean = false;

  async loadDictionary(): Promise<void> {
    console.log('Loading dictionary...');
    
    try {
      // Try to load from local file first (for development)
      const localPath = path.join(process.cwd(), 'public', 'sowpods.txt');
      if (fs.existsSync(localPath)) {
        const content = fs.readFileSync(localPath, 'utf8');
        this.words = new Set(content.trim().split('\n').map(word => word.trim().toUpperCase()));
        this.isLoaded = true;
        console.log(`Dictionary loaded from local file with ${this.words.size} words`);
        return;
      }
    } catch (error) {
      console.log('Local file not found, downloading dictionary...');
    }

    // Download dictionary using native fetch
    try {
      console.log('Downloading dictionary from remote source...');
      const response = await fetch('https://www.wordgamedictionary.com/sowpods/download/sowpods.txt');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      this.words = new Set(content.trim().split('\n').map(word => word.trim().toUpperCase()));
      this.isLoaded = true;
      console.log(`Dictionary downloaded and loaded with ${this.words.size} words`);
    } catch (error) {
      console.error('Failed to download dictionary:', error);
      throw new Error('Could not load dictionary from any source');
    }
  }

  async isValidWord(word: string): Promise<boolean> {
    if (!word || word.length === 0) {
      return false;
    }

    await this.loadDictionary();
    
    if (!this.words) {
      throw new Error('Dictionary not loaded');
    }

    return this.words.has(word.toUpperCase());
  }

  getDictionarySize(): number {
    return this.words ? this.words.size : 0;
  }

  isDictionaryLoaded(): boolean {
    return this.isLoaded;
  }
}

// Export a singleton instance
export const dictionaryService = new DictionaryService();
