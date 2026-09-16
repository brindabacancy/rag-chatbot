import { answerQuestion } from '@/lib/ragPipeline';

export const runtime = 'nodejs';

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const message = body?.message;
  const history = Array.isArray(body?.history) ? body.history : [];

  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: '"message" (string) is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { sources } = await answerQuestion({ message, history }, (token) => {
          controller.enqueue(encoder.encode(sseEvent('token', { token })));
        });
        controller.enqueue(encoder.encode(sseEvent('sources', { sources })));
        controller.enqueue(encoder.encode(sseEvent('done', {})));
      } catch (err) {
        controller.enqueue(encoder.encode(sseEvent('error', { message: err.message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
