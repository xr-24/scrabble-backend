import type { PowerUp, PowerUpType, Player, PlacedTile, Tile } from '../types/game';

export interface GameModifiers {
  allowUnlimitedTiles: boolean;
  scoreMultiplier: number;
  skipTurnAdvancement: boolean;
  allowWildCards: boolean;
  addBlankTile: boolean;               // For CRESCENT_MOON
  swapWithOpponent: boolean;           // For WILTED_ROSE
  guaranteedVowelSwap: boolean;        // For HEADSTONE
}

export class PowerUpManager {
  static getDefaultModifiers(): GameModifiers {
    return {
      allowUnlimitedTiles: false,
      scoreMultiplier: 1,
      skipTurnAdvancement: false,
      allowWildCards: false,
      addBlankTile: false,
      swapWithOpponent: false,
      guaranteedVowelSwap: false
    };
  }

  static applyPowerUpEffects(powerUp: PowerUpType | null): GameModifiers {
    const modifiers = this.getDefaultModifiers();

    if (!powerUp) {
      return modifiers;
    }

    switch (powerUp) {
      case 'SCROLL':
        modifiers.allowUnlimitedTiles = true;
        break;
      case 'HEADSTONE':
        modifiers.guaranteedVowelSwap = true;
        break;
      case 'WILTED_ROSE':
        modifiers.swapWithOpponent = true;
        break;
      case 'CRESCENT_MOON':
        modifiers.addBlankTile = true;
        break;
    }

    return modifiers;
  }

  static validateTileUsage(
    player: Player,
    pendingTiles: PlacedTile[],
    allowUnlimitedTiles: boolean = false
  ): { isValid: boolean; errors: string[] } {
    if (allowUnlimitedTiles) {
      // With unlimited tiles power-up, any tile usage is valid
      return { isValid: true, errors: [] };
    }

    // Count how many times each tile ID is used
    const tileUsageCount = new Map<string, number>();
    pendingTiles.forEach(pt => {
      const currentCount = tileUsageCount.get(pt.tile.id) || 0;
      tileUsageCount.set(pt.tile.id, currentCount + 1);
    });

    // Check if player has enough of each tile
    const errors: string[] = [];
    for (const [tileId, usageCount] of tileUsageCount) {
      const playerTileCount = player.tiles.filter(t => t.id === tileId).length;
      if (usageCount > playerTileCount) {
        const tile = player.tiles.find(t => t.id === tileId);
        const letter = tile?.letter || 'Unknown';
        errors.push(`Cannot use tile '${letter}' ${usageCount} times - you only have ${playerTileCount}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static collectPowerUpFromBoard(
    player: Player,
    powerUp: PowerUp
  ): Player {
    // Create a power-up tile
    const powerUpTile: Tile = {
      id: `powerup-tile-${powerUp.id}`,
      letter: powerUp.emoji,
      value: 0,
      isPowerUp: true,
      powerUpType: powerUp.type,
      emoji: powerUp.emoji
    };

    return {
      ...player,
      tiles: [...player.tiles, powerUpTile]
    };
  }

  static activatePowerUp(
    player: Player,
    powerUpId: string
  ): { success: boolean; updatedPlayer: Player; error?: string } {
    const powerUpIndex = player.activePowerUps.findIndex(pu => pu.id === powerUpId);
    
    if (powerUpIndex === -1) {
      return {
        success: false,
        updatedPlayer: player,
        error: 'Power-up not found in player inventory'
      };
    }

    if (player.activePowerUpForTurn !== null) {
      return {
        success: false,
        updatedPlayer: player,
        error: 'A power-up is already active for this turn'
      };
    }

    const powerUp = player.activePowerUps[powerUpIndex];
    const updatedActivePowerUps = player.activePowerUps.filter((_, index) => index !== powerUpIndex);

    return {
      success: true,
      updatedPlayer: {
        ...player,
        activePowerUps: updatedActivePowerUps,
        activePowerUpForTurn: powerUp
      }
    };
  }

  static activatePowerUpTile(
    player: Player,
    tileId: string
  ): { success: boolean; updatedPlayer: Player; error?: string } {
    const tileIndex = player.tiles.findIndex(t => t.id === tileId && t.isPowerUp);
    
    if (tileIndex === -1) {
      return {
        success: false,
        updatedPlayer: player,
        error: 'Power-up tile not found in player tiles'
      };
    }

    if (player.activePowerUpForTurn !== null) {
      return {
        success: false,
        updatedPlayer: player,
        error: 'A power-up is already active for this turn'
      };
    }

    const powerUpTile = player.tiles[tileIndex];
    const updatedTiles = player.tiles.filter((_, index) => index !== tileIndex);

    // Create a PowerUp object from the tile for the activePowerUpForTurn
    const powerUp: PowerUp = {
      id: powerUpTile.id,
      type: powerUpTile.powerUpType!,
      emoji: powerUpTile.emoji!,
      name: this.getPowerUpName(powerUpTile.powerUpType!),
      description: this.getPowerUpDescription(powerUpTile.powerUpType!)
    };

    return {
      success: true,
      updatedPlayer: {
        ...player,
        tiles: updatedTiles,
        activePowerUpForTurn: powerUp
      }
    };
  }

  static getPowerUpName(type: PowerUpType): string {
    switch (type) {
      case 'SCROLL':
        return 'Scroll';
      case 'HEADSTONE':
        return 'Headstone';
      case 'WILTED_ROSE':
        return 'Wilted Rose';
      case 'CRESCENT_MOON':
        return 'Crescent Moon';
      default:
        return 'Unknown';
    }
  }

  static getPowerUpDescription(type: PowerUpType): string {
    switch (type) {
      case 'SCROLL':
        return 'Place a letter tile any number of times on the board, all letters in your possession can be used multiple times for that turn regardless of how many of that letter you actually have';
      case 'HEADSTONE':
        return 'Swap all 7 of your tiles for a new set, guaranteed to contain at least two vowels. (consumed on use)';
      case 'WILTED_ROSE':
        return 'Swaps you and your opponents\' tiles.';
      case 'CRESCENT_MOON':
        return 'Adds an extra blank tile to your rack.';
      default:
        return 'Unknown power-up';
    }
  }

  static clearActivePowerUp(player: Player): Player {
    return {
      ...player,
      activePowerUpForTurn: null
    };
  }

  static applyScoreModifier(baseScore: number, scoreMultiplier: number): number {
    return Math.floor(baseScore * scoreMultiplier);
  }

  // New methods for complex powerup effects
  static swapPlayerTiles(currentPlayer: Player, tileBag: Tile[]): {
    updatedPlayer: Player;
    updatedBag: Tile[];
  } {
    // Add current player's tiles back to bag
    const newBag = [...tileBag, ...currentPlayer.tiles];
    
    // Shuffle the bag
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }

    // Draw 7 new tiles
    const newTiles = newBag.slice(0, 7);
    const remainingBag = newBag.slice(7);

    return {
      updatedPlayer: {
        ...currentPlayer,
        tiles: newTiles
      },
      updatedBag: remainingBag
    };
  }

  static swapTilesWithOpponent(player1: Player, player2: Player): {
    updatedPlayer1: Player;
    updatedPlayer2: Player;
  } {
    return {
      updatedPlayer1: {
        ...player1,
        tiles: player2.tiles
      },
      updatedPlayer2: {
        ...player2,
        tiles: player1.tiles
      }
    };
  }

  static addBlankTileToRack(player: Player): Player {
    // Create a new blank tile
    const blankTile: Tile = {
      id: `blank-tile-${Date.now()}-${Math.random()}`,
      letter: '?',
      value: 0,
      isBlank: true
    };

    return {
      ...player,
      tiles: [...player.tiles, blankTile]
    };
  }

  static guaranteeVowelsInDraw(tiles: Tile[], tileBag: Tile[]): {
    finalTiles: Tile[];
    updatedBag: Tile[];
  } {
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const vowelTiles = tileBag.filter(tile => vowels.includes(tile.letter));
    const nonVowelTiles = tileBag.filter(tile => !vowels.includes(tile.letter));
    
    // Count vowels in current tiles
    const currentVowelCount = tiles.filter(tile => vowels.includes(tile.letter)).length;
    const vowelsNeeded = Math.max(0, 2 - currentVowelCount);
    
    if (vowelsNeeded === 0 || vowelTiles.length === 0) {
      // Already have enough vowels or no vowels available
      return {
        finalTiles: tiles,
        updatedBag: tileBag
      };
    }

    // Take required vowels from bag
    const guaranteedVowels = vowelTiles.slice(0, Math.min(vowelsNeeded, vowelTiles.length));
    const remainingVowels = vowelTiles.slice(guaranteedVowels.length);
    
    // Remove non-vowels from tiles to make room for guaranteed vowels
    const nonVowelsInTiles = tiles.filter(tile => !vowels.includes(tile.letter));
    
    const tilesToRemove = nonVowelsInTiles.slice(0, guaranteedVowels.length);
    const tilesToKeep = tiles.filter(tile => !tilesToRemove.includes(tile));
    
    // Create final tile set
    const finalTiles = [...tilesToKeep, ...guaranteedVowels];
    
    // Update bag
    const updatedBag = [...remainingVowels, ...nonVowelTiles, ...tilesToRemove];
    
    // Shuffle the updated bag
    for (let i = updatedBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [updatedBag[i], updatedBag[j]] = [updatedBag[j], updatedBag[i]];
    }

    return {
      finalTiles,
      updatedBag
    };
  }
}

export const powerUpManager = new PowerUpManager();
