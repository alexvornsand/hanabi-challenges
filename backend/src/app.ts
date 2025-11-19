import express from 'express';
import { pool } from './config/db';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(express.json());

// Friendly root
app.get('/', (_req, res) => {
  res.send('Hanabi Challenges API is running. Try /health or /api/challenges');
});

// Health check: verifies DB connectivity
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ status: 'error', db: 'fail' });
  }
});

// Mount API routes
app.use(routes);

// Global error handler (for any thrown errors)
app.use(errorHandler);
