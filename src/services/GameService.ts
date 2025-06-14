import type { GameState, Player, Tile, PlacedTile, MoveHistoryEntry, PowerUp } from '../types/game';
import { createEmptyBoard } from '../constants/board';
import { createTileBag, drawTiles, TILES_PER_PLAYER } from '../constants/tiles';
import { moveManager, type MoveResult } from './moveManager';
import { PowerUpManager } from './PowerUpManager';
import { quackleGaddagAIService } from './QuackleGADDAGAIService';

export class GameService {
  private games: Map<string, GameState> = new Map();
  private pendingTiles: Map<string, PlacedTile[]> = new Map();

  initializeGame(gameId: string, roomPlayers: Array<{id: string, name: string, color?: string, isAI?: boolean, aiPersonality?: string}>): GameState {
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
        tileColor: roomPlayer.color || '#404040',
        isAI: roomPlayer.isAI || false,
        aiPersonality: roomPlayer.aiPersonality,
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
    
    // Check if first player is AI and execute their move
    this.checkAndExecuteAITurn(gameId);
    
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
    
    // For blank tiles, check by ID and blank status (letter might have been changed to chosen letter)
    if (tile.isBlank) {
      const hasBlankTile = player.tiles.some(t => 
        t.id === tile.id && 
        t.isBlank === true
      );
      if (!hasBlankTile) {
        console.warn(`Player ${playerId} doesn't own blank tile:`, tile);
        console.warn(`Player tiles:`, player.tiles.map(t => ({ id: t.id, letter: t.letter, value: t.value, isBlank: t.isBlank })));
      }
      return hasBlankTile;
    }
    
    // Special case: if tile has chosenLetter property, it's a blank tile being used as a specific letter
    if (tile.chosenLetter) {
      const hasBlankTile = player.tiles.some(t => 
        t.id === tile.id && 
        t.isBlank === true
      );
      if (!hasBlankTile) {
        console.warn(`Player ${playerId} doesn't own blank tile for chosen letter:`, tile);
        console.warn(`Player tiles:`, player.tiles.map(t => ({ id: t.id, letter: t.letter, value: t.value, isBlank: t.isBlank })));
      }
      return hasBlankTile;
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
      console.warn(`Player tiles:`, player.tiles.map(t => ({ id: t.id, letter: t.letter, value: t.value, isBlank: t.isBlank })));
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

  nextTurn(gameId: string, io?: any): void {
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

    // Check if the next player is AI and execute their move
    this.checkAndExecuteAITurn(gameId, io);
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

  // AI Move Handling
  async executeAIMove(gameId: string): Promise<{ success: boolean; errors: string[] }> {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isAI) {
      return { success: false, errors: ['Current player is not an AI'] };
    }

    if (currentPlayer.hasEndedGame) {
      return { success: false, errors: ['AI player has ended the game'] };
    }

    try {
      console.log(`Executing AI move for ${currentPlayer.name}`);
      
      // Generate AI move using GADDAG
      const aiMove = await quackleGaddagAIService.generateMove(gameState, currentPlayer.id);
      
      switch (aiMove.type) {
        case 'WORD':
          if (aiMove.tiles && aiMove.tiles.length > 0) {
            return await this.executeAIWordMove(gameId, currentPlayer.id, aiMove.tiles);
          } else {
            console.warn(`AI ${currentPlayer.name} generated invalid word move`);
            return this.passTurn(gameId, currentPlayer.id);
          }
          
        case 'EXCHANGE':
          if (aiMove.exchangeTileIds && aiMove.exchangeTileIds.length > 0) {
            return this.exchangeTiles(gameId, currentPlayer.id, aiMove.exchangeTileIds);
          } else {
            console.warn(`AI ${currentPlayer.name} generated invalid exchange move`);
            return this.passTurn(gameId, currentPlayer.id);
          }
          
        case 'PASS':
        default:
          return this.passTurn(gameId, currentPlayer.id);
      }
    } catch (error) {
      console.error(`Error executing AI move for ${currentPlayer.name}:`, error);
      // Fallback to pass turn if AI move fails
      return this.passTurn(gameId, currentPlayer.id);
    }
  }

  private async executeAIWordMove(gameId: string, playerId: string, tiles: PlacedTile[]): Promise<{ success: boolean; errors: string[] }> {
    // Set the pending tiles for the AI
    this.pendingTiles.set(gameId, tiles);
    
    // Commit the move
    const result = await this.commitMove(gameId, playerId);
    
    if (!result.success) {
      // Clear pending tiles if move failed
      this.pendingTiles.set(gameId, []);
      console.warn(`AI move failed for player ${playerId}:`, result.errors);
    }
    
    return result;
  }

  // Check if current player is AI and execute move if needed
  async checkAndExecuteAITurn(gameId: string, io?: any): Promise<void> {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      console.log(`checkAndExecuteAITurn: Game ${gameId} not found`);
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    console.log(`checkAndExecuteAITurn: Current player is ${currentPlayer?.name} (AI: ${currentPlayer?.isAI}, hasEnded: ${currentPlayer?.hasEndedGame})`);
    
    if (currentPlayer && currentPlayer.isAI && !currentPlayer.hasEndedGame) {
      console.log(`Scheduling AI move for ${currentPlayer.name} in ${gameId}`);
      // Add a small delay to make AI moves feel more natural
      setTimeout(async () => {
        try {
          console.log(`Executing AI move for ${currentPlayer.name}`);
          const result = await this.executeAIMove(gameId);
          console.log(`AI move result for ${currentPlayer.name}:`, result);
          
          // Always broadcast game state update after AI move
          if (io) {
            this.broadcastGameState(gameId, io);
          }
          
          if (!result.success) {
            console.error(`AI move failed for ${currentPlayer.name}:`, result.errors);
            // If AI move fails, try to pass turn to prevent getting stuck
            console.log(`Attempting to pass turn for ${currentPlayer.name} after failed move`);
            const passResult = this.passTurn(gameId, currentPlayer.id);
            console.log(`Pass turn result for ${currentPlayer.name}:`, passResult);
            
            // Broadcast after pass turn too
            if (io) {
              this.broadcastGameState(gameId, io);
            }
          }
        } catch (error) {
          console.error(`Error in AI move execution for ${currentPlayer.name}:`, error);
          // Fallback: pass turn if AI completely fails
          try {
            console.log(`Emergency pass turn for ${currentPlayer.name} after error`);
            const passResult = this.passTurn(gameId, currentPlayer.id);
            console.log(`Emergency pass result for ${currentPlayer.name}:`, passResult);
            
            // Broadcast after emergency pass
            if (io) {
              this.broadcastGameState(gameId, io);
            }
          } catch (passError) {
            console.error(`Emergency pass also failed for ${currentPlayer.name}:`, passError);
          }
        }
      }, 1000 + Math.random() * 2000); // 1-3 second delay
    }
  }

  // Rest of the methods remain the same...
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
    
    if (otherPlayers.length === 0) return;

    // Pick a random other player
    const randomPlayer = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    
    // Swap tiles between current player and random player
    const { updatedPlayer1, updatedPlayer2 } = PowerUpManager.swapTilesWithOpponent(currentPlayer, randomPlayer);
    
    const updatedPlayers = gameState.players.map(p => {
      if (p.id === playerId) return updatedPlayer1;
      if (p.id === randomPlayer.id) return updatedPlayer2;
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

    // Add a blank tile to the player's rack
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

  executeBurn(gameId: string, playerId: string, targetTileIds: string[]): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    // Find target player (opponent)
    const targetPlayer = gameState.players.find(p => p.id !== playerId && !p.hasEndedGame);
    if (!targetPlayer) {
      return { success: false, errors: ['No valid target player found'] };
    }

    const result = PowerUpManager.executeBurn(targetPlayer, targetTileIds);
    
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === targetPlayer.id ? result.updatedPlayer : p
      );
      
      const updatedGameState: GameState = {
        ...gameState,
        players: updatedPlayers,
      };

      this.games.set(gameId, updatedGameState);
      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to execute burn'] };
    }
  }

  executeTileThief(gameId: string, playerId: string, targetPlayerId: string, targetTileId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players.find(p => p.id === playerId);
    const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
    
    if (!currentPlayer || !targetPlayer) {
      return { success: false, errors: ['Player not found'] };
    }

    const result = PowerUpManager.executeTileThief(currentPlayer, targetPlayer, targetTileId);
    
    if (result.success) {
      const updatedPlayers = gameState.players.map(p => {
        if (p.id === playerId) return result.updatedCurrentPlayer;
        if (p.id === targetPlayerId) return result.updatedTargetPlayer;
        return p;
      });
      
      const updatedGameState: GameState = {
        ...gameState,
        players: updatedPlayers,
      };

      this.games.set(gameId, updatedGameState);
      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to execute tile thief'] };
    }
  }

  executeDuplicate(gameId: string, playerId: string, sourceTileId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    const result = PowerUpManager.executeDuplicate(player, sourceTileId);
    
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
      return { success: false, errors: [result.error || 'Failed to execute duplicate'] };
    }
  }

  executeExtraTiles(gameId: string, playerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    const result = PowerUpManager.executeExtraTiles(player, gameState.tileBag);
    
    if (result.success) {
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? result.updatedPlayer : p
      );
      
      const updatedGameState: GameState = {
        ...gameState,
        players: updatedPlayers,
        tileBag: result.updatedBag,
      };

      this.games.set(gameId, updatedGameState);
      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to execute extra tiles'] };
    }
  }

  executeSilence(gameId: string, playerId: string, targetPlayerId: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const targetPlayer = gameState.players.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return { success: false, errors: ['Target player not found'] };
    }

    const result = PowerUpManager.executeSilence(targetPlayer);
    
    if (result.success) {
      // Store silenced tile IDs in game state (you might need to add this to GameState type)
      // For now, we'll just return success - the silencing effect would need to be tracked
      // in the game state and checked during tile placement validation
      
      console.log(`Silence powerup executed: silenced tiles ${result.silencedTileIds.join(', ')} for player ${targetPlayerId}`);
      return { success: true, errors: [] };
    } else {
      return { success: false, errors: [result.error || 'Failed to execute silence'] };
    }
  }

  executeTileFreeze(gameId: string, playerId: string, targetRow: number, targetCol: number): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    // Validate target position has a tile
    if (!gameState.board[targetRow] || !gameState.board[targetRow][targetCol] || !gameState.board[targetRow][targetCol].tile) {
      return { success: false, errors: ['No tile at target position'] };
    }

    // For now, just log the freeze effect - you'd need to track frozen tiles in game state
    console.log(`Tile freeze powerup executed: froze tile at position (${targetRow}, ${targetCol})`);
    return { success: true, errors: [] };
  }

  executeMultiplierThief(gameId: string, playerId: string, targetRow: number, targetCol: number): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    // Validate target position has a multiplier
    const targetCell = gameState.board[targetRow]?.[targetCol];
    if (!targetCell || (!targetCell.multiplier || targetCell.tile)) {
      return { success: false, errors: ['No available multiplier at target position'] };
    }

    // For now, just log the theft - you'd need to track stolen multipliers in game state
    console.log(`Multiplier thief powerup executed: stole ${targetCell.multiplier} multiplier from position (${targetRow}, ${targetCol})`);
    return { success: true, errors: [] };
  }

  executePowerUp(gameId: string, playerId: string, powerUpType: string, params: any): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found'] };
    }

    try {
      // Handle different power-up types
      switch (powerUpType) {
        case 'HEADSTONE':
          this.executeHeadstoneSwap(gameId, playerId);
          return { success: true, errors: [] };
          
        case 'WILTED_ROSE':
          this.executeWiltedRoseSwap(gameId, playerId);
          return { success: true, errors: [] };
          
        case 'CRESCENT_MOON':
          this.executeCrescentMoon(gameId, playerId);
          return { success: true, errors: [] };
          
        case 'BURN':
          return this.executeBurn(gameId, playerId, params.targetTileIds);
          
        case 'TILE_THIEF':
          return this.executeTileThief(gameId, playerId, params.targetPlayerId, params.targetTileId);
          
        case 'DUPLICATE':
          return this.executeDuplicate(gameId, playerId, params.sourceTileId);
          
        case 'EXTRA_TILES':
          return this.executeExtraTiles(gameId, playerId);
          
        case 'SILENCE':
          return this.executeSilence(gameId, playerId, params.targetPlayerId);
          
        case 'TILE_FREEZE':
          return this.executeTileFreeze(gameId, playerId, params.targetRow, params.targetCol);
          
        case 'MULTIPLIER_THIEF':
          return this.executeMultiplierThief(gameId, playerId, params.targetRow, params.targetCol);
          
        default:
          return { success: false, errors: [`Unknown power-up type: ${powerUpType}`] };
      }
    } catch (error) {
      console.error(`Error executing power-up ${powerUpType}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, errors: [`Failed to execute power-up: ${errorMessage}`] };
    }
  }

  // Broadcast game state to all players in room
  broadcastGameState(gameId: string, io: any): void {
    const gameState = this.getGameState(gameId);
    const pendingTiles = this.getPendingTiles(gameId);
    
    if (gameState && io) {
      console.log(`Broadcasting game state update for game ${gameId}`);
      io.to(gameId).emit('game-state-updated', {
        gameState,
        pendingTiles
      });
    }
  }

  // Remove a game from memory
  removeGame(gameId: string): void {
    this.games.delete(gameId);
    this.pendingTiles.delete(gameId);
    console.log(`Game ${gameId} removed from memory`);
  }

  // Update player color in game state
  updatePlayerColor(gameId: string, playerId: string, color: string): { success: boolean; errors: string[] } {
    const gameState = this.games.get(gameId);
    if (!gameState) {
      return { success: false, errors: ['Game not found'] };
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, errors: ['Player not found in game'] };
    }

    // Update player's tile color
    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? { ...p, tileColor: color } : p
    );

    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
    };

    this.games.set(gameId, updatedGameState);
    console.log(`Player ${playerId} color updated to ${color} in game ${gameId}`);
    
    return { success: true, errors: [] };
  }
}

// Export singleton instance
export const gameService = new GameService();
