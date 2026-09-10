const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { Resend } = require('resend');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

// Register fonts from public/fonts
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  try {
    const poppinsPath = path.join(process.cwd(), 'public', 'fonts', 'Poppins-Bold.ttf');
    const montserratPath = path.join(process.cwd(), 'public', 'fonts', 'Montserrat Bold 700.ttf');
    
    if (fs.existsSync(poppinsPath)) {
      GlobalFonts.registerFromPath(poppinsPath, 'Poppins');
    }
    if (fs.existsSync(montserratPath)) {
      GlobalFonts.registerFromPath(montserratPath, 'Montserrat');
    }
    fontsRegistered = true;
  } catch (e) {
    console.error('Font registration warning:', e.message);
  }
}

/**
 * Generate Internship Completion Certificate Buffer
 */
async function generateInternshipCertificate({ name, dateStr, certNo, programName = "6-Week Internship Program" }) {
  registerFonts();
  
  const templatePath = path.join(process.cwd(), 'public', '6-Week Internship Program.png');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}`);
  }

  const bgImage = await loadImage(templatePath);
  const canvas = createCanvas(bgImage.width, bgImage.height);
  const ctx = canvas.getContext('2d');

  // Draw background image
  ctx.drawImage(bgImage, 0, 0, bgImage.width, bgImage.height);

  const nameUpper = (name || '').trim().toUpperCase();

  // Dynamic font sizing for student name
  let fontSize = 55;
  if (nameUpper.length > 25) {
    fontSize = 42;
  } else if (nameUpper.length > 20) {
    fontSize = 48;
  }

  // Draw Student Name at (1065, 310)
  ctx.font = `bold ${fontSize}px Poppins, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  ctx.fillText(nameUpper, 1065, 310);

  // Format Date if not provided
  if (!dateStr) {
    const today = new Date();
    dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Format Certificate Number if not provided
  if (!certNo) {
    const year = new Date().getFullYear();
    const hashVal = Math.abs([...nameUpper].reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)) % 10000;
    certNo = `DC-INT-${year}-${String(hashVal).padStart(4, '0')}`;
  }

  // Draw Awarded Date at (1610, 1145)
  ctx.font = '20px Montserrat, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(dateStr, 1610, 1145);

  // Draw Certificate No at (1610, 1190)
  ctx.fillText(certNo, 1610, 1190);

  const buffer = canvas.toBuffer('image/png');
  const filename = `${nameUpper.replace(/[^a-zA-Z0-9]+/g, '_')}_Internship_Certificate.png`;

  return { buffer, certNo, dateStr, filename };
}

/**
 * Create Internship Email HTML body
 */
function createInternshipEmailHtml(studentName, programName, certNo, dateStr) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Internship Completion Certificate</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background: #0B1D16; color: #333333; }
        .email-container { max-width: 680px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #052E16 0%, #14532D 50%, #166534 100%); padding: 40px 30px; text-align: center; color: #FFFFFF; }
        .header h1 { font-size: 26px; margin: 0; font-weight: 700; color: #4ADE80; }
        .header p { font-size: 15px; margin-top: 8px; color: #E2E8F0; }
        .content { padding: 35px 30px; }
        .greeting { font-size: 20px; font-weight: 600; color: #0F172A; margin-bottom: 15px; }
        .message { font-size: 15px; line-height: 1.7; color: #475569; margin-bottom: 25px; }
        .cert-card { background: #F0FDF4; border: 2px dashed #22C55E; border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: center; }
        .cert-card h3 { margin: 0 0 10px 0; color: #15803D; font-size: 18px; }
        .cert-meta { font-size: 14px; color: #334155; margin: 4px 0; }
        .linkedin-box { background: #F8FAFC; border-left: 4px solid #0A66C2; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .linkedin-box h4 { margin: 0 0 8px 0; color: #0A66C2; font-size: 16px; }
        .linkedin-btn { display: inline-block; background: #0A66C2; color: #FFFFFF !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 12px; }
        .footer { background: #0F172A; color: #94A3B8; padding: 25px; text-align: center; font-size: 13px; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Internship Completion Certificate</h1>
            <p>${programName}</p>
        </div>
        <div class="content">
            <div class="greeting">Dear ${studentName},</div>
            <div class="message">
                Congratulations on successfully completing the <strong>${programName}</strong> at <strong>DataCrumbs</strong>!
                <br><br>
                Throughout this intensive program, you demonstrated exceptional dedication, technical proficiency, and commitment to professional growth.
            </div>
            <div class="cert-card">
                <h3>🎓 Verified Certificate of Completion</h3>
                <div class="cert-meta"><strong>Certificate ID:</strong> ${certNo}</div>
                <div class="cert-meta"><strong>Issued Date:</strong> ${dateStr}</div>
            </div>
            <div class="linkedin-box">
                <h4>🚀 Share Your Achievement on LinkedIn</h4>
                <div style="font-size: 14px; color: #475569;">
                    Showcase your accomplishment to recruiters and your network! Access our LinkedIn post guide below:
                </div>
                <a href="https://drive.google.com/file/d/1X8xFBisAE7t7V4evBTU-wr0t8brDZAJE/view?usp=sharing" class="linkedin-btn" target="_blank">
                    📄 Access LinkedIn Guide
                </a>
            </div>
            <div class="message">
                We wish you immense success in your tech journey!<br><br>
                Best regards,<br>
                <strong>Team DataCrumbs</strong>
            </div>
        </div>
        <div class="footer">
            <div>Questions? Contact us at <strong>support@DataCrumbs.org</strong></div>
            <div style="margin-top: 8px; color: #64748B;">© DataCrumbs. All rights reserved.</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Dispatch Email with Attachment via Resend
 */
async function sendInternshipEmail({ studentName, programName, recipientEmail, buffer, certNo, dateStr }) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_USER || 'DataCrumbs <onboarding@resend.dev>';

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured in environment variables.');
  }

  const htmlContent = createInternshipEmailHtml(studentName, programName, certNo, dateStr);
  const filename = `${studentName.replace(/[^a-zA-Z0-9]+/g, '_')}_Internship_Certificate.png`;

  const resend = new Resend(resendApiKey);
  const response = await resend.emails.send({
    from: fromEmail,
    to: [recipientEmail],
    subject: `Internship Completion Certificate - ${studentName} (${programName})`,
    html: htmlContent,
    attachments: [
      {
        filename: filename,
        content: buffer,
      },
    ],
  });

  if (response.error) {
    throw new Error(`Resend Error: ${response.error.message}`);
  }

  console.log(`[OK] Resend email dispatched to ${recipientEmail}`);
}

/**
 * Get Google Spreadsheet Document instance
 */
async function getSpreadsheetDoc() {
  const spreadsheetId = process.env.INTERNSHIP_SPREADSHEET_ID || '1ppO4jhKzp3FyFTrft9LCakmnDxAw9oYX52tVI_NKdKw';
  
  let serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Fallback to credentials.json file if env vars are not defined
  const credentialsPath = path.join(process.cwd(), 'credentials.json');
  if (fs.existsSync(credentialsPath) && (!serviceAccountEmail || !privateKey)) {
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    serviceAccountEmail = creds.client_email;
    privateKey = creds.private_key;
  }

  if (!serviceAccountEmail || !privateKey) {
    throw new Error('Google Service Account credentials not configured.');
  }

  const serviceAccountAuth = new JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

/**
 * Batch Process Pending Certificates from Google Sheet
 */
async function processPendingInternshipCertificates(logger = console.log) {
  logger('[START] Connecting to Google Sheets...');
  const doc = await getSpreadsheetDoc();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();

  logger(`[INFO] Loaded ${rows.length} rows from ${sheet.title}.`);
  let count = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = row.get('Full Name') || row._rawData[1] || '';
    const email = row.get('Email Address') || row._rawData[2] || '';
    const programName = row.get('Internship Program') || row._rawData[3] || '6-Week Internship Program';
    let dateStr = row.get('Awarded Date') || row._rawData[4] || '';
    let certNo = row.get('Certificate No') || row._rawData[5] || '';
    const status = row.get('Certificate Status') || row._rawData[6] || '';

    if (!name || !email) continue;

    if (status.toLowerCase() !== 'sent' && status.toLowerCase() !== 'completed') {
      logger(`[PROCESSING] Row ${i + 2}: ${name} (${email})...`);
      try {
        const result = await generateInternshipCertificate({ name, dateStr, certNo, programName });
        certNo = result.certNo;
        dateStr = result.dateStr;

        await sendInternshipEmail({
          studentName: name,
          programName,
          recipientEmail: email,
          buffer: result.buffer,
          certNo,
          dateStr,
        });

        // Update sheet row
        row.set('Certificate Status', 'sent');
        row.set('Certificate No', certNo);
        row.set('Awarded Date', dateStr);
        await row.save();

        logger(`[SUCCESS] Row ${i + 2} (${name}) updated to 'sent'.`);
        count++;
      } catch (err) {
        logger(`[ERROR] Failed processing ${name}: ${err.message}`);
      }
    }
  }

  logger(`[DONE] Finished processing. ${count} certificate(s) sent.`);
  return { count };
}

module.exports = {
  generateInternshipCertificate,
  sendInternshipEmail,
  processPendingInternshipCertificates,
};
