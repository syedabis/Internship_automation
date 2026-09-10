const { google } = require('googleapis');

// Load environment variables
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // fix line breaks

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: CLIENT_EMAIL,
    private_key: PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

async function getSheetByTitle(sheetTitle) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetTitle}`,
  });

  const [headerRow, ...rows] = res.data.values || [];

  if (!headerRow) {
    throw new Error(`Sheet "${sheetTitle}" has no data.`);
  }

  const data = rows.map(row => {
    const obj = {};
    headerRow.forEach((key, i) => {
      obj[key.trim()] = (row[i] || '').trim();
    });
    return obj;
  });

  return {
    getRows: async () => data,
  };
}

module.exports = { getSheetByTitle };
