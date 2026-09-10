export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthClient, DRIVE_SCOPE } from '@/lib/googleAuth';
import { getSession } from '@/lib/adminAuth';
import { logActivity } from '@/lib/activityLog';

const TEMPLATE_FIELDS = 'id, name, mimeType, webViewLink, thumbnailLink, createdTime, appProperties';

// Sets/corrects a template's workshop tag — mainly for backfilling files
// uploaded before this tag existed (they were untaggable at upload time, so
// a workshop-scoped account could never see them, even for their own
// workshop) or fixing a mistagged one.
export async function PATCH(req, { params }) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const { workshop } = await req.json();
    const trimmedWorkshop = (workshop || '').toString().trim();
    if (!trimmedWorkshop) {
      return NextResponse.json({ error: 'A workshop name is required.' }, { status: 400 });
    }

    const auth = getAuthClient([DRIVE_SCOPE]);
    const drive = google.drive({ version: 'v3', auth });

    const meta = await drive.files
      .get({ fileId, fields: 'name, appProperties' })
      .then((res) => res.data)
      .catch(() => null);
    if (!meta) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
    }

    const session = await getSession(req);
    if (session.workshops.length > 0) {
      const currentWorkshop = meta.appProperties?.workshop;
      const inScope = (w) => w && session.workshops.includes(w);
      // A scoped account may only retag a file that's already theirs (or
      // untagged) into one of their own workshops — never move a file into
      // or out of a workshop they don't manage.
      if ((currentWorkshop && !inScope(currentWorkshop)) || !inScope(trimmedWorkshop)) {
        return NextResponse.json({ error: 'This template is outside your assigned workshops.' }, { status: 403 });
      }
    }

    const { data } = await drive.files.update({
      fileId,
      requestBody: { appProperties: { workshop: trimmedWorkshop } },
      fields: TEMPLATE_FIELDS,
    });

    await logActivity('Updated template workshop', `${meta.name} -> "${trimmedWorkshop}"`, session.email);

    return NextResponse.json({ template: data });
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json({ error: 'Failed to update template.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { fileId } = await params;
    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    const auth = getAuthClient([DRIVE_SCOPE]);
    const drive = google.drive({ version: 'v3', auth });

    const meta = await drive.files
      .get({ fileId, fields: 'name, appProperties' })
      .then((res) => res.data)
      .catch(() => null);
    const name = meta?.name || fileId;

    const session = await getSession(req);
    if (session.workshops.length > 0) {
      const fileWorkshop = meta?.appProperties?.workshop;
      if (!fileWorkshop || !session.workshops.includes(fileWorkshop)) {
        return NextResponse.json({ error: 'This template is outside your assigned workshops.' }, { status: 403 });
      }
    }

    await drive.files.delete({ fileId });
    await logActivity('Deleted template', name, session.email);

    return NextResponse.json({ result: 'success' });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template.' }, { status: 500 });
  }
}
