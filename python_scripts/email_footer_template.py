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

def create_email_footer_html():
    """Generate simple HTML footer with clickable LinkedIn button"""
    
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Footer</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
            }
            
            .footer-container {
                max-width: 700px;
                margin: 0 auto;
                padding: 0;
                text-align: center;
            }
            
            .linkedin-button {
                display: inline-block;
                background: #f0f0f0;
                color: black;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .linkedin-button:hover {
                background: #d0d0d0;
            }
            
            .contact-info {
                font-size: 14px;
                color: #666666;
                margin-bottom: 10px;
            }
            
            .copyright {
                font-size: 12px;
                color: #999999;
            }
        </style>
    </head>
    <body>
        <div class="footer-container">
            <a href="https://drive.google.com/file/d/1X8xFBisAE7t7V4evBTU-wr0t8brDZAJE/view?usp=sharing" 
               class="linkedin-button" target="_blank">
                📄 Access LinkedIn Post Guide
            </a>
            
            <div class="contact-info">
                If you have any questions, feel free to message us at <strong>support@DataCrumbs.org</strong>
            </div>
            
            <div class="copyright">
                All rights reserved. © DataCrumbs
            </div>
        </div>
    </body>
    </html>
    """

if __name__ == "__main__":
    # Test the footer HTML generation
    footer_html = create_email_footer_html()
    print("✅ Footer HTML generated successfully")
    print("📄 HTML Length:", len(footer_html)) 