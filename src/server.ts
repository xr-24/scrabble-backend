import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerRoomEvents } from './events/roomEvents';
import { registerGameEvents } from './events/gameEvents';
import { dictionaryService } from './services/dictionaryService';

const app = express();
const server = createServer(app);

// Configure CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://lexikon.unkind.dev']
    : ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Socket.io server with CORS
const io = new Server(server, {
  cors: corsOptions
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Scrabble Backend Server Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check with more details
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dictionary: {
      loaded: dictionaryService.isDictionaryLoaded(),
      size: dictionaryService.getDictionarySize()
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Register all event handlers
  registerRoomEvents(socket, io);
  registerGameEvents(socket, io);
  
  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to Scrabble server',
    socketId: socket.id
  });
});

// Initialize dictionary on startup
async function initializeServer() {
  try {
    console.log('Loading dictionary...');
    await dictionaryService.loadDictionary();
    console.log('Dictionary loaded successfully');
    
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`🚀 Scrabble Backend Server running on port ${PORT}`);
      console.log(`📚 Dictionary loaded with ${dictionaryService.getDictionarySize()} words`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 CORS origins: ${JSON.stringify(corsOptions.origin)}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
initializeServer();
