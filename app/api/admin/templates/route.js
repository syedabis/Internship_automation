export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { getAuthClient, DRIVE_SCOPE } from '@/lib/googleAuth';
import { getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/activityLog';

const TEMPLATES_FOLDER_ID = process.env.GOOGLE_TEMPLATES_FOLDER_ID;
const TEMPLATE_FIELDS = 'id, name, mimeType, webViewLink, thumbnailLink, createdTime, appProperties';

function getDriveClient() {
  const auth = getAuthClient([DRIVE_SCOPE]);
  return google.drive({ version: 'v3', auth });
}

export async function GET(req) {
  try {
    if (!TEMPLATES_FOLDER_ID) {
      return NextResponse.json({ error: 'Templates storage is not available right now.' }, { status: 500 });
    }

    const drive = getDriveClient();
    const { data } = await drive.files.list({
      q: `'${TEMPLATES_FOLDER_ID}' in parents and trashed = false`,
      fields: `files(${TEMPLATE_FIELDS})`,
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    let templates = data.files || [];

    // A workshop-scoped admin only sees their own templates. Files uploaded
    // before code-tracking existed (no appProperties.workshop tag) are excluded
    // for scoped accounts rather than shown — an unclear-ownership file
    // defaults to hidden, not visible, for a scoped account.
    const session = await getSession(req);
    if (session.workshops.length > 0) {
      templates = templates.filter((t) => session.workshops.includes(t.appProperties?.workshop));
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to list templates:', error);
    return NextResponse.json({ error: 'Failed to list templates.' }, { status: 500 });
  }
}

// Note: request.formData() buffers the whole upload in memory, and Vercel's default
// serverless body-size limit is ~4.5MB. Fine for typical PDF/PNG certificate
// templates; large design files (e.g. layered PSDs) may not fit.
export async function POST(req) {
  try {
    if (!TEMPLATES_FOLDER_ID) {
      return NextResponse.json({ error: 'Templates storage is not available right now.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const workshop = formData.get('workshop');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A file is required.' }, { status: 400 });
    }

    const session = await getSession(req);
    if (session.workshops.length > 0 && !session.workshops.includes(String(workshop || ''))) {
      return NextResponse.json(
        { error: 'You can only upload templates for your assigned workshop(s).' },
        { status: 403 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const drive = getDriveClient();

    const { data } = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [TEMPLATES_FOLDER_ID],
        ...(workshop ? { appProperties: { workshop: String(workshop) } } : {}),
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: TEMPLATE_FIELDS,
    });

    await logActivity('Uploaded template', workshop ? `${file.name} (${workshop})` : file.name, session.email);

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (error) {
    console.error('Failed to upload template:', error);
    return NextResponse.json({ error: 'Failed to upload template.' }, { status: 500 });
  }
}
