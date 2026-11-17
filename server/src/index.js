import http from 'http';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { config } from './config.js';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import friendRoutes from './routes/friends.js';
import { registerSocket } from './socket/index.js';

const app = express();

app.use(cors({ origin: config.clientOrigins }));
app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({ windowMs: 60_000, limit: 200, standardHeaders: true, legacyHeaders: false });
// Stricter limit on login/register to slow down password guessing
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again in a few minutes' },
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.clientOrigins } });
registerSocket(io);

connectDB()
  .then(() => {
    server.listen(config.port, () => console.log(`Server listening on http://localhost:${config.port}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
