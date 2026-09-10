from PIL import Image, ImageDraw, ImageFont
import gspread
from google.oauth2.service_account import Credentials
import os
import smtplib
import socket
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import re
import io
import time
from datetime import datetime
import pytz

load_dotenv()

# === CONFIGURATION ===
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly"
]

# Sheet configuration for Internship Certificates
SPREADSHEET_ID = os.getenv("INTERNSHIP_SPREADSHEET_ID", "1ppO4jhKzp3FyFTrft9LCakmnDxAw9oYX52tVI_NKdKw")
SHEET_NAME = os.getenv("INTERNSHIP_SHEET_NAME", "Sheet1")
CREDENTIALS_FILE = "credentials.json"

# Column indexes (1-based indexing)
TIMESTAMP_COLUMN = 1     # Column A - Timestamp / Code
NAME_COLUMN = 2          # Column B - Student Name
EMAIL_COLUMN = 3         # Column C - Student Email
PROGRAM_COLUMN = 4       # Column D - Internship Program Name (e.g. 6-Week Internship Program)
DATE_COLUMN = 5          # Column E - Awarded Date
CERT_NO_COLUMN = 6       # Column F - Certificate Number
CERTIFICATE_COLUMN = 7   # Column G - Certificate Status (e.g. 'sent')

OUTPUT_FOLDER = "certificates_output"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

TEMPLATE_PATH = "6-Week Internship Program.png"
FONT_NAME_PATH = "Poppins-Bold.ttf"
FONT_META_PATH = "Montserrat Bold 700.ttf"

# Target coordinates on 2000x1414 template
NAME_POSITION = (1065, 310)
DATE_POSITION = (1610, 1145)
CERT_NO_POSITION = (1610, 1190)

# Email credentials
EMAIL_USER = os.getenv("EMAIL_USER", "workshopcertificate@datacrumbs.org")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.sendgrid.net")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))


def get_credentials():
    """Get Google credentials for service account"""
    return Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)


def generate_internship_certificate(name, date_str=None, cert_no=None, program_name="6-Week Internship Program"):
    """
    Generate dynamic Internship Completion Certificate image.
    Overlay Name, Awarded Date, and Certificate Number on template.
    """
    name_display = name.strip().upper()
    
    if not os.path.exists(TEMPLATE_PATH):
        raise FileNotFoundError(f"Internship template '{TEMPLATE_PATH}' not found!")
    
    image = Image.open(TEMPLATE_PATH).convert("RGB")
    draw = ImageDraw.Draw(image)
    
    # Calculate responsive font size for student name to fit properly
    font_size = 55
    if len(name_display) > 25:
        font_size = 42
    elif len(name_display) > 20:
        font_size = 48

    try:
        font_name = ImageFont.truetype(FONT_NAME_PATH, font_size)
    except IOError:
        font_name = ImageFont.load_default()
        
    try:
        font_meta = ImageFont.truetype(FONT_META_PATH, 20)
    except IOError:
        font_meta = ImageFont.load_default()

    # Draw Name at (1065, 310)
    draw.text(NAME_POSITION, name_display, fill=(255, 255, 255), font=font_name)
    
    # Format Date
    if not date_str:
        pakistan_tz = pytz.timezone('Asia/Karachi')
        date_str = datetime.now(pakistan_tz).strftime("%B %d, %Y")
    
    # Draw Awarded Date at (1610, 1145)
    draw.text(DATE_POSITION, str(date_str), fill=(255, 255, 255), font=font_meta)
    
    # Draw Certificate Number at (1610, 1190)
    if not cert_no:
        cert_no = f"DC-INT-{datetime.now().year}-{hash(name) % 10000:04d}"
    draw.text(CERT_NO_POSITION, str(cert_no), fill=(255, 255, 255), font=font_meta)

    # Save output image
    sanitized_name = re.sub(r'[^a-zA-Z0-9]+', '_', name_display)
    output_filename = f"{sanitized_name}_Internship_Certificate.png"
    output_path = os.path.join(OUTPUT_FOLDER, output_filename)
    image.save(output_path)
    
    print(f"[OK] Internship Certificate generated for {name_display} ({output_path})")
    return output_path, cert_no, date_str


def create_internship_email_html(student_name, program_name, cert_no, date_str):
    """Generate HTML email body for Internship Completion"""
    pakistan_tz = pytz.timezone('Asia/Karachi')
    current_time = datetime.now(pakistan_tz).strftime("%B %d at %I:%M%p")
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Internship Completion Certificate</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Poppins', sans-serif;
            background: #0B1D16;
            color: #333333;
        }}
        
        .email-container {{
            max-width: 680px;
            margin: 30px auto;
            background: #FFFFFF;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0,0,0,0.3);
        }}
        
        .header {{
            background: linear-gradient(135deg, #052E16 0%, #14532D 50%, #166534 100%);
            padding: 40px 30px;
            text-align: center;
            color: #FFFFFF;
        }}
        
        .header img {{
            max-width: 180px;
            margin-bottom: 20px;
        }}
        
        .header h1 {{
            font-size: 26px;
            margin: 0;
            font-weight: 700;
            letter-spacing: 0.5px;
            color: #4ADE80;
        }}
        
        .header p {{
            font-size: 15px;
            margin-top: 8px;
            opacity: 0.9;
            color: #E2E8F0;
        }}
        
        .content {{
            padding: 35px 30px;
        }}
        
        .greeting {{
            font-size: 20px;
            font-weight: 600;
            color: #0F172A;
            margin-bottom: 15px;
        }}
        
        .message {{
            font-size: 15px;
            line-height: 1.7;
            color: #475569;
            margin-bottom: 25px;
        }}
        
        .cert-card {{
            background: #F0FDF4;
            border: 2px dashed #22C55E;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
            text-align: center;
        }}
        
        .cert-card h3 {{
            margin: 0 0 10px 0;
            color: #15803D;
            font-size: 18px;
        }}
        
        .cert-meta {{
            font-size: 14px;
            color: #334155;
            margin: 4px 0;
        }}
        
        .linkedin-box {{
            background: #F8FAFC;
            border-left: 4px solid #0A66C2;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        
        .linkedin-box h4 {{
            margin: 0 0 8px 0;
            color: #0A66C2;
            font-size: 16px;
        }}
        
        .linkedin-btn {{
            display: inline-block;
            background: #0A66C2;
            color: #FFFFFF !important;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            margin-top: 12px;
        }}
        
        .footer {{
            background: #0F172A;
            color: #94A3B8;
            padding: 25px;
            text-align: center;
            font-size: 13px;
        }}
        
        .social-icons {{
            margin-bottom: 15px;
        }}
        
        .social-icons a {{
            margin: 0 8px;
            display: inline-block;
        }}
        
        .social-icons img {{
            width: 32px;
            height: 32px;
            border-radius: 50%;
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="cid:logo_image" alt="DataCrumbs Logo">
            <h1>Internship Completion Certificate</h1>
            <p>{program_name}</p>
        </div>
        
        <div class="content">
            <div class="greeting">Dear {student_name},</div>
            <div class="message">
                Congratulations on successfully completing the <strong>{program_name}</strong> at <strong>DataCrumbs</strong>!
                <br><br>
                Throughout this intensive internship program, you demonstrated exceptional dedication, technical proficiency, and commitment to professional growth. Your hard work has truly paid off!
            </div>
            
            <div class="cert-card">
                <h3>🎓 Verified Certificate of Completion</h3>
                <div class="cert-meta"><strong>Certificate ID:</strong> {cert_no}</div>
                <div class="cert-meta"><strong>Issued Date:</strong> {date_str}</div>
                <div class="cert-meta" style="margin-top: 8px; color: #166534; font-weight: 500;">
                    Your official certificate is attached to this email as a high-resolution document.
                </div>
            </div>
            
            <div class="linkedin-box">
                <h4>🚀 Share Your Success on LinkedIn</h4>
                <div style="font-size: 14px; color: #475569;">
                    Showcase your internship achievement to your professional network and recruiters! We've prepared custom templates and guide for your announcement post.
                </div>
                <a href="https://drive.google.com/file/d/1X8xFBisAE7t7V4evBTU-wr0t8brDZAJE/view?usp=sharing" class="linkedin-btn" target="_blank">
                    📄 Access LinkedIn Sharing Guide
                </a>
            </div>
            
            <div class="message">
                We wish you immense success in your tech journey and future career endeavors!
                <br><br>
                Best regards,<br>
                <strong>Team DataCrumbs</strong>
            </div>
        </div>
        
        <div class="footer">
            <div class="social-icons">
                <a href="https://www.facebook.com/profile.php?id=61575071308188" target="_blank">
                    <img src="cid:facebook_icon" alt="Facebook">
                </a>
                <a href="https://www.instagram.com/datacrumbs_org/?hl=en" target="_blank">
                    <img src="cid:instagram_icon" alt="Instagram">
                </a>
                <a href="https://www.linkedin.com/company/datacrumbs/posts/?feedView=all" target="_blank">
                    <img src="cid:linkedin_icon" alt="LinkedIn">
                </a>
            </div>
            <div>Questions? Reach out to us at <strong>support@DataCrumbs.org</strong></div>
            <div style="margin-top: 8px; color: #64748B;">© DataCrumbs. All rights reserved.</div>
        </div>
    </div>
</body>
</html>"""


def send_internship_email(student_name, program_name, recipient_email, certificate_path, cert_no, date_str):
    """Send Internship Certificate email via SendGrid SMTP"""
    if not SENDGRID_API_KEY:
        raise ValueError("SENDGRID_API_KEY is not set in environment variables.")

    msg = MIMEMultipart('mixed')
    msg['Subject'] = f"Internship Completion Certificate - {student_name} ({program_name})"
    msg['From'] = EMAIL_USER
    msg['To'] = recipient_email

    related_part = MIMEMultipart('related')
    html_content = create_internship_email_html(student_name, program_name, cert_no, date_str)
    related_part.attach(MIMEText(html_content, 'html'))

    # Inline branding images
    images = {
        'logo_image': 'datacrumbslogo.png' if os.path.exists('datacrumbslogo.png') else 'logo.png',
        'facebook_icon': 'facebook_icon.png',
        'instagram_icon': 'instagram_icon.png',
        'linkedin_icon': 'linkedin_icon.png'
    }

    for cid, filename in images.items():
        if os.path.exists(filename):
            try:
                with open(filename, 'rb') as f:
                    img = MIMEImage(f.read())
                    img.add_header('Content-ID', f'<{cid}>')
                    img.add_header('Content-Disposition', 'inline')
                    related_part.attach(img)
            except Exception as e:
                print(f"[WARN] Could not inline image {filename}: {e}")

    msg.attach(related_part)

    # Attach Certificate PNG
    try:
        with open(certificate_path, 'rb') as f:
            cert_attachment = MIMEImage(f.read())
            cert_attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(certificate_path))
            msg.attach(cert_attachment)
            print(f"[OK] Certificate attached: {os.path.basename(certificate_path)}")
    except Exception as e:
        print(f"[WARN] Could not attach certificate file: {e}")

    # SMTP Delivery
    socket.setdefaulttimeout(60)
    sendgrid_user = "apikey"
    
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.starttls()
        server.login(sendgrid_user, SENDGRID_API_KEY)
        server.send_message(msg)

    print(f"[OK] Internship Certificate email successfully sent to {recipient_email}")


def process_internship_certificates(log_callback=print):
    """Read Google Sheet and process pending internship certificates"""
    log_callback("[START] Connecting to Google Sheets for Internship Certificates...")
    creds = get_credentials()
    client = gspread.authorize(creds)
    
    try:
        sheet = client.open_by_key(SPREADSHEET_ID)
        # Try worksheet by name, or default to first worksheet
        try:
            worksheet = sheet.worksheet(SHEET_NAME)
        except gspread.exceptions.WorksheetNotFound:
            log_callback(f"[WARN] Worksheet '{SHEET_NAME}' not found. Using primary sheet...")
            worksheet = sheet.get_worksheet(0)
            
        data = worksheet.get_all_values()
    except Exception as e:
        log_callback(f"[ERROR] Failed to access Google Sheet: {e}")
        return

    if len(data) <= 1:
        log_callback("[INFO] No rows found in the sheet.")
        return

    log_callback(f"[INFO] Found {len(data) - 1} records in the sheet.")
    processed_count = 0

    for idx, row in enumerate(data[1:], start=2):
        name = row[NAME_COLUMN - 1].strip() if len(row) >= NAME_COLUMN else ""
        email = row[EMAIL_COLUMN - 1].strip() if len(row) >= EMAIL_COLUMN else ""
        program_name = row[PROGRAM_COLUMN - 1].strip() if len(row) >= PROGRAM_COLUMN and row[PROGRAM_COLUMN - 1].strip() else "6-Week Internship Program"
        date_str = row[DATE_COLUMN - 1].strip() if len(row) >= DATE_COLUMN else ""
        cert_no = row[CERT_NO_COLUMN - 1].strip() if len(row) >= CERT_NO_COLUMN else ""
        certificate_status = row[CERTIFICATE_COLUMN - 1].strip() if len(row) >= CERTIFICATE_COLUMN else ""

        if not name or not email:
            continue

        if certificate_status.lower() not in ["sent", "completed"]:
            log_callback(f"[PROCESSING] Row {idx}: {name} ({email})...")
            try:
                cert_path, generated_cert_no, generated_date = generate_internship_certificate(
                    name=name,
                    date_str=date_str,
                    cert_no=cert_no,
                    program_name=program_name
                )

                # Send email
                send_internship_email(
                    student_name=name,
                    program_name=program_name,
                    recipient_email=email,
                    certificate_path=cert_path,
                    cert_no=generated_cert_no,
                    date_str=generated_date
                )

                # Update status in Google Sheet
                worksheet.update_cell(idx, CERTIFICATE_COLUMN, "sent")
                if not cert_no:
                    worksheet.update_cell(idx, CERT_NO_COLUMN, generated_cert_no)
                if not date_str:
                    worksheet.update_cell(idx, DATE_COLUMN, generated_date)

                log_callback(f"[SUCCESS] Row {idx} marked as 'sent'")
                processed_count += 1

                # Clean up local output file
                if os.path.exists(cert_path):
                    os.remove(cert_path)

            except Exception as e:
                log_callback(f"[ERROR] Error processing {name}: {e}")

    log_callback(f"[DONE] Process completed! {processed_count} internship certificate(s) sent.")


if __name__ == "__main__":
    process_internship_certificates()
