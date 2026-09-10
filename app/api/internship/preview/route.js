import { NextResponse } from 'next/server';
import { generateInternshipCertificate } from '@/lib/internshipCertificate';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || 'HUZAIFA SIDDIQUI';
  const dateStr = searchParams.get('date') || '';
  const certNo = searchParams.get('certNo') || '';
  const programName = searchParams.get('program') || '6-Week Internship Program';

  try {
    const { buffer, filename } = await generateInternshipCertificate({
      name,
      dateStr,
      certNo,
      programName,
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
