export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function POST(req) {
  return NextResponse.json({ error: 'Cloud file upload storage is disabled.' }, { status: 400 });
}
