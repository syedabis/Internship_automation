export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { uploadLogo } from '@/lib/supabaseStorage';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — a nav-bar mark, not a hero image.

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A logo file is required.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Logo must be under 2MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadLogo(buffer, { contentType: file.type });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Failed to upload logo:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload logo.' }, { status: 400 });
  }
}
