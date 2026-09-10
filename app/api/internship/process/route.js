import { NextResponse } from 'next/server';
import { processPendingInternshipCertificates } from '@/lib/internshipCertificate';

export async function POST(req) {
  const logs = [];
  const logger = (msg) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    logger('[START] Initiating Internship Certificate automation...');
    const result = await processPendingInternshipCertificates(logger);
    return NextResponse.json({
      success: true,
      message: `Processed ${result.count} internship certificates successfully.`,
      logs,
    });
  } catch (error) {
    logger(`[FATAL] ${error.message}`);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        logs,
      },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  return NextResponse.json({
    status: 'online',
    service: 'DataCrumbs Internship Certificate Automation API',
    endpoint: 'POST /api/internship/process',
  });
}
