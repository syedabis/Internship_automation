from PIL import Image, ImageDraw, ImageFont
import gspread
from google.oauth2.service_account import Credentials
import os
import smtplib
import socket
from email.message import EmailMessage
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import re
import io
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import tempfile

load_dotenv()

# === CONFIGURATION ===

# Add Google Drive scope
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly"
]

SHEET_NAME = "Sheet1"
SHEET2_NAME = "Sheet2"  # The sheet where codes are listed
SPREADSHEET_ID = "1CaUSBO0W9doKENqKSAhOBJB4dk_eqXpwGgkrvx8KyUA"
CREDENTIALS_FILE = "credentials.json"

# Google Drive folder ID where templates are stored
TEMPLATE_FOLDER_ID = os.getenv("TEMPLATE_FOLDER_ID", "1AS76tfCZqy4Q7UFKFJonDZseIiL3USs8")

TIMESTAMP_COLUMN = 1    # Column A - Timestamp (1-based indexing)
CODE_COLUMN = 2         # Column B - Code
NAME_COLUMN = 3         # Column C - Name
EMAIL_COLUMN = 4        # Column D - Email
CERTIFICATE_COLUMN = 10  # Column J (where "Certificate" status is stored)
WORKSHOP_COLUMN = 9     # Column I (for workshop name)

OUTPUT_FOLDER = "certificates_output"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

FONT_PATH = "Staatliches-Regular.ttf"  # Make sure this file exists
FONT_SIZE = 150
FONT_COLOR = (255, 255, 255)  # White
NAME_POSITION = (0, 680)  # x will be recalculated dynamically, y stays fixed

# --- Email config ---
EMAIL_USER = os.getenv("EMAIL_USER")              # e.g. workshopcertificate@datacrumbs.org
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")  # SendGrid API key
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.sendgrid.net")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))      # Use 587 for TLS


def get_credentials():
    """Get Google credentials for both Sheets and Drive"""
    return Credentials.from_service_account_file(CREDENTIALS_FILE, scopes=SCOPES)


def get_filename_from_sheet(workshop_name):
    """Get filename from Sheet2 based on workshop name"""
    try:
        creds = get_credentials()
        client = gspread.authorize(creds)
        sheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = sheet.worksheet(SHEET2_NAME)
        data = worksheet.get_all_values()
        
        if not data:
            return None
        
        # Find workshop and filename column indexes
        header = data[0]
        try:
            workshop_col_index = header.index("workshop")
            filename_col_index = header.index("filename")
        except ValueError:
            print("[⚠️] 'workshop' or 'filename' column not found in Sheet2")
            return None
        
        # Find the row with matching workshop name and return filename
        for row in data[1:]:
            if row and len(row) > max(workshop_col_index, filename_col_index):
                if row[workshop_col_index].strip() == workshop_name:
                    return row[filename_col_index].strip()
        
        return None
    except Exception as e:
        print(f"[⚠️] Error fetching filename from Sheet2: {e}")
        return None


def get_workshop_names_from_sheet():
    """Get all unique workshop names from Sheet2"""
    try:
        creds = get_credentials()
        client = gspread.authorize(creds)
        sheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = sheet.worksheet(SHEET2_NAME)
        data = worksheet.get_all_values()
        
        if not data:
            return []
        
        # Find workshop column index
        header = data[0]
        try:
            workshop_col_index = header.index("workshop")
        except ValueError:
            print("[⚠️] 'workshop' column not found in Sheet2")
            return []
        
        # Get unique workshop names
        workshop_names = set()
        for row in data[1:]:
            if row and len(row) > workshop_col_index:
                workshop_name = row[workshop_col_index].strip()
                if workshop_name:
                    workshop_names.add(workshop_name)
        
        return list(workshop_names)
    except Exception as e:
        print(f"[⚠️] Error fetching workshop names: {e}")
        return []


def find_template_in_drive(workshop_name):
    """Find template file in Google Drive for a specific workshop"""
    try:
        if not TEMPLATE_FOLDER_ID:
            print("[⚠️] TEMPLATE_FOLDER_ID not configured. Please add it to your .env file")
            return None
            
        # First, get the filename from Sheet2 based on workshop name
        filename = get_filename_from_sheet(workshop_name)
        if not filename:
            print(f"[⚠️] No filename found in Sheet2 for workshop: {workshop_name}")
            return None
            
        print(f"[🔍] Looking for template file: '{filename}' in Drive folder: {TEMPLATE_FOLDER_ID}")
        
        creds = get_credentials()
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Search for files in the template folder with EXACT filename
        query = f"'{TEMPLATE_FOLDER_ID}' in parents and name = '{filename}' and (mimeType contains 'image/png' or mimeType contains 'image/jpeg')"
        print(f"[🔍] Drive query: {query}")
        
        results = drive_service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, mimeType)'
        ).execute()
        
        files = results.get('files', [])
        print(f"[🔍] Found {len(files)} files matching query")
        
        if not files:
            print(f"[⚠️] No template found for filename: {filename}")
            # Let's also check what files ARE in the folder
            all_files_query = f"'{TEMPLATE_FOLDER_ID}' in parents"
            all_results = drive_service.files().list(
                q=all_files_query,
                spaces='drive',
                fields='files(id, name, mimeType)'
            ).execute()
            all_files = all_results.get('files', [])
            print(f"[🔍] All files in template folder: {[f['name'] for f in all_files]}")
            return None
        
        # Return the first matching file
        template_file = files[0]
        print(f"✅ Found template: {template_file['name']} for workshop: {workshop_name}")
        return template_file
        
    except Exception as e:
        print(f"[⚠️] Error searching Drive for template: {e}")
        return None


def download_template_from_drive(file_id, workshop_name):
    """Download template from Google Drive to local storage"""
    try:
        creds = get_credentials()
        drive_service = build('drive', 'v3', credentials=creds)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
            request = drive_service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                if status:
                    print(f"Download {int(status.progress() * 100)}%")
            
            fh.seek(0)
            temp_file.write(fh.read())
            temp_file_path = temp_file.name
        
        print(f"✅ Template downloaded for {workshop_name}")
        return temp_file_path
        
    except Exception as e:
        print(f"[⚠️] Error downloading template: {e}")
        return None


def get_template_path(workshop_name):
    """Get template path - first try Drive, then fallback to local files"""
    # First, try to find template in Google Drive
    template_file = find_template_in_drive(workshop_name)
    
    if template_file:
        # Download template from Drive
        local_path = download_template_from_drive(template_file['id'], workshop_name)
        if local_path:
            return local_path
    
    # Fallback to local template files (existing behavior)
    sanitized_name = re.sub(r'[^a-zA-Z0-9]+', '_', workshop_name.lower()).strip('_')
    filename = f"{sanitized_name}_template.png"
    
    if os.path.exists(filename):
        return filename
    
    # If no template found anywhere, raise error
    raise FileNotFoundError(f"No template found for workshop '{workshop_name}' in Drive or local files")


def convert_png_to_pdf(png_path):
    image = Image.open(png_path)
    pdf_path = png_path.replace(".png", ".pdf")
    rgb_image = image.convert('RGB')  # PIL requires RGB mode for PDF
    rgb_image.save(pdf_path, "PDF", resolution=100.0)
    return pdf_path


# Email function will be defined locally to avoid circular import

def create_email_image(student_name, workshop_name):
    """Import and use the email image generator from separate file"""
    try:
        from email_image_generator import create_email_image as generate_email_image
        return generate_email_image(student_name, workshop_name)
    except ImportError:
        print("⚠️ email_image_generator.py not found, using fallback method")
        # Fallback to original method if separate file doesn't exist
        return None
    except Exception as e:
        print(f"❌ Failed to create email image: {e}")
        return None

def send_certificate_email(student_name, workshop_name, recipient_email, certificate_path):
    """Send beautiful certificate email as image with MIME support"""
    try:
        # Create the MIME object
        msg = MIMEMultipart('mixed')
        msg['Subject'] = f"{student_name} - Your {workshop_name} Certificate & LinkedIn Guide"
        msg['From'] = EMAIL_USER
        msg['To'] = recipient_email
        
        # No BCC

        # Use HTML template with CID images (reliable method)
        print("Using HTML template with CID images (reliable method)")
        
        # Import footer HTML
        footer_html = ""
        try:
            from email_footer_template import create_email_footer_html
            footer_html = create_email_footer_html()
        except ImportError:
            print("Footer template not found, sending without footer")
        except Exception as e:
            print(f"Error loading footer template: {e}")
        
        # Read the template1.html file - ALWAYS use template1.html
        template_path = os.path.join(os.path.dirname(__file__), "template1.html")
        template_used = None
        
        try:
            # Try absolute path first
            if os.path.exists(template_path):
                with open(template_path, "r", encoding="utf-8") as f:
                    template_content = f.read()
                template_used = template_path
                print(f"[✅] Using template1.html from: {template_path}")
            elif os.path.exists("template1.html"):
                # Try relative path
                with open("template1.html", "r", encoding="utf-8") as f:
                    template_content = f.read()
                template_used = "template1.html (relative)"
                print(f"[✅] Using template1.html from: template1.html (current directory)")
            else:
                raise FileNotFoundError("template1.html not found in current directory or script directory")
            
            # Replace placeholders
            html_content = template_content.replace("{student_name}", student_name)
            html_content = html_content.replace("{workshop_name}", workshop_name)
            
            print(f"[📧] Template loaded successfully: {template_used}")
            
        except FileNotFoundError as e:
            print(f"[❌] ERROR: template1.html not found!")
            print(f"[❌] Searched paths:")
            print(f"     - {template_path}")
            print(f"     - template1.html (current directory)")
            print(f"[❌] Current working directory: {os.getcwd()}")
            print(f"[❌] Script directory: {os.path.dirname(__file__)}")
            raise FileNotFoundError(f"template1.html is required but not found. Error: {e}")
        except Exception as e:
            print(f"[❌] Error loading template1.html: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to load template1.html: {e}")
        
        # Create the related part for HTML and inline images
        related_part = MIMEMultipart('related')
        html_part = MIMEText(html_content, 'html')
        related_part.attach(html_part)
        
        # Attach images as inline MIME for template1.html
        images = {
            'logo': 'logo.png',  # DataCrumbs logo
            'background': 'email-bg.png' if os.path.exists('email-bg.png') else 'email-bg.jpg',  # Background image
            'loudspeaker': 'Loudspeaker.png',  # Share box icon
        }
        
        for cid, filename in images.items():
             try:
                 # Skip None values (used for conditional images)
                 if filename is None:
                     continue
                     
                 if os.path.exists(filename):
                     file_size = os.path.getsize(filename)
                     file_size_kb = file_size / 1024
                     
                     # Read image file as-is (no compression)
                     with open(filename, 'rb') as f:
                         img_data = f.read()
                     
                     img = MIMEImage(img_data)
                     img.add_header('Content-ID', f'<{cid}>')
                     img.add_header('Content-Disposition', 'inline')
                     related_part.attach(img)
                     print(f"✅ Image {filename} attached with CID: <{cid}> ({file_size_kb:.1f}KB)")
                 else:
                     print(f"⚠️ Image {filename} not found, skipping...")
             except Exception as e:
                 print(f"❌ Failed to attach {filename}: {e}")
                 import traceback
                 traceback.print_exc()
                 # Don't fail the whole email if one image fails
        
        msg.attach(related_part)

        # Check total email size before sending (SendGrid limit is ~30MB)
        try:
            email_size = len(msg.as_bytes())
            email_size_mb = email_size / (1024 * 1024)
            print(f"[📊] Total email size: {email_size_mb:.2f}MB")
            if email_size_mb > 30:
                raise ValueError(f"Email size ({email_size_mb:.2f}MB) exceeds SendGrid limit (30MB). Please reduce image sizes.")
            elif email_size_mb > 25:
                print(f"⚠️ Warning: Email size ({email_size_mb:.2f}MB) is very large, may cause delivery issues")
        except Exception as e:
            print(f"⚠️ Could not calculate email size: {e}")
            if "exceeds" in str(e):
                raise

        # Attach the certificate
        try:
            with open(certificate_path, 'rb') as f:
                cert_attachment = MIMEImage(f.read())
                cert_attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(certificate_path))
                msg.attach(cert_attachment)
                print(f"✅ Certificate attached: {os.path.basename(certificate_path)}")
        except Exception as e:
            print(f"⚠️ Could not attach certificate: {e}")

        # Send the email using SendGrid SMTP
        smtp_server = os.getenv("SMTP_SERVER", "smtp.sendgrid.net")
        initial_port = int(os.getenv("SMTP_PORT", "587"))
        sendgrid_user = "apikey"
        sendgrid_api_key = os.getenv("SENDGRID_API_KEY")
        
        if not sendgrid_api_key:
            raise ValueError("SENDGRID_API_KEY is not set. Cannot send email.")

        print(f"[📧] Attempting to send email via {smtp_server}")
        print(f"[📧] From: {EMAIL_USER}")
        print(f"[📧] To: {recipient_email}")
        
        # Try ports in order: initial port, then 465 (SSL) as fallback
        ports_to_try = [initial_port]
        if initial_port != 465:
            ports_to_try.append(465)  # Add SSL port as fallback
        
        # Set timeout for SMTP connection (60 seconds for large emails)
        socket.setdefaulttimeout(60)
        
        # Retry logic for intermittent connection issues
        max_retries = 3
        retry_delay = 2  # seconds between retries
        
        import time
        last_error = None
        email_sent = False
        
        for port_index, smtp_port in enumerate(ports_to_try):
            if email_sent:
                break
                
            print(f"[🔍] Trying port {smtp_port} ({'SSL' if smtp_port == 465 else 'TLS'})...")
            
            # Quick network connectivity test before SMTP connection
            print(f"[🔍] Testing network connectivity to {smtp_server}:{smtp_port}...")
            import sys
            sys.stdout.flush()
            
            port_reachable = False
            try:
                test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                test_socket.settimeout(5)  # Quick 5 second test
                result = test_socket.connect_ex((smtp_server, smtp_port))
                test_socket.close()
                
                if result == 0:
                    print(f"[✅] Network connectivity OK - port {smtp_port} is reachable")
                    port_reachable = True
                else:
                    print(f"[⚠️] Network test failed - port {smtp_port} may be blocked (error code: {result})")
                    if port_index < len(ports_to_try) - 1:
                        print(f"[💡] Will try next port...")
                sys.stdout.flush()
            except Exception as net_test_error:
                print(f"[⚠️] Network test error: {net_test_error}")
                if port_index < len(ports_to_try) - 1:
                    print(f"[💡] Will try next port...")
                sys.stdout.flush()
            
            # Skip this port if not reachable and we have more ports to try
            if not port_reachable and port_index < len(ports_to_try) - 1:
                print(f"[⏭️] Skipping port {smtp_port}, trying next port...")
                continue
            
            for attempt in range(1, max_retries + 1):
                server = None
                try:
                    if attempt > 1:
                        wait_time = retry_delay * (2 ** (attempt - 2))  # Exponential backoff: 2s, 4s
                        print(f"[🔄] Retry attempt {attempt}/{max_retries} after {wait_time}s delay...")
                        sys.stdout.flush()
                        time.sleep(wait_time)
                    
                    print(f"[🔍] DEBUG: Attempt {attempt}/{max_retries} - Creating SMTP connection...")
                    print(f"[🔍] DEBUG: smtp_server={smtp_server}, smtp_port={smtp_port}, timeout=60")
                    sys.stdout.flush()
                    
                    # Port 465 uses SSL, port 587 uses TLS
                    if smtp_port == 465:
                        print(f"[🔐] Using SSL connection (port 465)...")
                        print(f"[🔐] Connecting to {smtp_server}:{smtp_port}...")
                        server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=60)
                        print(f"[✅] SSL connection established")
                        print(f"[🔐] Logging in...")
                        server.login(sendgrid_user, sendgrid_api_key)
                        print(f"[✅] Login successful")
                        print(f"[📤] Sending email (this may take a while for large emails)...")
                        sys.stdout.flush()
                        
                        # Check if server is still connected before sending
                        try:
                            server.noop()  # Check if connection is still alive
                        except:
                            print(f"[⚠️] Connection lost, reconnecting...")
                            server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=60)
                            server.login(sendgrid_user, sendgrid_api_key)
                        
                        # Send email with timeout handling
                        send_start = time.time()
                        server.send_message(msg)
                        send_elapsed = time.time() - send_start
                        print(f"[✅] Email sent successfully! (took {send_elapsed:.2f}s)")
                        sys.stdout.flush()
                        email_sent = True
                        # Success - break out of retry loop
                        break
                    else:
                        print(f"[🔐] Using TLS connection (port {smtp_port})...")
                        print(f"[🔐] Connecting to {smtp_server}:{smtp_port}...")
                        sys.stdout.flush()
                        
                        print(f"[🔍] DEBUG: Creating SMTP object...")
                        sys.stdout.flush()
                        start_time = time.time()
                        
                        server = smtplib.SMTP(smtp_server, smtp_port, timeout=60)
                        elapsed = time.time() - start_time
                        print(f"[✅] Connected to SMTP server (took {elapsed:.2f}s)")
                        sys.stdout.flush()
                         
                        print(f"[🔐] Starting TLS...")
                        sys.stdout.flush()
                        tls_start = time.time()
                        server.starttls()
                        tls_elapsed = time.time() - tls_start
                        print(f"[✅] TLS started (took {tls_elapsed:.2f}s)")
                        sys.stdout.flush()
                        
                        print(f"[🔐] Logging in with user: {sendgrid_user}...")
                        sys.stdout.flush()
                        login_start = time.time()
                        server.login(sendgrid_user, sendgrid_api_key)
                        login_elapsed = time.time() - login_start
                        print(f"[✅] Login successful (took {login_elapsed:.2f}s)")
                        sys.stdout.flush()
                        
                        print(f"[📤] Sending email (this may take a while for large emails)...")
                        print(f"[🔍] DEBUG: Email size: {len(msg.as_bytes()) / (1024*1024):.2f}MB")
                        sys.stdout.flush()
                        send_start = time.time()
                        server.send_message(msg)
                        send_elapsed = time.time() - send_start
                        print(f"[✅] Email sent successfully! (took {send_elapsed:.2f}s)")
                        sys.stdout.flush()
                        email_sent = True
                        # Success - break out of retry loop
                        break
                        
                except (socket.timeout, socket.error, ConnectionError) as conn_error:
                    last_error = conn_error
                    print(f"[❌] Attempt {attempt}/{max_retries} failed: {conn_error}")
                    if attempt < max_retries:
                        wait_time = retry_delay * (2 ** (attempt - 1))
                        print(f"[💡] Will retry in {wait_time}s...")
                    sys.stdout.flush()
                    # Clean up connection before retry
                    if server:
                        try:
                            server.quit()
                        except:
                            try:
                                server.close()
                            except:
                                pass
                    server = None
                    if attempt == max_retries and port_index == len(ports_to_try) - 1:
                        # Last port, last attempt - raise error
                        raise ConnectionError(f"SMTP connection failed after {max_retries} attempts on all ports: {conn_error}")
                    elif attempt == max_retries:
                        # Last attempt on this port, but more ports to try
                        print(f"[⏭️] Port {smtp_port} failed, trying next port...")
                        break
                        
                except smtplib.SMTPAuthenticationError as auth_error:
                    # Don't retry auth errors
                    if server:
                        try:
                            server.quit()
                        except:
                            pass
                    raise ValueError(f"SMTP Authentication failed: Invalid API key or credentials. Error: {auth_error}")
                    
                except Exception as e:
                    last_error = e
                    print(f"[❌] Attempt {attempt}/{max_retries} failed: {e}")
                    import traceback
                    traceback.print_exc()
                    # Clean up connection before retry
                    if server:
                        try:
                            server.quit()
                        except:
                            try:
                                server.close()
                            except:
                                pass
                    server = None
                    if attempt == max_retries and port_index == len(ports_to_try) - 1:
                        # Last port, last attempt - raise error
                        raise ConnectionError(f"SMTP connection failed after {max_retries} attempts on all ports: {e}")
                    elif attempt == max_retries:
                        # Last attempt on this port, but more ports to try
                        print(f"[⏭️] Port {smtp_port} failed, trying next port...")
                        break
                        
                finally:
                    # Always close connection properly
                    if server and not email_sent:
                        try:
                            server.quit()
                            print(f"[✅] Connection closed")
                            sys.stdout.flush()
                        except:
                            try:
                                server.close()
                            except:
                                pass
            
            if email_sent:
                break
        
        if not email_sent:
            raise ConnectionError(f"Failed to send email after trying all ports ({', '.join(map(str, ports_to_try))})")
        
        # Small delay between emails to avoid rate limiting
        time.sleep(1)
            
        print(f"✅ Certificate email sent successfully to {recipient_email}")
        print(f"📧 Subject: {student_name} - Your {workshop_name} Certificate & LinkedIn Guide")
        print(f"👤 Student: {student_name}")
        print(f"🎓 Workshop: {workshop_name}")
        
    except Exception as e:
        print(f"❌ Failed to send certificate email: {e}")
        raise  # Re-raise exception so main() can catch it and mark as failed


def read_data_from_sheet(sheet_name):
    creds = get_credentials()
    client = gspread.authorize(creds)
    sheet = client.open_by_key(SPREADSHEET_ID)
    worksheet = sheet.worksheet(sheet_name)
    data = worksheet.get_all_values()
    return worksheet, data


def generate_certificate(name, workshop_name):
    name = name.upper()
    template_path = get_template_path(workshop_name)

    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Template '{template_path}' not found for workshop '{workshop_name}'")

    image = Image.open(template_path)
    draw = ImageDraw.Draw(image)
    
    # Workshop-specific settings (you can customize these per workshop)
    workshop_settings = {
        "AI-Powered Website & Chatbot Masterclass": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "Building AI Voice Agents Masterclass": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "Making Web Apps With Streamlit Masterclass": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "Automate Lead Scraping Like a Pro": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "AI for Business Branding": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "Career Accelerator": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 100,
            "y_position": 600,
            "font_color": (26, 48, 80)
        },
        "Mastering AI Email Agents": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "AI-Powered Design with Google Stitch": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
        "Building AI Voice Agents with Vapi": {
            "font_path": "Poppins-Bold.ttf",
            "font_size": 65,
            "y_position": 430,
            "font_color": (0, 0, 0)  # Black color
        },
    }
    
    # Use workshop-specific settings or defaults
    settings = workshop_settings.get(workshop_name, {
        "font_path": FONT_PATH,
        "font_size": FONT_SIZE,
        "y_position": NAME_POSITION[1],
        "font_color": FONT_COLOR
    })
    
    font = ImageFont.truetype(settings["font_path"], settings["font_size"])

    image_width, _ = image.size
    bbox = draw.textbbox((0, 0), name, font=font)
    text_width = bbox[2] - bbox[0]

    # For "AI-Powered Website & Chatbot Masterclass", use left alignment
    if workshop_name in ["AI-Powered Website & Chatbot Masterclass", "Building AI Voice Agents Masterclass", "Making Web Apps With Streamlit Masterclass", "Automate Lead Scraping Like a Pro", "AI for Business Branding", "Mastering AI Email Agents", "AI-Powered Design with Google Stitch", "Building AI Voice Agents with Vapi"]:
        x = 250  # Left alignment with 250px margin from left edge
    elif workshop_name == "Career Accelerator":
        x = 750  # Center alignment with 750px margin from left edge
    else:
        x = (image_width - text_width) / 2  # Center alignment for other workshops

    y = settings["y_position"]

    draw.text((x, y), name, fill=settings["font_color"], font=font)

    output_path = os.path.join(OUTPUT_FOLDER, f"{name}_{workshop_name.replace(' ', '_')}_certificate.png")
    image.save(output_path)
    print(f"✅ Certificate generated for {name} ({workshop_name})")
    
    # Clean up downloaded template if it was from Drive
    if template_path.startswith(tempfile.gettempdir()):
        try:
            os.remove(template_path)
            print(f"[🗑️] Cleaned up temporary template: {template_path}")
        except:
            pass
    
    return output_path


def main():
    # First, get available workshop names
    available_workshops = get_workshop_names_from_sheet()
    print(f"📋 Available workshops: {', '.join(available_workshops)}")
    
    worksheet1, data1 = read_data_from_sheet(SHEET_NAME)
    worksheet2, data2 = read_data_from_sheet(SHEET2_NAME)

    # Find the column indexes for 'code' and 'workshop' in Sheet2 header
    header2 = data2[0]
    try:
        code_col_index_sheet2 = header2.index("code")
        workshop_col_index_sheet2 = header2.index("workshop")
    except ValueError:
        print("[⚠️] 'code' or 'workshop' column not found in Sheet2")
        return

    # Build a set of valid (code, workshop) tuples from Sheet2
    valid_code_workshop_pairs = set()
    for row in data2[1:]:
        if row and len(row) > max(code_col_index_sheet2, workshop_col_index_sheet2):
            code_val = row[code_col_index_sheet2].strip()
            workshop_val = row[workshop_col_index_sheet2].strip()
            if code_val and workshop_val:
                valid_code_workshop_pairs.add((code_val, workshop_val))

    for idx, row in enumerate(data1[1:], start=2):
        code = row[CODE_COLUMN - 1].strip() if len(row) >= CODE_COLUMN else ""
        name = row[NAME_COLUMN - 1].strip() if len(row) >= NAME_COLUMN else ""
        email = row[EMAIL_COLUMN - 1].strip() if len(row) >= EMAIL_COLUMN else ""
        certificate_status = row[CERTIFICATE_COLUMN - 1].strip() if len(row) >= CERTIFICATE_COLUMN else ""
        workshop_name = row[WORKSHOP_COLUMN - 1].strip() if len(row) >= WORKSHOP_COLUMN else "Workshop"

        # Debug output
        print(f"[DEBUG] Row {idx}: code='{code}', name='{name}', email='{email}', workshop='{workshop_name}', status='{certificate_status}'")
        
        if certificate_status == "":
            if not code:
                print(f"[⚠️] No code provided by {name}, marking as wrong information.")
                worksheet1.update_cell(idx, CERTIFICATE_COLUMN, "wrong information")
                continue

            if (code, workshop_name) not in valid_code_workshop_pairs:
                print(f"[⚠️] Invalid code '{code}' or workshop '{workshop_name}' for {name}, marking as wrong information.")
                worksheet1.update_cell(idx, CERTIFICATE_COLUMN, "wrong information")
                continue

            try:
                cert_path = generate_certificate(name, workshop_name)

                # Send beautiful certificate email using function from main.py (no BCC)
                send_certificate_email(name, workshop_name, email, cert_path)

                worksheet1.update_cell(idx, CERTIFICATE_COLUMN, "sent")
                print(f"Updated row {idx} Certificate column to 'sent'")
                # ✅ Delete certificate after sending
                os.remove(cert_path)
                print(f"[🗑️] Deleted file {cert_path}")

            except Exception as e:
                print(f"[❌] Failed to process {name}: {e}")
                # Mark as failed in the certificate column
                try:
                    worksheet1.update_cell(idx, CERTIFICATE_COLUMN, "failed")
                    print(f"[❌] Updated row {idx} Certificate column to 'failed'")
                except Exception as update_error:
                    print(f"[⚠️] Could not update status for row {idx}: {update_error}")
                
                # Clean up certificate file if it was created
                try:
                    if 'cert_path' in locals() and os.path.exists(cert_path):
                        os.remove(cert_path)
                        print(f"[🗑️] Cleaned up failed certificate: {cert_path}")
                except:
                    pass


if __name__ == "__main__":
    main()
