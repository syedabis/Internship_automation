# 🎓 DataCrumbs — Internship Certificate Automation System

Automated certificate generation and transactional email dispatch system built for **DataCrumbs** internship programs. 

This system connects directly to Google Sheets, dynamically overlays student names and metadata onto high-resolution certificate templates, sends personalized emails via **Resend** (using custom domains like `aun@datacrumbs.org`), and records unique certificate IDs and timestamps back to the sheet.

---

## ✨ Features

- 📊 **Google Sheets Integration**: Automatically fetches candidate records from Google Sheets and updates rows with status (`sent`), timestamp, and certificate ID.
- 🎨 **Dynamic High-Res Certificate Generation**: Overlays student name, awarded date, and certificate ID onto canvas templates with responsive font sizing (+20% enhanced name typography).
- 📧 **Resend Email Engine**: Dispatches responsive HTML emails with attached high-resolution PNG certificates from verified domain email addresses.
- 🔐 **Guaranteed Unique Certificate IDs**: Generates cryptographically unique certificate numbers (e.g. `DC-INT-2026-FEB1CC`).
- 🧹 **Smart Email Sanitization**: Auto-corrects domain/formatting typos (e.g., `.con` -> `.com`, embedded spaces) to ensure 100% email deliverability.
- ⚡ **REST API & CLI Scripts**: Includes Next.js API route (`POST /api/internship/process`), standalone Node.js runner, and Python CLI utilities.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (React & API routes)
- **Canvas Rendering**: [`@napi-rs/canvas`](https://github.com/Brooooooklyn/canvas) / PIL (Python)
- **Email Service**: [Resend](https://resend.com/) Node.js SDK
- **Google Sheets API**: `google-spreadsheet` & `google-auth-library` (Service Account JWT)
- **Styling & Design**: Vanilla CSS with modern HTML email templates

---

## 📋 Google Sheet Column Schema

The automated reader expects the following column header structure in the primary worksheet:

| Column | Header | Description |
| :---: | :--- | :--- |
| **A** | `Timestamp` | Populated automatically with delivery timestamp upon sending. |
| **B** | `Full Name` | Student's full name printed on the certificate. |
| **C** | `Email Address` | Candidate's email address. |
| **D** | `Internship Program` | Internship program name (Default: *6-Week Internship Program*). |
| **E** | `Awarded Date` | Date shown on certificate (Auto-generated if empty). |
| **F** | `Certificate No` | Unique certificate ID (Auto-generated if empty). |
| **G** | `Certificate Status` | Marked as `sent` after successful delivery. |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+ 
- A verified domain and API Key on [Resend](https://resend.com/)
- A Google Service Account with Google Sheets API access (`credentials.json`)

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/syedabis/Internship_automation.git
cd Internship_automation
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:
```env
# Resend API Key & Verified Sender Email
RESEND_API_KEY=re_your_resend_api_key_here
EMAIL_USER="DataCrumbs <aun@datacrumbs.org>"

# Google Sheets Configuration
INTERNSHIP_SPREADSHEET_ID=your_google_sheet_id_here
```

Place your Google Service Account credentials JSON file as `credentials.json` in the root folder.

---

## 🏃 Running the Automation

### Option 1: Execute via Node CLI (Recommended)
Process all pending entries in the Google Sheet:
```bash
node --env-file=.env -e "require('./lib/internshipCertificate').processPendingInternshipCertificates(console.log)"
```

### Option 2: Run Next.js Server & Call API Endpoint
Start the development server:
```bash
npm run dev
```

Trigger batch certificate generation via HTTP POST:
```bash
curl -X POST http://localhost:3000/api/internship/process
```

---

## 🛡️ License & Copyright

© DataCrumbs. All rights reserved. Proprietary software for DataCrumbs internship automation.
