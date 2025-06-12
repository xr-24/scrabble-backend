import type { GameState, Player, Tile, PlacedTile, MoveHistoryEntry, PowerUp } from '../types/game';
import { createEmptyBoard } from '../constants/board';
import { createTileBag, drawTiles, TILES_PER_PLAYER } from '../constants/tiles';
import { moveManager, type MoveResult } from './moveManager';
import { PowerUpManager } from './PowerUpManager';

export class GameService {
  private games: Map<string, GameState> = new Map();
  private pendingTiles: Map<string, PlacedTile[]> = new Map();

  initializeGame(gameId: string, playerNames: string[]): GameState {
    console.log('Initializing game with players:', playerNames);
    let tileBag = createTileBag();
    const players: Player[] = playerNames.map((name, index) => {
      const { drawnTiles, remainingBag } = drawTiles(tileBag, TILES_PER_PLAYER);
      tileBag = remainingBag;
      return {
        id: `player-${index}`,
        name,
        tiles: drawnTiles,
        score: 0,
        hasEndedGame: false,
        activePowerUps: [],
        activePowerUpForTurn: null,
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

  addPendingTile(gameId: string, tile: Tile, row: number, col: number): boolean {
    const gameState = this.games.get(gameId);
    const pendingTiles = this.pendingTiles.get(gameId);
    
    if (!gameState || !pendingTiles) {
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
    const gameState = this.games.get(gameId);
    const pendingTiles = this.pendingTiles.get(gameId);
    
    if (!gameState || !pendingTiles) {
      return { success: false, errors: ['Game not found'] };
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== playerId || pendingTiles.length === 0) {
      return { success: false, errors: ['Invalid move attempt'] };
    }

    const moveResult = await moveManager.executeMove(gameState.board, currentPlayer, pendingTiles);

    if (moveResult.isValid && moveResult.score) {
      const newBoard = moveManager.commitMove(gameState.board, pendingTiles);
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

      // Add move to history
      const words = moveResult.validation.words.map(w => w.word);
      this.addMoveToHistory(
        gameId,
        currentPlayer.id,
        currentPlayer.name,
        'WORD',
        words,
        moveResult.score.totalScore
      );

      // Update game state
      const updatedGameState: GameState = {
        ...gameState,
        board: newBoard,
        players: updatedPlayers,
        tileBag: remainingBag,
      };

      this.games.set(gameId, updatedGameState);
      this.pendingTiles.set(gameId, []);

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
      return { success: false, errors: ['Cannot exchange tiles you do not have'] };
    }

    // Remove tiles from player and add them back to bag
    const tilesToExchange = currentPlayer.tiles.filter(t => tileIds.includes(t.id));
    const remainingTiles = currentPlayer.tiles.filter(t => !tileIds.includes(t.id));
    
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

    // Add exchange to history
    this.addMoveToHistory(
      gameId,
      currentPlayer.id,
      currentPlayer.name,
      'EXCHANGE',
      [],
      0
    );

    const updatedGameState: GameState = {
      ...gameState,
      players: updatedPlayers,
      tileBag: remainingBag,
    };

    this.games.set(gameId, updatedGameState);
    this.pendingTiles.set(gameId, []);

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

    // Add pass to history
    this.addMoveToHistory(
      gameId,
      currentPlayer.id,
      currentPlayer.name,
      'PASS',
      [],
      0
    );

    this.pendingTiles.set(gameId, []);

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

  // Clean up finished games
  removeGame(gameId: string): void {
    this.games.delete(gameId);
    this.pendingTiles.delete(gameId);
  }
}

export const gameService = new GameService();
