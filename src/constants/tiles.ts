import type { Tile } from '../types/game';

export const TILE_DISTRIBUTION: Record<string, { count: number; value: number }> = {
  'A': { count: 9, value: 1 },
  'B': { count: 2, value: 3 },
  'C': { count: 2, value: 3 },
  'D': { count: 4, value: 2 },
  'E': { count: 12, value: 1 },
  'F': { count: 2, value: 4 },
  'G': { count: 3, value: 2 },
  'H': { count: 2, value: 4 },
  'I': { count: 9, value: 1 },
  'J': { count: 1, value: 8 },
  'K': { count: 1, value: 5 },
  'L': { count: 4, value: 1 },
  'M': { count: 2, value: 3 },
  'N': { count: 6, value: 1 },
  'O': { count: 8, value: 1 },
  'P': { count: 2, value: 3 },
  'Q': { count: 1, value: 10 },
  'R': { count: 6, value: 1 },
  'S': { count: 4, value: 1 },
  'T': { count: 6, value: 1 },
  'U': { count: 4, value: 1 },
  'V': { count: 2, value: 4 },
  'W': { count: 2, value: 4 },
  'X': { count: 1, value: 8 },
  'Y': { count: 2, value: 4 },
  'Z': { count: 1, value: 10 },
  '?': { count: 2, value: 0 }, // Blank tiles
};

export const TILES_PER_PLAYER = 7;
export const TOTAL_TILES = 100;

export function createTileBag(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;

  Object.entries(TILE_DISTRIBUTION).forEach(([letter, { count, value }]) => {
    for (let i = 0; i < count; i++) {
      tiles.push({
        letter,
        value,
        id: `tile-${id++}`,
        isBlank: letter === '?',
      });
    }
  });

  // Shuffle the tiles
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  return tiles;
}

export function drawTiles(tileBag: Tile[], count: number): { drawnTiles: Tile[]; remainingBag: Tile[] } {
  const drawnTiles = tileBag.slice(0, count);
  const remainingBag = tileBag.slice(count);
  return { drawnTiles, remainingBag };
}
