import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function GET() {
  try {
    // Google Sheets configuration
    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "1CaUSBO0W9doKENqKSAhOBJB4dk_eqXpwGgkrvx8KyUA";
    const SHEET2_NAME = "Sheet2";
    
    // Initialize auth - using your actual environment variable names
    const serviceAccountEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!serviceAccountEmail || !privateKey) {
      return NextResponse.json(
        { error: 'Google service account credentials not configured. Please check GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY' },
        { status: 500 }
      );
    }

    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly'
      ],
    });

    // Initialize the spreadsheet
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, jwt);
    await doc.loadInfo();

    // Get Sheet2 by its actual name
    let sheet;
    try {
      // Method 1: Try sheetsByTitle
      sheet = doc.sheetsByTitle[SHEET2_NAME];
      
      // Method 2: Try sheetsByIndex if title method fails
      if (!sheet) {
        for (let i = 0; i < doc.sheetCount; i++) {
          const testSheet = doc.sheetsByIndex[i];
          if (testSheet.title === SHEET2_NAME) {
            sheet = testSheet;
            break;
          }
        }
      }
      
    } catch (error) {
      console.log('Error getting sheets:', error.message);
    }
    
    if (!sheet) {
      return NextResponse.json(
        { error: 'Could not access Sheet2' },
        { status: 404 }
      );
    }

    // Load all rows using getRows instead of loadCells for better compatibility
    const rows = await sheet.getRows();

    // Extract unique workshop names - we know 'workshop' is the second column
    const workshopNames = new Set();
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData = row.toObject();
      if (rowData.workshop && rowData.workshop.toString().trim()) {
        workshopNames.add(rowData.workshop.toString().trim());
      }
    }

    const workshops = Array.from(workshopNames).sort();

    return NextResponse.json({ workshops });

  } catch (error) {
    console.error('Error fetching workshops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshops' },
      { status: 500 }
    );
  }
}
