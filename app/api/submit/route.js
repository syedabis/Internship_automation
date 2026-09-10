export const runtime = 'nodejs';

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const SPREADSHEET_ID = '1CaUSBO0W9doKENqKSAhOBJB4dk_eqXpwGgkrvx8KyUA';
const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

// Cache for verification data
let verificationCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

const SUBMISSIONS_SHEET_NAME = 'Sheet1';
const MIN_GRADUATION_YEAR = 1950;
const MAX_GRADUATION_YEAR = new Date().getFullYear() + 10;
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
// Sheet1 rows are always appended, never reordered, so the most recent submissions
// are always the last N rows — reading just the tail avoids scanning the full
// (5,000+ row and growing) sheet on every single submission.
const DUPLICATE_LOOKBACK_ROWS = 200;

async function authenticate() {
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google API credentials in environment variables');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });

  const authClient = await auth.getClient();
  doc.auth = authClient;
}

// Function to get verification data with caching
async function getVerificationData() {
  const now = Date.now();
  
  // Return cached data if it's still valid
  if (verificationCache && (now - cacheTimestamp) < CACHE_TTL) {
    return verificationCache;
  }
  
  // Load spreadsheet info
  await doc.loadInfo();

  // Verify Sheet2 exists
  const verifySheet = doc.sheetsByTitle['Sheet2'];
  if (!verifySheet) {
    throw new Error('Verification sheet "Sheet2" not found.');
  }

  await verifySheet.loadHeaderRow();
  const headerValues = verifySheet.headerValues;

  const codeIdx = headerValues.findIndex(h => h.toLowerCase() === 'code');
  const workshopIdx = headerValues.findIndex(h => h.toLowerCase() === 'workshop');

  if (codeIdx === -1 || workshopIdx === -1) {
    throw new Error('Required columns (code, workshop) not found in verification sheet.');
  }

  const rows = await verifySheet.getRows();
  
  // Create verification data structure
  const verificationData = {
    headerValues,
    codeIdx,
    workshopIdx,
    rows: rows.map(row => ({
      code: row._rawData[codeIdx]?.toString().trim(),
      workshop: row._rawData[workshopIdx]?.toString().trim()
    }))
  };
  
  // Update cache
  verificationCache = verificationData;
  cacheTimestamp = now;
  
  return verificationData;
}

function columnToLetter(zeroBasedIndex) {
  let letter = '';
  let n = zeroBasedIndex + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Sheet1's "timestamp" column is a real datetime under the hood, but its cell
// format displays date-only (e.g. "8/7/2026") — reading it normally loses the
// time-of-day entirely. The raw stored value is a Sheets/Excel-style date serial
// (day 0 = Dec 30 1899, no timezone of its own) representing a wall-clock reading
// in the SPREADSHEET's configured timezone — not UTC — so the timezone offset has
// to be subtracted back out to recover the true UTC instant.
function sheetsSerialToMillis(serial, timezoneOffsetMillis) {
  return Math.round((serial - 25569) * 86400 * 1000) - timezoneOffsetMillis;
}

// e.g. "Asia/Karachi" -> +5h in milliseconds, computed from the IANA zone name
// rather than assumed, since Intl already knows every zone's current offset
// (including any DST) without a lookup table.
function getTimezoneOffsetMillis(timeZone, atMillis = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' }).formatToParts(
      new Date(atMillis)
    );
    const match = (parts.find((p) => p.type === 'timeZoneName')?.value || '').match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] || 0)) * 60 * 1000;
  } catch {
    return 0;
  }
}

// Checks only the last DUPLICATE_LOOKBACK_ROWS rows of Sheet1 (not the whole sheet)
// for a submission from the same email, for the same workshop, within the last
// hour — catches double-clicks/resubmissions without the cost of scanning every
// historical row on each request.
async function checkRecentDuplicate({ workshop, email }) {
  if (!email) return false;

  // Refresh sheet metadata (cheap, no row data) so rowCount reflects the latest
  // appends even if the 5-minute verification cache above is still warm.
  await doc.loadInfo();
  const sheet = doc.sheetsByTitle[SUBMISSIONS_SHEET_NAME];
  if (!sheet) return false;

  await sheet.loadHeaderRow();
  const headerValues = sheet.headerValues;
  const workshopKey = headerValues.find((h) => h.toLowerCase() === 'workshop');
  const emailKey = headerValues.find((h) => h.toLowerCase() === 'email');
  const timestampIdx = headerValues.findIndex((h) => h.toLowerCase() === 'timestamp');

  if (!workshopKey || !emailKey) return false;

  const totalDataRows = sheet.rowCount - 1; // minus header row
  if (totalDataRows <= 0) return false;

  const tailSize = Math.min(DUPLICATE_LOOKBACK_ROWS, totalDataRows);
  const offset = totalDataRows - tailSize;
  const recentRows = await sheet.getRows({ offset, limit: tailSize });

  let rawTimestamps = [];
  let tzOffsetMillis = 0;
  if (timestampIdx !== -1) {
    tzOffsetMillis = getTimezoneOffsetMillis(doc.timeZone || 'UTC');
    const startRow = offset + 2; // +1 for the header row, +1 for 0-index -> 1-index
    const endRow = startRow + tailSize - 1;
    const colLetter = columnToLetter(timestampIdx);
    const sheetsApi = google.sheets({ version: 'v4', auth: doc.auth });
    const { data } = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SUBMISSIONS_SHEET_NAME}!${colLetter}${startRow}:${colLetter}${endRow}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    rawTimestamps = data.values || [];
  }

  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedWorkshop = workshop.toLowerCase().trim();

  return recentRows.some((row, i) => {
    const rowWorkshop = (row.get(workshopKey) || '').toString().trim().toLowerCase();
    const rowEmail = (row.get(emailKey) || '').toString().trim().toLowerCase();
    if (rowWorkshop !== normalizedWorkshop) return false;
    if (rowEmail !== normalizedEmail) return false;

    const rawValue = rawTimestamps[i]?.[0];
    if (typeof rawValue === 'number') {
      return sheetsSerialToMillis(rawValue, tzOffsetMillis) >= cutoff;
    }
    if (typeof rawValue === 'string' && rawValue) {
      const parsed = Date.parse(rawValue);
      if (!Number.isNaN(parsed)) return parsed >= cutoff;
    }

    // No usable timestamp on this row, but it's still within the recent tail we
    // fetched — treat it as recent rather than risk letting a duplicate through.
    return true;
  });
}

// Retry function for handling 429 errors
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let retries = 0;
  let delay = initialDelay;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (error.message && error.message.includes('429') && retries < maxRetries) {
        retries++;
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

export async function POST(req) {
  try {
    await authenticate();

    const jsonData = await req.json();
    console.log('Received submission JSON:', jsonData);

    // Normalize and extract fields (matching exact keys your client sends)
    const code = (jsonData.code || '').toString().trim();
    const name = (jsonData.Name || '').toString().trim();
    const email = (jsonData.Email || '').toString().trim();
    const phone = (jsonData.Phone || '').toString().trim();
    const university = (jsonData.University || '').toString().trim();
    const domain = (jsonData.Domain || '').toString().trim();
    const graduationYear = (jsonData.Graduation_Year || '').toString().trim();
    const workshop = (jsonData.Workshop || jsonData.workshop || '').toString().trim();
    const linkedinUrl = (jsonData.Linkedin_URL || '').toString().trim();

    // Validation
    if (!code) {
      return NextResponse.json({ error: 'Code is required.' }, { status: 400 });
    }
    if (!workshop) {
      return NextResponse.json({ error: 'Workshop is required.' }, { status: 400 });
    }
    const graduationYearNum = Number(graduationYear);
    if (
      !/^\d{4}$/.test(graduationYear) ||
      graduationYearNum < MIN_GRADUATION_YEAR ||
      graduationYearNum > MAX_GRADUATION_YEAR
    ) {
      return NextResponse.json(
        { error: `Graduation year must be a valid year between ${MIN_GRADUATION_YEAR} and ${MAX_GRADUATION_YEAR}.` },
        { status: 400 }
      );
    }

    // Get verification data with retry mechanism
    const verificationData = await retryWithBackoff(getVerificationData);

    const isValid = verificationData.rows.some(row => 
      row.code === code && row.workshop === workshop
    );

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid code or workshop.' }, { status: 400 });
    }

    const isDuplicate = await checkRecentDuplicate({ workshop, email });
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'You already submitted for this workshop recently. Your certificate is on its way — please check your email in a few minutes.' },
        { status: 409 }
      );
    }

    // Prepare data for Google Apps Script
    const googleScriptUrl =
      'https://script.google.com/macros/s/AKfycbyeQFE6AfGSZv3DQUc3CH1DGoQzBgVKhETRBXP_hZfKreBC-wCcVw_7js7vI5ag92Bd/exec';

    // Create timestamp in ISO format
    const timestamp = new Date().toISOString();

    const body = new URLSearchParams();
    body.append('timestamp', timestamp);
    body.append('code', code);
    body.append('Name', name);
    body.append('Email', email);
    body.append('Phone', phone);
    body.append('University', university);
    body.append('Domain', domain);
    body.append('Graduation_Year', graduationYear);
    body.append('workshop', workshop);
    body.append('Linkedin_URL', linkedinUrl);

    console.log('Sending data to Apps Script:', body.toString());

    // Retry logic for Google Apps Script requests
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutId;
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to submit to Google Apps Script`);
        
        // Create AbortController for timeout handling
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout per attempt

        const response = await fetch(googleScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error response from Apps Script:', errorText);
          return NextResponse.json({ error: `Apps Script error: ${errorText}` }, { status: response.status });
        }

        console.log(`✅ Successfully submitted to Google Apps Script on attempt ${attempt}`);
        return NextResponse.json({ result: 'success' }, { status: 200 });
        
      } catch (fetchError) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        lastError = fetchError;
        
        if (fetchError.name === 'AbortError') {
          console.error(`❌ Request timeout on attempt ${attempt}: Google Apps Script did not respond within 20 seconds`);
        } else {
          console.error(`❌ Fetch error on attempt ${attempt}:`, fetchError.message);
        }

        // Check if submission was actually saved in sheet despite timeout/fetch error
        try {
          const isVerifiedInSheet = await checkRecentDuplicate({ workshop, email });
          if (isVerifiedInSheet) {
            console.log(`✅ Verified submission in sheet despite network/timeout on attempt ${attempt}`);
            return NextResponse.json({ result: 'success' }, { status: 200 });
          }
        } catch (checkErr) {
          console.error('Error verifying duplicate status during retry:', checkErr);
        }
        
        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const waitTime = attempt * 2000; // 2s, 4s, 6s
          console.log(`Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // If all retries failed
    if (lastError.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timeout: The submission service is currently unavailable. Please try again later.' }, { status: 504 });
    } else {
      return NextResponse.json({ error: `Network error after ${maxRetries} attempts: ${lastError.message}` }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
