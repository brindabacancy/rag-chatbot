import { NextResponse } from 'next/server';
import { deleteDocument } from '@/lib/ragPipeline';

export const runtime = 'nodejs';

export async function DELETE(request, { params }) {
  const { docId } = await params;
  const removed = await deleteDocument(docId);
  if (!removed) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
