# 🏥 Atta Homeopathic Clinic Management System (ClinicMS)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-blue.svg)](https://nodejs.org/)
[![Vercel Ready](https://img.shields.io/badge/Deployment-Vercel%20Ready-black.svg)](https://vercel.com/)

A modern, responsive, and full-featured **Clinical & Patient Management System** designed for homeopathy clinics. It provides end-to-end management of patient records, prescriptions, medicine inventory, financial tracking, and real-time growth analytics.

---

## 🌟 Key Features

### 👨‍⚕️ 1. Patient Management & Directory
- **Auto-Generated IRE IDs**: Instant registration with unique patient identification numbers.
- **Comprehensive Patient Profiles**: Track medical history, symptoms, blood pressure, blood group, age, and contact information.
- **Photo & Defect Image Capturing**: Webcam and file upload integration for patient photos and affected area tracking.
- **Instant Search & Filters**: Fast directory search by patient name, phone number, registration ID, or blood group.

### 💊 2. Medicine Inventory & RAG Alerts
- **Stock Depletion Tracking**: Monitor medicine stock levels with real-time **RAG (Red-Amber-Green)** status alerts.
- **Category Management**: Track dilutions, mother tinctures, trituration tablets, and syrups.
- **Low Stock Notifications**: Quick identification of out-of-stock and low-stock remedies.

### 📈 3. Growth Analytics & Financial Reports
- **Interactive Dashboard**: Visual charts for **Patient Traffic by Area**, **Blood Group Distribution**, and **Growth Analytics** (Visits, Patients, Revenue).
- **Date Range Filters**: Filter analytics by Last 7 Days, Last 28 Days, Last 90 Days, This Year, or Custom date ranges.
- **Revenue Tracking**: Monitor daily, weekly, and monthly clinic revenue with target goal progress bars.

### 📝 4. Clinical Prescription Pad & Printing
- **A5 Printable Prescriptions**: Generate clean, professional A5 clinical prescription pads ready for print (`Ctrl + P`).
- **Follow-up Management**: Record revisit notes, symptoms, and prescribed dosages seamlessly.

### 💾 5. Data Backup & Security
- **SQLite Database**: Lightweight, fast, and embedded data storage.
- **Data Export & Backup**: Easy JSON export and restore capabilities for complete data protection.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Responsive Design System), Modern JavaScript (ES6+), Chart.js
- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (`sqlite` promise wrapper)
- **Deployment**: Vercel Serverless Functions (`@vercel/node`), Standalone Node.js, or Electron Desktop App

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Local Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/clinicms.git
   cd clinicms
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:8080](http://localhost:8080)

---

## ☁️ Deployment on Vercel

This repository is pre-configured for one-click **Vercel Serverless Deployment**:

1. Push your repository to **GitHub**.
2. Log in to [Vercel](https://vercel.com/) and click **Add New Project**.
3. Import the `clinicms` repository.
4. Leave Framework Preset as **Other** (Vercel automatically detects `vercel.json` and `api/index.js`).
5. Click **Deploy**!

---

## 📁 Project Structure

```
clinicms/
├── api/
│   └── index.js              # Vercel Serverless function entry point
├── web/
│   ├── index.html            # Main Single-Page Application view
│   ├── style.css             # Core CSS Design System & Responsive Queries
│   └── app.js                # Frontend Application Logic & Event Handlers
├── database.js               # SQLite Database queries & helpers
├── server.js                 # Express server & API endpoints
├── vercel.json               # Vercel deployment & routing configuration
├── package.json              # Project dependencies and scripts
└── README.md                 # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).