import { Socket, Server } from 'socket.io';
import { roomManager } from '../services/RoomManager';
import type { CreateRoomRequest, JoinRoomRequest } from '../types/room';

export function registerRoomEvents(socket: Socket, io: Server) {
  // Create a new room
  socket.on('create-room', (data: CreateRoomRequest) => {
    console.log('Create room request:', data);
    
    const result = roomManager.createRoom(socket.id, data);
    
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
        error: result.error
      });
    }
  });

  // Join an existing room
  socket.on('join-room', (data: JoinRoomRequest) => {
    console.log('Join room request:', data);
    
    const result = roomManager.joinRoom(socket.id, data);
    
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
      
      // Notify other players that someone joined (or reconnected)
      socket.to(result.room.id).emit('player-joined', {
        playerName: data.playerName,
        room: result.room
      });
      
      console.log(`Player ${data.playerName} joined room ${data.roomCode}`);
    } else {
      socket.emit('room-joined', {
        success: false,
        error: result.error
      });
    }
  });

  // Leave room
  socket.on('leave-room', () => {
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
        error: result.error
      });
    }
  });

  // Start game (host only)
  socket.on('start-game', () => {
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
        error: result.error
      });
    }
  });

  // Get current room info
  socket.on('get-room-info', () => {
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
  });

  // Send chat message
  socket.on('send-chat-message', (data: { message: string; playerColor: string }) => {
    console.log('Chat message from:', socket.id, data);
    
    const playerInRoom = roomManager.getPlayerInRoom(socket.id);
    
    if (playerInRoom) {
      const chatMessage = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        playerId: playerInRoom.player.id,
        playerName: playerInRoom.player.name,
        playerColor: data.playerColor,
        message: data.message,
        timestamp: new Date().toISOString(),
      };
      
      // Broadcast chat message to all players in the room
      io.to(playerInRoom.room.id).emit('chat-message', chatMessage);
      
      console.log(`Chat message sent in room ${playerInRoom.room.code}: ${data.message}`);
    } else {
      socket.emit('room-error', {
        message: 'Not in a room'
      });
    }
  });

  // Handle disconnect with grace period
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    const result = roomManager.handlePlayerDisconnect(socket.id);
    
    if (result.roomId) {
      // Get updated room info and broadcast to remaining players
      const roomInfo = roomManager.getRoomInfo(result.roomId);
      if (roomInfo) {
        io.to(result.roomId).emit('room-updated', roomInfo);
        
        // Notify remaining players about disconnection with grace period info
        socket.to(result.roomId).emit('player-disconnected', {
          playerId: result.playerId,
          wasHost: result.wasHost,
          room: roomInfo,
          hasGracePeriod: true // Let clients know this player might reconnect
        });
      }
      
      console.log(`Player temporarily disconnected from room ${result.roomId} (grace period active)`);
    }
  });
}