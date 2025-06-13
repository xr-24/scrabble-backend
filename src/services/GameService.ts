import type { GameState, Player, Tile, PlacedTile, MoveHistoryEntry, PowerUp } from '../types/game';
import { createEmptyBoard } from '../constants/board';
import { createTileBag, drawTiles, TILES_PER_PLAYER } from '../constants/tiles';
import { moveManager, type MoveResult } from './moveManager';
import { PowerUpManager } from './PowerUpManager';

export class GameService {
  private games: Map<string, GameState> = new Map();
  private pendingTiles: Map<string, PlacedTile[]> = new Map();

  initializeGame(gameId: string, roomPlayers: Array<{id: string, name: string, color?: string}>): GameState {
    console.log('Initializing game with players:', roomPlayers);
    let tileBag = createTileBag();
    const players: Player[] = roomPlayers.map((roomPlayer) => {
      const { drawnTiles, remainingBag } = drawTiles(tileBag, TILES_PER_PLAYER);
      tileBag = remainingBag;
      return {
        id: roomPlayer.id,
        name: roomPlayer.name,
        tiles: drawnTiles,
        score: 0,
        hasEndedGame: false,
        activePowerUps: [],
        activePowerUpForTurn: null,
        tileColor: roomPlayer.color,
      };
    });

    const gameState: GameState = {
      board: createEmptyBoard(),
      players,
      currentPlayerIndex: 0,
      tileBag,
      gamePhase: 'PLAYING',
      turnNumber: 1,
      playersEndedGame: [],
      moveHistory: [],
    };

    this.games.set(gameId, gameState);
    this.pendingTiles.set(gameId, []);
    console.log('Game initialized successfully');
    return gameState;
  }

  getGameState(gameId: string): GameState | null {
    return this.games.get(gameId) || null;
  }

  getPendingTiles(gameId: string): PlacedTile[] {
    return this.pendingTiles.get(gameId) || [];
  }

  // Server-side validation for tile ownership
  private validateTileOwnership(playerId: string, tile: Tile, gameState: GameState): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      console.warn(`Player ${playerId} not found in game state`);
      return false;
    }
    
    // For power-up tiles, check if player has the specific power-up tile
    if (tile.isPowerUp) {
      const hasPowerUpTile = player.tiles.some(t => 
        t.id === tile.id && 
        t.isPowerUp && 
        t.powerUpType === tile.powerUpType
      );
      if (!hasPowerUpTile) {
        console.warn(`Player ${playerId} doesn't own power-up tile:`, tile);
        return false;
      }
      return true;
    }
    
    // For regular tiles, check exact match
    const ownsTile = player.tiles.some(t => 
      t.id === tile.id && 
      t.letter === tile.letter && 
      t.value === tile.value &&
      t.isBlank === tile.isBlank
    );
    
    if (!ownsTile) {
      console.warn(`Player ${playerId} doesn't own tile:`, tile);
      console.warn(`Player tiles:`, player.tiles.map(t => ({ id: t.id, letter: t.letter, value: t.value })));
    }
    
    return ownsTile;
  }

  // Validate that all pending tiles are owned by the player
  private validateAllPendingTilesOwnership(playerId: string, gameState: GameState, pendingTiles: PlacedTile[]): boolean {
    for (const placedTile of pendingTiles) {
      if (!this.validateTileOwnership(playerId, placedTile.tile, gameState)) {
        return false;
      }
    }
    return true;
  }

  addPendingTile(gameId: string, tile: Tile, row: number, col: number): boolean {
    const gameState = this.games.get(gameId);
    const pendingTiles = this.pendingTiles.get(gameId);
    
    if (!gameState || !pendingTiles) {
      return false;
    }

    // Get current player
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer) {
      console.warn('No current player found');
      return false;
    }

    // Validate tile ownership before adding to pending
    if (!this.validateTileOwnership(currentPlayer.id, tile, gameState)) {
      console.warn('Tile ownership validation failed for addPendingTile');
      return false;
    }

    const { success, newPendingTiles } = moveManager.addTile(tile, row, col, gameState.board, pendingTiles);
    if (success) {
      this.pendingTiles.set(gameId, newPendingTiles);
      return true;
    }
    return false;
  }

  removePendingTile(gameId: string, row: number, col: number): Tile | null {
    const pendingTiles = this.pendingTiles.get(gameId);
    
    if (!pendingTiles) {
      return null;
    }

    const { removedTile, newPendingTiles } = moveManager.removeTile(row, col, pendingTiles);
    this.pendingTiles.set(gameId, newPendingTiles);
    return removedTile;
  }

  clearPendingMove(gameId: string): void {
    this.pendingTiles.set(gameId, []);
  }

  async commitMove(gameId: string, playerId: string): Promise<{ success: boolean; errors: string[]; moveResult?: MoveResult }> {
    console.log('CommitMove called:', { gameId, playerId });
    const gameState = this.games.get(gameId);
    const pendingTiles = this.pendingTiles.get(gameId);
    
    console.log('Game state exists:', !!gameState);
    console.log('Pending tiles:', pendingTiles);
    
    if (!gameState || !pendingTiles) {
      console.log('Game or pending tiles not found');
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log('Current player:', currentPlayer?.id, 'Requested player:', playerId);
    console.log('Current player index:', gameState.currentPlayerIndex);
    console.log('Pending tiles length:', pendingTiles.length);
    
    if (!currentPlayer) {
      return { success: false, errors: ['No current player found'] };
    }
    
    if (currentPlayer.id !== playerId) {
      return { success: false, errors: ['Not your turn'] };
    }
    
    if (pendingTiles.length === 0) {
      return { success: false, errors: ['No tiles placed'] };
    }

    // Critical security check: validate all pending tiles are owned by the player
    if (!this.validateAllPendingTilesOwnership(playerId, gameState, pendingTiles)) {
      console.error(`SECURITY ALERT: Player ${playerId} attempted to commit move with tiles they don't own`);
      return { success: false, errors: ['Invalid tile ownership'] };
    }

    const moveResult = await moveManager.executeMove(gameState.board, currentPlayer, pendingTiles);

    if (moveResult.isValid && moveResult.score) {
      // Stamp tiles with player ID before committing to board
      const tilesWithOwnership = pendingTiles.map(placedTile => ({
        ...placedTile,
        tile: {
          ...placedTile.tile,
          placedByPlayerId: currentPlayer.id
        }
      }));
      
      const newBoard = moveManager.commitMove(gameState.board, tilesWithOwnership);
      const remainingTiles = moveManager.removeTilesFromPlayer(currentPlayer, pendingTiles);
      
      const tilesNeeded = TILES_PER_PLAYER - remainingTiles.length;
      const { drawnTiles, remainingBag } = drawTiles(gameState.tileBag, Math.min(tilesNeeded, gameState.tileBag.length));

      // Collect power-ups and clear active power-up for turn
      let updatedPlayer: Player = {
        ...currentPlayer,
        tiles: [...remainingTiles, ...drawnTiles],
        score: currentPlayer.score + (moveResult.score?.totalScore ?? 0),
        activePowerUpForTurn: null, // Clear active power-up after move
      };

      // Add collected power-ups to player's inventory
      if (moveResult.collectedPowerUps && moveResult.collectedPowerUps.length > 0) {
        moveResult.collectedPowerUps.forEach(powerUp => {
          updatedPlayer = PowerUpManager.collectPowerUpFromBoard(updatedPlayer, powerUp);
        });
      }

      const updatedPlayers = gameState.players.map(p =>
        p.id === currentPlayer.id ? updatedPlayer : p
      );

      // Update game state first
      const updatedGameState: GameState = {
        ...gameState,
        board: newBoard,
        players: updatedPlayers,
        tileBag: remainingBag,
      };

      this.games.set(gameId, updatedGameState);
      this.pendingTiles.set(gameId, []);

      // Add move to history after updating game state
      const words = moveResult.validation.words.map(w => w.word);
      this.addMoveToHistory(
        gameId,
        currentPlayer.id,
        currentPlayer.name,
        'WORD',
        words,
        moveResult.score.totalScore
      );

      // Check if we should skip turn advancement (EXTRA_TURN power-up)
      if (!moveResult.modifiers?.skipTurnAdvancement) {
        this.nextTurn(gameId);
      }

      return { success: true, errors: [], moveResult };
    } else {
      return { success: false, errors: moveResult.errors, moveResult };
    }
  }

  previewBoard(gameId: string): any[][] | null {
    const gameState = this.games.get(gameId);
    const pendingTiles = this.pendingTiles.get(gameId);
    
    if (!gameState || !pendingTiles) {
      return null;
    }

    return moveManager.previewMove(gameState.board, pendingTiles);
  }

  nextTurn(gameId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    let nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    
    // Skip players who have ended their game
    let attempts = 0;
    while (gameState.players[nextPlayerIndex]?.hasEndedGame && attempts < gameState.players.length) {
      nextPlayerIndex = (nextPlayerIndex + 1) % gameState.players.length;
      attempts++;
    }
    
    // If all players have ended the game, don't change turn
    if (attempts >= gameState.players.length) {
      this.checkGameEnd(gameId);
      return;
    }

    const nextTurnNumber = nextPlayerIndex < gameState.currentPlayerIndex ? 
      gameState.turnNumber + 1 : gameState.turnNumber;

    const updatedGameState: GameState = {
      ...gameState,
      currentPlayerIndex: nextPlayerIndex,
      turnNumber: nextTurnNumber,
    };

    this.games.set(gameId, updatedGameState);
  }

  exchangeTiles(gameId: string, playerId: string, tileIds: string[]): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasEndedGame || tileIds.length === 0) {
      return { success: false, errors: ['Invalid exchange attempt'] };
    }

    // Validate player has all the tiles they want to exchange
    const playerTileIds = currentPlayer.tiles.map(t => t.id);
    const invalidTiles = tileIds.filter(id => !playerTileIds.includes(id));
    if (invalidTiles.length > 0) {
      console.warn(`Player ${playerId} attempted to exchange tiles they don't own:`, invalidTiles);
      return { success: false, errors: ['Cannot exchange tiles you do not have'] };
    }

    // Additional validation: ensure no duplicate tile IDs
    const uniqueTileIds = new Set(tileIds);
    if (uniqueTileIds.size !== tileIds.length) {
      return { success: false, errors: ['Duplicate tiles in exchange request'] };
    }

    // Remove tiles from player and add them back to bag
    const tilesToExchange = currentPlayer.tiles.filter(t => tileIds.includes(t.id));
    const remainingTiles = currentPlayer.tiles.filter(t => !tileIds.includes(t.id));
    
    // Validate that we found all tiles to exchange
    if (tilesToExchange.length !== tileIds.length) {
      console.warn(`Player ${playerId} exchange validation failed: found ${tilesToExchange.length} tiles, expected ${tileIds.length}`);
      return { success: false, errors: ['Some tiles could not be found for exchange'] };
    }
    
    // Add exchanged tiles back to bag and shuffle
    const newBag = [...gameState.tileBag, ...tilesToExchange];
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }

    // Draw new tiles
    const { drawnTiles, remainingBag } = drawTiles(newBag, Math.min(tileIds.length, newBag.length));

    const updatedPlayers = gameState.players.map(p =>
      p.id === currentPlayer.id
        ? { ...p, tiles: [...remainingTiles, ...drawnTiles] }
        : p
    );

    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
      tileBag: remainingBag,
    };

    this.games.set(gameId, updatedGameState);
    this.pendingTiles.set(gameId, []);

    // Add exchange to history after updating game state
    this.addMoveToHistory(
      gameId,
      currentPlayer.id,
      currentPlayer.name,
      'EXCHANGE',
      [],
      0
    );

    // Move to next turn
    this.nextTurn(gameId);

    return { success: true, errors: [] };
  }

  passTurn(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId || currentPlayer.hasEndedGame) {
      return { success: false, errors: ['Invalid pass attempt'] };
    }

    this.pendingTiles.set(gameId, []);

    // Add pass to history after clearing pending tiles
    this.addMoveToHistory(
      gameId,
      currentPlayer.id,
      currentPlayer.name,
      'PASS',
      [],
      0
    );

    // Move to next turn
    this.nextTurn(gameId);

    return { success: true, errors: [] };
  }

  endGame(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }
    
    if (gameState.playersEndedGame.includes(playerId)) {
      return { success: false, errors: ['Player already ended game'] };
    }

    // Validate that the player actually exists in the game
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found in game'] };
    }

    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? { ...p, hasEndedGame: true } : p
    );

    const newPlayersEndedGame = [...gameState.playersEndedGame, playerId];

    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
      playersEndedGame: newPlayersEndedGame,
    };

    this.games.set(gameId, updatedGameState);
    this.pendingTiles.set(gameId, []);

    // Check if all players have ended the game
    this.checkGameEnd(gameId);
    
    // If the current player ended their game, move to next turn
    if (gameState.players[gameState.currentPlayerIndex]?.id === playerId) {
      this.nextTurn(gameId);
    }

    return { success: true, errors: [] };
  }

  hasPlayerEndedGame(gameId: string, playerId: string): boolean {
    const gameState = this.games.get(gameId);
    if (!gameState) return false;
    return gameState.playersEndedGame.includes(playerId);
  }

  getActivePlayers(gameId: string): Player[] {
    const gameState = this.games.get(gameId);
    if (!gameState) return [];
    return gameState.players.filter(p => !p.hasEndedGame);
  }

  checkGameEnd(gameId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;
    
    if (gameState.playersEndedGame.length === gameState.players.length) {
      // All players have ended the game - calculate final scores
      const finalPlayers = gameState.players.map(player => {
        const remainingTileValue = player.tiles.reduce((sum, tile) => sum + tile.value, 0);
        return {
          ...player,
          score: player.score - remainingTileValue
        };
      });

      const updatedGameState: GameState = {
        ...gameState,
        players: finalPlayers,
        gamePhase: 'FINISHED'
      };

      this.games.set(gameId, updatedGameState);
    }
  }

  addMoveToHistory(gameId: string, playerId: string, playerName: string, moveType: 'WORD' | 'EXCHANGE' | 'PASS', words?: string[], score?: number): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;
    
    const newEntry: MoveHistoryEntry = {
      playerId,
      playerName,
      turnNumber: gameState.turnNumber,
      moveType,
      words: words || [],
      score: score || 0,
      timestamp: new Date(),
    };

    const updatedGameState: GameState = {
      ...gameState,
      moveHistory: [...gameState.moveHistory, newEntry],
    };

    console.log('Adding move to history:', newEntry);
    console.log('Updated move history length:', updatedGameState.moveHistory.length);

    this.games.set(gameId, updatedGameState);
  }

  activatePowerUp(gameId: string, playerId: string, powerUpId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    // Validate that the player actually owns the power-up
    const powerUpExists = player.activePowerUps.some(pu => pu.id === powerUpId);
    if (!powerUpExists) {
      console.warn(`Player ${playerId} attempted to activate power-up they don't own: ${powerUpId}`);
      return { success: false, errors: ['Power-up not found in player inventory'] };
    }

    const result = PowerUpManager.activatePowerUp(player, powerUpId);
    
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? result.updatedPlayer : p
      );
      
      const updatedGameState: GameState = {
        ...gameState,
        players: updatedPlayers,
      };

      this.games.set(gameId, updatedGameState);
      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to activate power-up'] };
    }
  }

  activatePowerUpTile(gameId: string, playerId: string, tileId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    const powerUpTile = player.tiles.find(t => t.id === tileId && t.isPowerUp);
    if (!powerUpTile || !powerUpTile.powerUpType) {
      console.warn(`Player ${playerId} attempted to activate power-up tile they don't own: ${tileId}`);
      return { success: false, errors: ['Power-up tile not found'] };
    }

    const result = PowerUpManager.activatePowerUpTile(player, tileId);
    
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? result.updatedPlayer : p
      );
      
      let updatedGameState: GameState = {
        ...gameState,
        players: updatedPlayers,
      };

      this.games.set(gameId, updatedGameState);

      // Handle immediate effects for certain powerups
      switch (powerUpTile.powerUpType) {
        case 'HEADSTONE':
          this.executeHeadstoneSwap(gameId, playerId);
          break;
        case 'WILTED_ROSE':
          this.executeWiltedRoseSwap(gameId, playerId);
          break;
        case 'CRESCENT_MOON':
          this.executeCrescentMoon(gameId, playerId);
          break;
        case 'SCROLL':
          // SCROLL is handled as a turn modifier, no immediate effect needed
          break;
      }

      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to activate power-up tile'] };
    }
  }

  clearActivePowerUp(gameId: string, playerId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? PowerUpManager.clearActivePowerUp(p) : p
    );
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
    };

    this.games.set(gameId, updatedGameState);
  }

  executeHeadstoneSwap(gameId: string, playerId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const { updatedPlayer, updatedBag } = PowerUpManager.swapPlayerTiles(player, gameState.tileBag);
    const { finalTiles, updatedBag: finalBag } = PowerUpManager.guaranteeVowelsInDraw(updatedPlayer.tiles, updatedBag);
    
    const finalPlayer = {
      ...updatedPlayer,
      tiles: finalTiles
    };

    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? finalPlayer : p
    );
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
      tileBag: finalBag,
    };

    this.games.set(gameId, updatedGameState);
  }

  executeWiltedRoseSwap(gameId: string, playerId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    const currentPlayer = gameState.players.find(p => p.id === playerId);
    if (!currentPlayer) return;

    // Find other players who haven't ended their game
    const otherPlayers = gameState.players.filter(p => p.id !== playerId && !p.hasEndedGame);
    
    if (otherPlayers.length === 0) {
      return; // No opponents available
    }

    // Pick a random opponent
    const randomOpponent = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    
    const { updatedPlayer1, updatedPlayer2 } = PowerUpManager.swapTilesWithOpponent(currentPlayer, randomOpponent);
    
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === playerId) return updatedPlayer1;
      if (p.id === randomOpponent.id) return updatedPlayer2;
      return p;
    });
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
    };

    this.games.set(gameId, updatedGameState);
  }

  executeCrescentMoon(gameId: string, playerId: string): void {
    const gameState = this.games.get(gameId);
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const updatedPlayer = PowerUpManager.addBlankTileToRack(player);
    
    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? updatedPlayer : p
    );
    
    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
    };

    this.games.set(gameId, updatedGameState);
  }

  // Execute power-up with parameters
  executePowerUp(gameId: string, playerId: string, powerUpType: string, params: any): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    // Check if player has an active powerup of this type
    if (!player.activePowerUpForTurn || player.activePowerUpForTurn.type !== powerUpType) {
      return { success: false, errors: ['No active power-up of this type'] };
    }

    try {
      switch (powerUpType) {
        case 'BURN':
          return this.executeBurnPowerUp(gameId, playerId, params.targetTileIds);
        
        case 'TILE_THIEF':
          return this.executeTileThiefPowerUp(gameId, playerId, params.targetTileId);
        
        case 'MULTIPLIER_THIEF':
          return this.executeMultiplierThiefPowerUp(gameId, playerId, params.row, params.col);
        
        case 'DUPLICATE':
          return this.executeDuplicatePowerUp(gameId, playerId, params.sourceTileId);
        
        case 'TILE_FREEZE':
          return this.executeTileFreezePowerUp(gameId, playerId, params.row, params.col);
        
        case 'SILENCE':
          return this.executeSilencePowerUp(gameId, playerId);
        
        case 'EXTRA_TILES':
          return this.executeExtraTilesPowerUp(gameId, playerId);
        
        case 'EXTRA_TURN':
          return this.executeExtraTurnPowerUp(gameId, playerId);
        
        default:
          return { success: false, errors: ['Unknown power-up type'] };
      }
    } catch (error) {
      console.error('Error executing power-up:', error);
      return { success: false, errors: ['Failed to execute power-up'] };
    }
  }

  private executeBurnPowerUp(gameId: string, playerId: string, targetTileIds: string[]): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    // Find opponent (for now, assume 2-player game)
    const opponent = gameState.players.find(p => p.id !== playerId);
    if (!opponent) return { success: false, errors: ['No opponent found'] };

    const result = PowerUpManager.executeBurn(opponent, targetTileIds);
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === opponent.id ? result.updatedPlayer : p
      );
      
      this.games.set(gameId, { ...gameState, players: updatedPlayers });
      this.clearActivePowerUp(gameId, playerId);
      return { success: true, errors: [] };
    }
    
    return { success: false, errors: [result.error || 'Failed to execute burn'] };
  }

  private executeTileThiefPowerUp(gameId: string, playerId: string, targetTileId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    const currentPlayer = gameState.players.find(p => p.id === playerId);
    const opponent = gameState.players.find(p => p.id !== playerId);
    
    if (!currentPlayer || !opponent) {
      return { success: false, errors: ['Players not found'] };
    }

    const result = PowerUpManager.executeTileThief(currentPlayer, opponent, targetTileId);
    if (result.success) {
      const updatedPlayers = gameState.players.map(p => {
        if (p.id === playerId) return result.updatedCurrentPlayer;
        if (p.id === opponent.id) return result.updatedTargetPlayer;
        return p;
      });
      
      this.games.set(gameId, { ...gameState, players: updatedPlayers });
      this.clearActivePowerUp(gameId, playerId);
      return { success: true, errors: [] };
    }
    
    return { success: false, errors: [result.error || 'Failed to execute tile thief'] };
  }

  private executeMultiplierThiefPowerUp(gameId: string, playerId: string, row: number, col: number): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    // Validate board position
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return { success: false, errors: ['Invalid board position'] };
    }

    const cell = gameState.board[row][col];
    if (!cell.multiplier || (cell.multiplier !== 'DOUBLE_WORD' && cell.multiplier !== 'TRIPLE_WORD')) {
      return { success: false, errors: ['No word multiplier at this position'] };
    }

    // Store the stolen multiplier info (this would be used during scoring)
    // For now, just clear the multiplier from the board
    const updatedBoard = gameState.board.map((boardRow, r) =>
      boardRow.map((boardCell, c) => {
        if (r === row && c === col) {
          return { ...boardCell, multiplier: null };
        }
        return boardCell;
      })
    );

    this.games.set(gameId, { ...gameState, board: updatedBoard });
    this.clearActivePowerUp(gameId, playerId);
    return { success: true, errors: [] };
  }

  private executeDuplicatePowerUp(gameId: string, playerId: string, sourceTileId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, errors: ['Player not found'] };

    const result = PowerUpManager.executeDuplicate(player, sourceTileId);
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? result.updatedPlayer : p
      );
      
      this.games.set(gameId, { ...gameState, players: updatedPlayers });
      this.clearActivePowerUp(gameId, playerId);
      return { success: true, errors: [] };
    }
    
    return { success: false, errors: [result.error || 'Failed to execute duplicate'] };
  }

  private executeTileFreezePowerUp(gameId: string, playerId: string, row: number, col: number): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    // Validate board position
    if (row < 0 || row >= 15 || col < 0 || col >= 15) {
      return { success: false, errors: ['Invalid board position'] };
    }

    const cell = gameState.board[row][col];
    if (!cell.tile) {
      return { success: false, errors: ['No tile at this position to freeze'] };
    }

    // Mark tile as frozen (this would be used during move validation)
    // For now, we'll store this in game state metadata
    // In a full implementation, you'd add frozen tile tracking to the game state
    
    this.clearActivePowerUp(gameId, playerId);
    return { success: true, errors: [] };
  }

  private executeSilencePowerUp(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    // Find opponent
    const opponent = gameState.players.find(p => p.id !== playerId);
    if (!opponent) return { success: false, errors: ['No opponent found'] };

    const result = PowerUpManager.executeSilence(opponent);
    if (result.success) {
      // Store silenced tile IDs (this would be used during move validation)
      // For now, just clear the active powerup
      this.clearActivePowerUp(gameId, playerId);
      return { success: true, errors: [] };
    }
    
    return { success: false, errors: [result.error || 'Failed to execute silence'] };
  }

  private executeExtraTilesPowerUp(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) return { success: false, errors: ['Game not found'] };

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, errors: ['Player not found'] };

    const result = PowerUpManager.executeExtraTiles(player, gameState.tileBag);
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? result.updatedPlayer : p
      );
      
      this.games.set(gameId, { 
        ...gameState, 
        players: updatedPlayers,
        tileBag: result.updatedBag 
      });
      this.clearActivePowerUp(gameId, playerId);
      return { success: true, errors: [] };
    }
    
    return { success: false, errors: [result.error || 'Failed to execute extra tiles'] };
  }

  private executeExtraTurnPowerUp(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    // EXTRA_TURN is handled during move commit by checking skipTurnAdvancement
    // No immediate action needed here, just clear the active powerup
    this.clearActivePowerUp(gameId, playerId);
    return { success: true, errors: [] };
  }

  // Clean up finished games
  removeGame(gameId: string): void {
    this.games.delete(gameId);
    this.pendingTiles.delete(gameId);
  }
}

export const gameService = new GameService();
