import { Router } from 'express';
import { answerQuestion } from '../services/ragPipeline.js';

export const chatRouter = Router();

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

chatRouter.post('/', async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: '"message" (string) is required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const { sources } = await answerQuestion(
      { message, history: Array.isArray(history) ? history : [] },
      (token) => sendEvent(res, 'token', { token })
    );
    sendEvent(res, 'sources', { sources });
    sendEvent(res, 'done', {});
  } catch (err) {
    sendEvent(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});
