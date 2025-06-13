import { Socket, Server } from 'socket.io';
import { roomManager } from '../services/RoomManager';
import { ValidationUtils, RateLimiter } from '../services/validation';
import type { CreateRoomRequest, JoinRoomRequest } from '../types/room';

export function registerRoomEvents(socket: Socket, io: Server) {
  // Create a new room
  socket.on('create-room', (data: CreateRoomRequest) => {
    try {
      // Rate limiting
      if (!RateLimiter.checkLimit(socket.id, 'create-room', 1, 10000)) { // 1 per 10 seconds
        socket.emit('room-created', {
          success: false,
          error: 'Please wait before creating another room'
        });
        return;
      }

      console.log('Create room request:', data);
      
      // Validate input
      if (!data || typeof data !== 'object') {
        socket.emit('room-created', {
          success: false,
          error: 'Invalid request data'
        });
        return;
      }

      const nameValidation = ValidationUtils.validatePlayerName(data.playerName);
      if (!nameValidation.isValid) {
        socket.emit('room-created', {
          success: false,
          error: nameValidation.errors[0] || 'Invalid player name'
        });
        return;
      }

      // Use sanitized name
      const sanitizedData: CreateRoomRequest = {
        playerName: nameValidation.sanitized
      };
      
      const result = roomManager.createRoom(socket.id, sanitizedData);
      
      if (result.success && result.room) {
        // Join the socket to the room
        socket.join(result.room.id);
        
        // Send success response to the creator
        socket.emit('room-created', {
          success: true,
          room: result.room
        });
        
        // Broadcast room update to all players in the room
        io.to(result.room.id).emit('room-updated', result.room);
        
        console.log(`Room ${result.room.code} created successfully`);
      } else {
        socket.emit('room-created', {
          success: false,
          error: result.error || 'Failed to create room'
        });
      }
    } catch (error) {
      console.error('Error in create-room:', error);
      socket.emit('room-created', {
        success: false,
        error: 'An error occurred while creating the room'
      });
    }
  });

  // Join an existing room
  socket.on('join-room', (data: JoinRoomRequest) => {
    try {
      // Rate limiting
      if (!RateLimiter.checkLimit(socket.id, 'join-room', 3, 10000)) { // 3 per 10 seconds
        socket.emit('room-joined', {
          success: false,
          error: 'Please wait before trying to join again'
        });
        return;
      }

      console.log('Join room request:', data);
      
      // Validate input
      if (!data || typeof data !== 'object') {
        socket.emit('room-joined', {
          success: false,
          error: 'Invalid request data'
        });
        return;
      }

      const nameValidation = ValidationUtils.validatePlayerName(data.playerName);
      const codeValidation = ValidationUtils.validateRoomCode(data.roomCode);

      if (!nameValidation.isValid) {
        socket.emit('room-joined', {
          success: false,
          error: nameValidation.errors[0] || 'Invalid player name'
        });
        return;
      }

      if (!codeValidation.isValid) {
        socket.emit('room-joined', {
          success: false,
          error: codeValidation.errors[0] || 'Invalid room code'
        });
        return;
      }

      // Use sanitized data
      const sanitizedData: JoinRoomRequest = {
        roomCode: codeValidation.sanitized,
        playerName: nameValidation.sanitized
      };
      
      const result = roomManager.joinRoom(socket.id, sanitizedData);
      
      if (result.success && result.room) {
        // Join the socket to the room
        socket.join(result.room.id);
        
        // Send success response to the joiner
        socket.emit('room-joined', {
          success: true,
          room: result.room
        });
        
        // Broadcast room update to all players in the room
        io.to(result.room.id).emit('room-updated', result.room);
        
        // Notify other players that someone joined
        socket.to(result.room.id).emit('player-joined', {
          playerName: sanitizedData.playerName,
          room: result.room
        });
        
        console.log(`Player ${sanitizedData.playerName} joined room ${sanitizedData.roomCode}`);
      } else {
        socket.emit('room-joined', {
          success: false,
          error: result.error || 'Failed to join room'
        });
      }
    } catch (error) {
      console.error('Error in join-room:', error);
      socket.emit('room-joined', {
        success: false,
        error: 'An error occurred while joining the room'
      });
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    try {
      console.log('Leave room request from:', socket.id);
      
      const result = roomManager.leaveRoom(socket.id);
      
      if (result.success && result.roomId) {
        // Leave the socket room
        socket.leave(result.roomId);
        
        // Send confirmation to the leaving player
        socket.emit('room-left', {
          success: true
        });
        
        // Get updated room info and broadcast to remaining players
        const roomInfo = roomManager.getRoomInfo(result.roomId);
        if (roomInfo) {
          io.to(result.roomId).emit('room-updated', roomInfo);
          
          // Notify remaining players that someone left
          socket.to(result.roomId).emit('player-left', {
            wasHost: result.wasHost,
            room: roomInfo
          });
        }
        
        console.log(`Player left room ${result.roomId}`);
      } else {
        socket.emit('room-left', {
          success: false,
          error: result.error || 'Failed to leave room'
        });
      }
    } catch (error) {
      console.error('Error in leave-room:', error);
      socket.emit('room-left', {
        success: false,
        error: 'An error occurred while leaving the room'
      });
    }
  });

  // Start game (host only)
  socket.on('start-game', () => {
    try {
      // Rate limiting
      if (!RateLimiter.checkLimit(socket.id, 'start-game', 1, 5000)) { // 1 per 5 seconds
        socket.emit('game-started', {
          success: false,
          error: 'Please wait before starting the game'
        });
        return;
      }

      console.log('Start game request from:', socket.id);
      
      const result = roomManager.startGame(socket.id);
      
      if (result.success && result.gameState) {
        const playerInRoom = roomManager.getPlayerInRoom(socket.id);
        
        if (playerInRoom) {
          // Broadcast game start to all players in the room
          io.to(playerInRoom.room.id).emit('game-started', {
            success: true,
            gameState: result.gameState
          });
          
          console.log(`Game started in room ${playerInRoom.room.code}`);
        }
      } else {
        socket.emit('game-started', {
          success: false,
          error: result.error || 'Failed to start game'
        });
      }
    } catch (error) {
      console.error('Error in start-game:', error);
      socket.emit('game-started', {
        success: false,
        error: 'An error occurred while starting the game'
      });
    }
  });

  // Get current room info
  socket.on('get-room-info', () => {
    try {
      const playerInRoom = roomManager.getPlayerInRoom(socket.id);
      
      if (playerInRoom) {
        const roomInfo = roomManager.getRoomInfo(playerInRoom.room.id);
        socket.emit('room-info', {
          success: true,
          room: roomInfo
        });
      } else {
        socket.emit('room-info', {
          success: false,
          error: 'Not in a room'
        });
      }
    } catch (error) {
      console.error('Error in get-room-info:', error);
      socket.emit('room-info', {
        success: false,
        error: 'An error occurred while getting room info'
      });
    }
  });

  // Update player color
  socket.on('update-player-color', (data: { color: string }) => {
    try {
      // Rate limiting
      if (!RateLimiter.checkLimit(socket.id, 'update-color', 3, 5000)) { // 3 per 5 seconds
        socket.emit('room-error', {
          message: 'Please wait before changing color again'
        });
        return;
      }

      console.log('Update player color from:', socket.id, data);
      
      // Validate input
      if (!data || typeof data !== 'object') {
        socket.emit('room-error', {
          message: 'Invalid color data'
        });
        return;
      }

      // Basic color validation
      const playerColor = typeof data.color === 'string' && 
                         /^#[0-9A-Fa-f]{6}$/.test(data.color) 
                         ? data.color 
                         : '#DC143C';
      
      const result = roomManager.updatePlayerColor(socket.id, playerColor);
      
      if (result.success && result.room) {
        // Broadcast room update to all players in the room
        io.to(result.room.id).emit('room-updated', result.room);
        
        console.log(`Player color updated in room ${result.room.code}`);
      } else {
        socket.emit('room-error', {
          message: result.error || 'Failed to update color'
        });
      }
    } catch (error) {
      console.error('Error in update-player-color:', error);
      socket.emit('room-error', {
        message: 'An error occurred while updating color'
      });
    }
  });

  // Send chat message
  socket.on('send-chat-message', (data: { message: string; playerColor?: string }) => {
    try {
      // Rate limiting for chat
      if (!RateLimiter.checkLimit(socket.id, 'chat', 5, 5000)) { // 5 messages per 5 seconds
        socket.emit('room-error', {
          message: 'Please slow down your messages'
        });
        return;
      }

      console.log('Chat message from:', socket.id, data);
      
      // Validate input
      if (!data || typeof data !== 'object') {
        socket.emit('room-error', {
          message: 'Invalid message data'
        });
        return;
      }

      const messageValidation = ValidationUtils.validateChatMessage(data.message);
      if (!messageValidation.isValid) {
        socket.emit('room-error', {
          message: messageValidation.errors[0] || 'Invalid message'
        });
        return;
      }
      
      const playerInRoom = roomManager.getPlayerInRoom(socket.id);
      
      if (playerInRoom) {
        // Use stored player color or provided color as fallback
        const playerColor = playerInRoom.player.color || 
                           (typeof data.playerColor === 'string' && 
                            /^#[0-9A-Fa-f]{6}$/.test(data.playerColor) 
                            ? data.playerColor 
                            : '#DC143C');

        // Update player color if provided and different from stored
        if (data.playerColor && data.playerColor !== playerInRoom.player.color) {
          roomManager.updatePlayerColor(socket.id, data.playerColor);
        }
        
        const chatMessage = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          playerId: playerInRoom.player.id,
          playerName: playerInRoom.player.name,
          playerColor: playerColor,
          message: messageValidation.sanitized,
          timestamp: new Date().toISOString(),
        };
        
        // Broadcast chat message to all players in the room
        io.to(playerInRoom.room.id).emit('chat-message', chatMessage);
        
        console.log(`Chat message sent in room ${playerInRoom.room.code}: ${messageValidation.sanitized}`);
      } else {
        socket.emit('room-error', {
          message: 'Not in a room'
        });
      }
    } catch (error) {
      console.error('Error in send-chat-message:', error);
      socket.emit('room-error', {
        message: 'An error occurred while sending the message'
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    try {
      console.log('Player disconnected:', socket.id);
      
      const result = roomManager.handlePlayerDisconnect(socket.id);
      
      if (result.roomId) {
        // Get updated room info and broadcast to remaining players
        const roomInfo = roomManager.getRoomInfo(result.roomId);
        if (roomInfo) {
          io.to(result.roomId).emit('room-updated', roomInfo);
          
          // Notify remaining players that someone disconnected
          socket.to(result.roomId).emit('player-disconnected', {
            wasHost: result.wasHost,
            room: roomInfo
          });
        }
        
        console.log(`Player disconnected from room ${result.roomId}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
}
