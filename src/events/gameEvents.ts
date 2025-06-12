import { Socket, Server } from 'socket.io';
import { roomManager } from '../services/RoomManager';
import { gameService } from '../services/GameService';
import type { Tile } from '../types/game';

export function registerGameEvents(socket: Socket, io: Server) {
  // Helper function to get player's room and validate game state
  function getPlayerGameContext(socketId: string) {
    const playerInRoom = roomManager.getPlayerInRoom(socketId);
    if (!playerInRoom || !playerInRoom.room.isStarted) {
      return null;
    }
    
    const gameState = gameService.getGameState(playerInRoom.room.id);
    if (!gameState) {
      return null;
    }
    
    return {
      room: playerInRoom.room,
      player: playerInRoom.player,
      gameState,
      roomId: playerInRoom.room.id
    };
  }

  // Helper function to broadcast game state to all players in room
  function broadcastGameState(roomId: string) {
    const gameState = gameService.getGameState(roomId);
    const pendingTiles = gameService.getPendingTiles(roomId);
    
    if (gameState) {
      io.to(roomId).emit('game-state-updated', {
        gameState,
        pendingTiles
      });
    }
  }

  // Place a tile on the board
  socket.on('place-tile', (data: { tile: Tile; row: number; col: number }) => {
    console.log('Place tile request:', data);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('place-tile-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('place-tile-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    const success = gameService.addPendingTile(context.roomId, data.tile, data.row, data.col);
    
    if (success) {
      socket.emit('place-tile-response', {
        success: true
      });
      
      // Broadcast updated pending tiles to all players
      broadcastGameState(context.roomId);
    } else {
      socket.emit('place-tile-response', {
        success: false,
        error: 'Cannot place tile at that position'
      });
    }
  });

  // Remove a tile from the board
  socket.on('remove-tile', (data: { row: number; col: number }) => {
    console.log('Remove tile request:', data);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('remove-tile-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('remove-tile-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    const removedTile = gameService.removePendingTile(context.roomId, data.row, data.col);
    
    socket.emit('remove-tile-response', {
      success: true,
      removedTile
    });
    
    // Broadcast updated pending tiles to all players
    broadcastGameState(context.roomId);
  });

  // Commit the current move
  socket.on('commit-move', async () => {
    console.log('Commit move request from:', socket.id);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('commit-move-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('commit-move-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    try {
      const result = await gameService.commitMove(context.roomId, context.player.id);
      
      socket.emit('commit-move-response', {
        success: result.success,
        errors: result.errors,
        moveResult: result.moveResult
      });
      
      if (result.success) {
        // Broadcast updated game state to all players
        broadcastGameState(context.roomId);
        
        // Notify all players about the successful move
        io.to(context.roomId).emit('move-committed', {
          playerId: context.player.id,
          playerName: context.player.name,
          moveResult: result.moveResult
        });
      }
    } catch (error) {
      console.error('Error committing move:', error);
      socket.emit('commit-move-response', {
        success: false,
        errors: ['An error occurred while processing the move']
      });
    }
  });

  // Exchange tiles
  socket.on('exchange-tiles', (data: { tileIds: string[] }) => {
    console.log('Exchange tiles request:', data);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('exchange-tiles-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('exchange-tiles-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    const result = gameService.exchangeTiles(context.roomId, context.player.id, data.tileIds);
    
    socket.emit('exchange-tiles-response', {
      success: result.success,
      errors: result.errors
    });
    
    if (result.success) {
      // Broadcast updated game state to all players
      broadcastGameState(context.roomId);
      
      // Notify all players about the exchange
      io.to(context.roomId).emit('tiles-exchanged', {
        playerId: context.player.id,
        playerName: context.player.name,
        tilesCount: data.tileIds.length
      });
    }
  });

  // Pass turn
  socket.on('pass-turn', () => {
    console.log('Pass turn request from:', socket.id);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('pass-turn-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('pass-turn-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    const result = gameService.passTurn(context.roomId, context.player.id);
    
    socket.emit('pass-turn-response', {
      success: result.success,
      errors: result.errors
    });
    
    if (result.success) {
      // Broadcast updated game state to all players
      broadcastGameState(context.roomId);
      
      // Notify all players about the pass
      io.to(context.roomId).emit('turn-passed', {
        playerId: context.player.id,
        playerName: context.player.name
      });
    }
  });

  // End game
  socket.on('end-game', () => {
    console.log('End game request from:', socket.id);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('end-game-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    const result = gameService.endGame(context.roomId, context.player.id);
    
    socket.emit('end-game-response', {
      success: result.success,
      errors: result.errors
    });
    
    if (result.success) {
      // Broadcast updated game state to all players
      broadcastGameState(context.roomId);
      
      // Notify all players that someone ended their game
      io.to(context.roomId).emit('player-ended-game', {
        playerId: context.player.id,
        playerName: context.player.name
      });
    }
  });

  // Activate power-up
  socket.on('activate-powerup', (data: { powerUpId: string }) => {
    console.log('Activate power-up request:', data);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('activate-powerup-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    const result = gameService.activatePowerUp(context.roomId, context.player.id, data.powerUpId);
    
    socket.emit('activate-powerup-response', {
      success: result.success,
      errors: result.errors
    });
    
    if (result.success) {
      // Broadcast updated game state to all players
      broadcastGameState(context.roomId);
      
      // Notify all players about the power-up activation
      io.to(context.roomId).emit('powerup-activated', {
        playerId: context.player.id,
        playerName: context.player.name,
        powerUpId: data.powerUpId
      });
    }
  });

  // Activate power-up tile
  socket.on('activate-powerup-tile', (data: { tileId: string }) => {
    console.log('Activate power-up tile request:', data);
    
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('activate-powerup-tile-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    const result = gameService.activatePowerUpTile(context.roomId, context.player.id, data.tileId);
    
    socket.emit('activate-powerup-tile-response', {
      success: result.success,
      errors: result.errors
    });
    
    if (result.success) {
      // Broadcast updated game state to all players
      broadcastGameState(context.roomId);
      
      // Notify all players about the power-up tile activation
      io.to(context.roomId).emit('powerup-tile-activated', {
        playerId: context.player.id,
        playerName: context.player.name,
        tileId: data.tileId
      });
    }
  });

  // Get current game state
  socket.on('get-game-state', () => {
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('game-state-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    const pendingTiles = gameService.getPendingTiles(context.roomId);
    
    socket.emit('game-state-response', {
      success: true,
      gameState: context.gameState,
      pendingTiles
    });
  });

  // Clear pending move
  socket.on('clear-pending-move', () => {
    const context = getPlayerGameContext(socket.id);
    if (!context) {
      socket.emit('clear-pending-move-response', {
        success: false,
        error: 'Not in an active game'
      });
      return;
    }

    // Check if it's the player's turn
    const currentPlayer = context.gameState.players[context.gameState.currentPlayerIndex];
    if (currentPlayer.id !== context.player.id) {
      socket.emit('clear-pending-move-response', {
        success: false,
        error: 'Not your turn'
      });
      return;
    }

    gameService.clearPendingMove(context.roomId);
    
    socket.emit('clear-pending-move-response', {
      success: true
    });
    
    // Broadcast updated pending tiles to all players
    broadcastGameState(context.roomId);
  });
}
