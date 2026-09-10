import os
import base64
from datetime import datetime
import pytz

def encode_image_to_base64(image_path):
    """Encode image to base64 for inline use in HTML"""
    try:
        with open(image_path, "rb") as image_file:
            encoded_string = base64.b64encode(image_file.read()).decode()
            return f"data:image/png;base64,{encoded_string}"
    except Exception as e:
        print(f"⚠️ Could not encode {image_path}: {e}")
        return None

def certificate_email_template(student_name, workshop_name):
    """Generate certificate email HTML template with base64 encoded images"""
    
    # Get current Pakistani time
    pakistan_tz = pytz.timezone('Asia/Karachi')
    current_time = datetime.now(pakistan_tz)
    formatted_time = current_time.strftime("%B %d at %I:%M%p")
    
    # Encode images to base64
    logo_base64 = encode_image_to_base64("datacrumbslogo.png")
    profile_base64 = encode_image_to_base64("profilecirclelogo.png")
    facebook_base64 = encode_image_to_base64("facebook_icon.png")
    instagram_base64 = encode_image_to_base64("instagram_icon.png")
    linkedin_base64 = encode_image_to_base64("linkedin_icon.png")
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate Email</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        html {{
            background:
                linear-gradient(to bottom, transparent 0%, transparent 85%, #f8f4ff 85%, #f8f4ff 100%),
                linear-gradient(to right, #1a4a4a 0%, #2d4b6b 25%, #4a2d6b 50%, #6b2d6b 75%, #8b2d8b 100%);
            margin: 0;
            padding: 0;
            height: 100%;
        }}
        
        body {{
            margin: 0;
            padding: 0;
            font-family: 'Cabin', sans-serif;
            height: auto;
            width: 100%;
            background:
                linear-gradient(to bottom, transparent 0%, transparent 85%, #f8f4ff 85%, #f8f4ff 100%),
                linear-gradient(to right, #1a4a4a 0%, #2d4b6b 25%, #4a2d6b 50%, #6b2d6b 75%, #8b2d8b 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }}
        
        /* Hide scrollbars */
        ::-webkit-scrollbar {{
            display: none;
        }}
        
        * {{
            -ms-overflow-style: none;
            scrollbar-width: none;
        }}
        
        .email-container {{
            width: 700px;
            max-width: 98vw;
            height: auto;
            background:
                linear-gradient(to bottom, transparent 0%, transparent 85%, #f8f4ff 85%, #f8f4ff 100%),
                linear-gradient(to right, #1a4a4a 0%, #2d4b6b 25%, #4a2d6b 50%, #6b2d6b 75%, #8b2d8b 100%);
            position: relative;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            margin: 0 auto;
            z-index: 10;
            box-sizing: border-box;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }}
        
        .email-container::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0);
            background-size: 3px 3px;
            pointer-events: none;
            z-index: 1;
        }}
        
        .email-content {{
            position: relative;
            z-index: 2;
            background: transparent;
            height: 100%;
        }}
        
        .header {{
            padding: 5px 50px 0px 50px;
            min-height: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: transparent;
        }}
        
        .logo-button {{
            width: 60px;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            cursor: pointer;
            background: transparent;
            flex-shrink: 0;
            margin-left: 20px;
        }}
        
        .logo-button img {{
            width: 120px;
            height: 120px;
            object-fit: contain;
        }}
        
        .workshop-title {{
            font-family: 'Inter', sans-serif;
            font-style: normal;
            font-weight: 700;
            font-size: 20px;
            line-height: 24px;
            color: #FFFFFF;
            text-align: right;
            margin-left: auto;
            display: flex;
            align-items: center;
        }}
        
        .content {{
            padding: 10px 30px;
            background: transparent;
            overflow-x: hidden;
        }}
        
        .white-content-container {{
            background: #FFFFFF;
            padding: 30px 20px 0px 20px;
            border-radius: 12px;
            margin-bottom: 0px;
            max-width: 580px;
            margin-left: auto;
            margin-right: auto;
            overflow-x: hidden;
        }}
        
        .greeting {{
            font-family: 'Cabin';
            font-style: normal;
            font-weight: 600;
            font-size: 18px;
            line-height: 22px;
            color: #333333;
            margin-bottom: 20px;
            text-align: center;
        }}
        
        .intro-text {{
            font-family: 'Cabin';
            font-style: normal;
            font-weight: 400;
            font-size: 16px;
            line-height: 24px;
            color: #666666;
            margin-bottom: 30px;
        }}
        
        .certificate-section {{
            background: #F8F9FF;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
        }}
        
        .certificate-text {{
            font-family: 'Poppins';
            font-style: normal;
            font-weight: 700;
            font-size: 24px;
            line-height: 36px;
            color: #5F51FF;
            margin-bottom: 20px;
            text-align: center;
        }}
        
        .certificate-description {{
            font-family: 'Cabin';
            font-style: normal;
            font-weight: 400;
            font-size: 16px;
            line-height: 24px;
            color: #333333;
        }}
        
        .linkedin-section {{
            background: #FFF8F0;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
        }}
        
        .linkedin-title {{
            font-family: 'Poppins';
            font-style: normal;
            font-weight: 700;
            font-size: 20px;
            line-height: 30px;
            color: #FF6B35;
            margin-bottom: 15px;
        }}
        
        .linkedin-text {{
            font-family: 'Cabin';
            font-style: normal;
            font-weight: 400;
            font-size: 16px;
            line-height: 24px;
            color: #333333;
            margin-bottom: 20px;
        }}
        
        .linkedin-link {{
            display: inline-block;
            background: #FF6B35;
            color: #FFFFFF;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-family: 'Cabin';
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
        }}
        
        .linkedin-link:hover {{
            background: #E55A2B;
            transform: translateY(-2px);
        }}
        

        
        .social-links {{
            display: none;
        }}
        
        .social-icon {{
            display: none;
        }}
        
        .social-icon:hover {{
            display: none;
        }}
        
        .social-icon img {{
            display: none;
        }}
        
        .footer {{
            display: none;
        }}
        
        .contact-info {{
            display: none;
        }}
        
        .copyright {{
            display: none;
        }}
    </style>
</head>
<body>
    <!-- Email Container -->
    <div class="email-container">
        <!-- Email content on top -->
        <div class="email-content">
            <div class="header">
                <button class="logo-button">
                    <img src="{logo_base64}" alt="DataCrumbs Logo" style="width: 160px; height: 160px; object-fit: contain;">
                </button>
                <div class="workshop-title">{workshop_name}</div>
            </div>
            
            <div class="content">
                <div class="white-content-container">
                    <div class="greeting">Dear {student_name},</div>
                    
                    <div class="intro-text">
                        Congratulations on successfully completing the <strong>{workshop_name}</strong>! We are excited to share your certificate of achievement, which is attached to this email.
                    </div>
                    
                    <div class="certificate-section">
                        <div class="certificate-text">Certificate of Achievement</div>
                        <div class="certificate-description">
                            Your certificate has been generated and is attached to this email. This certificate recognizes your successful completion of the workshop and the skills you've developed.
                        </div>
                    </div>
                    
                    <div class="linkedin-section">
                        <div class="linkedin-title">Share Your Achievement</div>
                        <div class="linkedin-text">
                            To help you showcase your accomplishment professionally, we've also included a document with sample LinkedIn posts that you can customize and share with your network.
                        </div>
                    </div>
                    
                    <div class="intro-text">
                        Thank you for your active participation — we truly enjoyed having you with us, and we hope to see you again in our future workshops!
                    </div>
                    

                </div>
            </div>
        </div>
    </div>
</body>
</html>"""

def create_email_image(student_name, workshop_name):
    """Convert email template to image with proper logo rendering"""
    try:
        import subprocess
        import tempfile
        
        # Get the HTML content with base64 encoded images
        html_content = certificate_email_template(student_name, workshop_name)
        
        # Create temporary directory for images
        temp_dir = "temp_email_images"
        os.makedirs(temp_dir, exist_ok=True)
        
        # Set Chrome executable path for Heroku
        chrome_path = "/app/.chrome-for-testing/chrome-linux64/chrome"
        if not os.path.exists(chrome_path):
            print(f"⚠️ Chrome not found at {chrome_path}, trying alternative approach")
            return None
        
        print(f"✅ Using Chrome at: {chrome_path}")
        
        # Create a temporary HTML file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as f:
            f.write(html_content)
            html_file_path = f.name
        
        # Generate image path
        image_path = f"{temp_dir}/email_{student_name.replace(' ', '_')}.png"
        print(f"🖼️ Generating email image: {image_path}")
        print(f"📁 Working directory: {temp_dir}")
        
        # Chrome command with all necessary flags for Heroku
        chrome_cmd = [
            chrome_path,
            '--headless',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--window-size=700,830',
            '--hide-scrollbars',
            '--disable-scrollbars',
            '--screenshot=' + image_path,
            'file://' + html_file_path
        ]
        
        print(f"🔧 Running Chrome command: {' '.join(chrome_cmd)}")
        
        # Run Chrome command
        try:
            result = subprocess.run(
                chrome_cmd,
                capture_output=True,
                text=True,
                timeout=60  # Increased timeout to 60 seconds
            )
            
            print(f"📊 Chrome return code: {result.returncode}")
            if result.stdout:
                print(f"📤 Chrome stdout: {result.stdout[:200]}...")
            if result.stderr:
                print(f"📥 Chrome stderr: {result.stderr[:200]}...")
            
            if result.returncode == 0:
                print(f"✅ Chrome screenshot completed successfully")
                
                # Crop the image to remove white space
                crop_image(image_path)
                
                # Compress the image
                compress_image(image_path, max_size_kb=30)
                return image_path
            else:
                print(f"⚠️ Chrome failed with return code {result.returncode}")
                print(f"⚠️ Chrome stderr: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            print("⚠️ Chrome command timed out after 60 seconds")
            return None
        except Exception as e:
            print(f"⚠️ Chrome command failed: {e}")
            return None
        finally:
            # Clean up temporary HTML file
            try:
                os.unlink(html_file_path)
            except:
                pass
        
    except Exception as e:
        print(f"❌ Failed to create email image: {e}")
        # Fallback: return None so the email will be sent without the image
        print("⚠️ Falling back to text-only email (no image)")
        return None

def crop_image(image_path):
    """Crop image to remove white space at the bottom"""
    try:
        from PIL import Image
        
        # Open image
        img = Image.open(image_path)
        
        # Get dimensions
        width, height = img.size
        
        # Crop 80px from the bottom
        cropped_height = height - 80
        cropped_img = img.crop((0, 0, width, cropped_height))
        cropped_img.save(image_path)
        print(f"✅ Cropped 80px from bottom: {height}px → {cropped_height}px")
            
    except Exception as e:
        print(f"⚠️ Could not crop image: {e}")

def compress_image(image_path, max_size_kb=30):
    """Compress image for email with aggressive compression"""
    try:
        from PIL import Image
        
        # Open image
        img = Image.open(image_path)
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA'):
            img = img.convert('RGB')
        
        # Resize if too large (maintain aspect ratio)
        max_width = 700
    
        
        if img.width > max_width:
            img.thumbnail((max_width, img.height), Image.Resampling.LANCZOS)
        
        # Save with aggressive compression
        img.save(image_path, optimize=True, quality=60)  # Reduced quality for smaller size
        
        # Check file size
        file_size = os.path.getsize(image_path) / 1024  # KB
        print(f"✅ Image compressed: {image_path} ({file_size:.1f}KB)")
        
        # If still too large, compress more
        if file_size > max_size_kb:
            img.save(image_path, optimize=True, quality=40)
            file_size = os.path.getsize(image_path) / 1024
            print(f"✅ Further compressed: {file_size:.1f}KB")
        
    except Exception as e:
        print(f"⚠️ Could not compress image: {e}")

if __name__ == "__main__":
    # Test the image generation
    test_image = create_email_image("Test Student", "Test Workshop")
    if test_image:
        print(f"✅ Test image created: {test_image}")
    else:
        print("❌ Failed to create test image") 