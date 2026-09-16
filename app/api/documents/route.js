import { NextResponse } from 'next/server';
import { ingestDocument, listDocuments } from '@/lib/ragPipeline';
import { SUPPORTED_EXTENSIONS } from '@/lib/documentParser';

export const runtime = 'nodejs';

export async function GET() {
  const documents = await listDocuments();
  return NextResponse.json({ documents });
}

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded. Use the "file" form field.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestDocument({ buffer, filename: file.name, size: file.size });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const isUnsupported = /Unsupported file type/.test(err.message);
    return NextResponse.json(
      { error: err.message, supportedTypes: isUnsupported ? SUPPORTED_EXTENSIONS : undefined },
      { status: isUnsupported ? 415 : 500 }
    );
  }
}
