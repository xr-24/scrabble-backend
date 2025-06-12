import type { Room, RoomPlayer, CreateRoomRequest, JoinRoomRequest, RoomInfo } from '../types/room';
import { gameService } from './GameService';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private roomsByCode: Map<string, string> = new Map(); // code -> roomId
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId

  generateRoomCode(): string {
    // Generate a 6-digit room code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  createRoom(hostSocketId: string, request: CreateRoomRequest): { success: boolean; room?: RoomInfo; error?: string } {
    // Check if player is already in a room
    if (this.playerRooms.has(hostSocketId)) {
      return { success: false, error: 'Player is already in a room' };
    }

    const roomId = `room-${Date.now()}-${Math.random()}`;
    let roomCode = this.generateRoomCode();
    
    // Ensure unique room code
    while (this.roomsByCode.has(roomCode)) {
      roomCode = this.generateRoomCode();
    }

    const hostPlayer: RoomPlayer = {
      id: `player-0`,
      name: request.playerName,
      socketId: hostSocketId,
      isHost: true,
      joinedAt: new Date(),
    };

    const room: Room = {
      id: roomId,
      code: roomCode,
      hostId: hostPlayer.id,
      players: [hostPlayer],
      isStarted: false,
      createdAt: new Date(),
      maxPlayers: 4,
    };

    this.rooms.set(roomId, room);
    this.roomsByCode.set(roomCode, roomId);
    this.playerRooms.set(hostSocketId, roomId);

    console.log(`Room created: ${roomCode} by ${request.playerName}`);

    return {
      success: true,
      room: this.getRoomInfo(roomId)!
    };
  }

  joinRoom(playerSocketId: string, request: JoinRoomRequest): { success: boolean; room?: RoomInfo; error?: string } {
    // Check if player is already in a room
    if (this.playerRooms.has(playerSocketId)) {
      return { success: false, error: 'Player is already in a room' };
    }

    const roomId = this.roomsByCode.get(request.roomCode);
    if (!roomId) {
      return { success: false, error: 'Room not found' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.isStarted) {
      return { success: false, error: 'Game has already started' };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: 'Room is full' };
    }

    // Check if player name is already taken
    if (room.players.some(p => p.name === request.playerName)) {
      return { success: false, error: 'Player name is already taken' };
    }

    const newPlayer: RoomPlayer = {
      id: `player-${room.players.length}`,
      name: request.playerName,
      socketId: playerSocketId,
      isHost: false,
      joinedAt: new Date(),
    };

    room.players.push(newPlayer);
    this.playerRooms.set(playerSocketId, roomId);

    console.log(`Player ${request.playerName} joined room ${request.roomCode}`);

    return {
      success: true,
      room: this.getRoomInfo(roomId)!
    };
  }

  leaveRoom(playerSocketId: string): { success: boolean; roomId?: string; wasHost?: boolean; error?: string } {
    const roomId = this.playerRooms.get(playerSocketId);
    if (!roomId) {
      return { success: false, error: 'Player is not in a room' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const playerIndex = room.players.findIndex(p => p.socketId === playerSocketId);
    if (playerIndex === -1) {
      return { success: false, error: 'Player not found in room' };
    }

    const player = room.players[playerIndex];
    const wasHost = player.isHost;

    // Remove player from room
    room.players.splice(playerIndex, 1);
    this.playerRooms.delete(playerSocketId);

    console.log(`Player ${player.name} left room ${room.code}`);

    // If room is empty, clean it up
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.roomsByCode.delete(room.code);
      
      // Clean up game if it exists
      if (room.gameState) {
        gameService.removeGame(roomId);
      }
      
      console.log(`Room ${room.code} deleted (empty)`);
    } else if (wasHost && !room.isStarted) {
      // Transfer host to next player if game hasn't started
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
      console.log(`Host transferred to ${room.players[0].name} in room ${room.code}`);
    }

    return { success: true, roomId, wasHost };
  }

  startGame(hostSocketId: string): { success: boolean; gameState?: any; error?: string } {
    const roomId = this.playerRooms.get(hostSocketId);
    if (!roomId) {
      return { success: false, error: 'Player is not in a room' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const hostPlayer = room.players.find(p => p.socketId === hostSocketId);
    if (!hostPlayer || !hostPlayer.isHost) {
      return { success: false, error: 'Only the host can start the game' };
    }

    if (room.isStarted) {
      return { success: false, error: 'Game has already started' };
    }

    if (room.players.length < 2) {
      return { success: false, error: 'Need at least 2 players to start the game' };
    }

    // Start the game
    room.isStarted = true;
    const roomPlayers = room.players.map(p => ({ id: p.id, name: p.name }));
    const gameState = gameService.initializeGame(roomId, roomPlayers);
    room.gameState = gameState;

    console.log(`Game started in room ${room.code} with ${room.players.length} players`);

    return { success: true, gameState };
  }

  getRoomInfo(roomId: string): RoomInfo | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      players: room.players,
      isStarted: room.isStarted,
      maxPlayers: room.maxPlayers,
    };
  }

  getRoomBySocketId(socketId: string): Room | null {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) {
      return null;
    }
    return this.rooms.get(roomId) || null;
  }

  getRoomByCode(code: string): Room | null {
    const roomId = this.roomsByCode.get(code);
    if (!roomId) {
      return null;
    }
    return this.rooms.get(roomId) || null;
  }

  getPlayerInRoom(socketId: string): { room: Room; player: RoomPlayer } | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) {
      return null;
    }

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) {
      return null;
    }

    return { room, player };
  }

  // Clean up rooms older than 1 hour with no activity
  cleanupOldRooms(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    for (const [roomId, room] of this.rooms) {
      if (room.createdAt < oneHourAgo && !room.isStarted) {
        // Clean up room
        this.roomsByCode.delete(room.code);
        this.rooms.delete(roomId);
        
        // Clean up player mappings
        room.players.forEach(player => {
          this.playerRooms.delete(player.socketId);
        });
        
        console.log(`Cleaned up old room: ${room.code}`);
      }
    }
  }

  // Get all rooms (for debugging)
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  // Handle player disconnect
  handlePlayerDisconnect(socketId: string): { roomId?: string; wasHost?: boolean } {
    const result = this.leaveRoom(socketId);
    return {
      roomId: result.roomId,
      wasHost: result.wasHost
    };
  }
}

export const roomManager = new RoomManager();

// Clean up old rooms every 30 minutes
setInterval(() => {
  roomManager.cleanupOldRooms();
}, 30 * 60 * 1000);
