export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthClient, DRIVE_SCOPE } from '@/lib/googleAuth';

// Drive's `thumbnailLink` URLs only work for a browser that's already signed into
// an account with access to the file. Our templates folder is shared only with the
// service account, not "anyone with the link", so the <img> tag can't load it
// directly — proxy it through our own authenticated request instead.
export async function GET(req, { params }) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const auth = getAuthClient([DRIVE_SCOPE]);
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.get({ fileId, fields: 'thumbnailLink' });
    if (!data.thumbnailLink) {
      return NextResponse.json({ error: 'No thumbnail available.' }, { status: 404 });
    }

    const { token } = await auth.getAccessToken();
    const thumbResponse = await fetch(data.thumbnailLink, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!thumbResponse.ok || !thumbResponse.body) {
      return NextResponse.json({ error: 'Failed to fetch thumbnail.' }, { status: 502 });
    }

    return new NextResponse(thumbResponse.body, {
      headers: {
        'Content-Type': thumbResponse.headers.get('content-type') || 'image/png',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Failed to proxy template thumbnail:', error);
    return NextResponse.json({ error: 'Failed to fetch thumbnail.' }, { status: 500 });
  }
}
