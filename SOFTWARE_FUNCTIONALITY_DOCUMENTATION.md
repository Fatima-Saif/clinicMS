# COMPLETE SOFTWARE FUNCTIONALITY DOCUMENTATION
**Project:** Atta Homeopathic Clinic Management System (ClinicMS)  
**Powered by:** Falcon Face  
**Version:** 1.2.20  
**Target Platform:** Electron (Windows x64 / NSIS Installer)  
**Architecture:** Electron 31 + Node.js Express 4 + SQLite3 (WAL Mode) + Vanilla JS / HTML5 / CSS3  
**Document Purpose:** Complete functional specification for rebuilding the software from scratch without accessing the original source code.

---

## TABLE OF CONTENTS
1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Data Architecture & Database Schema](#2-data-architecture--database-schema)
3. [Global UI Shell & Persistent Components](#3-global-ui-shell--persistent-components)
4. [Complete Screen Inventory](#4-complete-screen-inventory)
   - [Screen 1: Dashboard (`#page-dashboard`)](#screen-1-dashboard-page-dashboard)
   - [Screen 2: New Patient Registration (`#page-new-patient`)](#screen-2-new-patient-registration-page-new-patient)
   - [Screen 3: Patient Record / Search (`#page-search`)](#screen-3-patient-record--search-page-search)
   - [Screen 4: Medicine Inventory (`#page-inventory`)](#screen-4-medicine-inventory-page-inventory)
   - [Screen 5: Clinic Directory (`#page-all-records`)](#screen-5-clinic-directory-page-all-records)
   - [Screen 6: Backup & Restore Data (`#page-backup`)](#screen-6-backup--restore-data-page-backup)
   - [Screen 7: Patient Record Slide-in Panel (`#record-panel`)](#screen-7-patient-record-slide-in-panel-record-panel)
   - [Modal 1: Live Camera Capture Modal (`#camera-modal`)](#modal-1-live-camera-capture-modal-camera-modal)
   - [Modal 2: Admin Password Dialog (`#password-overlay`)](#modal-2-admin-password-dialog-password-overlay)
   - [Modal 3: Delete Confirmation Dialog (`#confirm-overlay`)](#modal-3-delete-confirmation-dialog-confirm-overlay)
   - [Modal 4: Bulk Print Patient Records Modal (`#bulk-print-modal`)](#modal-4-bulk-print-patient-records-modal-bulk-print-modal)
   - [Modal 5: Backup Merge Summary Modal (`#backup-summary-modal`)](#modal-5-backup-merge-summary-modal-backup-summary-modal)
   - [Modal 6: A5 Clinical Pad Preview & Print Modal (`#clinical-pad-modal`)](#modal-6-a5-clinical-pad-preview--print-modal-clinical-pad-modal)
5. [Feature-by-Feature Functional Specification](#5-feature-by-feature-functional-specification)
6. [Complete Step-by-Step User Workflows](#6-complete-step-by-step-user-workflows)
7. [Calculations, Formulas & Business Logic](#7-calculations-formulas--business-logic)
8. [Search, Filtering & Autocomplete Engine](#8-search-filtering--autocomplete-engine)
9. [Reporting, Printing & Document Generation](#9-reporting-printing--document-generation)
10. [Hardware, External & System Integrations](#10-hardware-external--system-integrations)
11. [Master Feature Checklist](#11-master-feature-checklist)

---

# 1. SYSTEM OVERVIEW & ARCHITECTURE

### 1.1 Purpose & Domain
The software is an all-in-one desktop clinical management system created specifically for **Atta Homeopathic Clinic** (also branded as **Atta Homeopathic Markaz**). It manages patient demographic and clinical history, consultations/visits, vitals recording, physical symptom tracking, homeopathic prescription dispensing, medicine inventory control, revenue tracking, clinical stopwatch timing, Azan prayer reminders, automated WhatsApp card sharing, and PDF export of single and batch records.

### 1.2 Technology Stack
- **Desktop Runtime:** Electron 31.7.7 (`BrowserWindow` running with `contextIsolation: true`, `nodeIntegration: false`, hardware acceleration disabled via `app.disableHardwareAcceleration()`).
- **Preload Bridge:** Exposes `window.electronAPI.copyImageToClipboard(dataUrl)` and `window.electronAPI.openExternal(url)` to the web context.
- **Application Server:** Express 4.19.2 HTTP server running on `127.0.0.1` on a dynamic port assigned at runtime.
- **Database Engine:** SQLite3 5.1.7 with WAL (Write-Ahead Logging) mode and foreign key enforcement enabled (`PRAGMA foreign_keys = ON; PRAGMA journal_mode=WAL;`).
- **Client Frontend:** Single Page Application (SPA) using vanilla ES6 JavaScript, HTML5, and CSS3.
- **External UI Libraries:**
  - `chart.min.js`: Chart.js library for rendering Area Distribution, Blood Group Distribution, and Growth Analytics.
  - `jspdf.umd.min.js` & `jspdf.plugin.autotable.min.js`: Client-side vector PDF document rendering.
  - `html2canvas.min.js`: Client-side DOM canvas rasterizer for WhatsApp cards and A5 Clinical Pad image exports.
  - `gsap.min.js` (GSAP 3.12.2): Animation library driving the interactive mascot Bee character.
  - `nodemailer`: Node.js SMTP transport for sending zipped database backup manifests to configured email addresses.
  - `tesseract.js`: Bundled OCR library (packaged for image text extraction capability).

### 1.3 Operating Environment & Local File Paths
All application data is isolated from the application installation directory and stored inside the user's personal Windows Documents folder:
- **Base Directory:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\`
- **Database File:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\database\clinic.db`
- **Patient Uploaded Photos:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\uploads\patient-photos\`
- **Defected Area Photos:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\uploads\defected-area-photos\`
- **Local Backup Directory:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\backups\`
- **Email Config File:** `%USERPROFILE%\Documents\Atta Homeopathic Clinic\email_backup_config.json`

### 1.4 Offline-First & Typography Support
- **Urdu Script Support:** Embedded offline font `Jameel Noori Nastaleeq` stored in `web/fonts/JameelNooriNastaleeq-vfs.js` and `web/fonts/JameelNooriNastaleeq.ttf`, with online fallback to Google Font `Gulzar`.
- **Right-To-Left (RTL) Detection:** Automatic bidirectional text detection evaluates Unicode blocks (`[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]`) and flips text alignment and styling automatically.

---

# 2. DATA ARCHITECTURE & DATABASE SCHEMA

### 2.1 Table: `patients`
Stores all master demographic, identification, and high-level medical notes for a patient.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Internal primary key.
- `registration_no` (INTEGER): Legacy numeric registration number.
- `reg_id` (TEXT UNIQUE): Registration identifier formatted as `REG-XXXXXX` (e.g., `REG-000001`).
- `ire_id` (TEXT UNIQUE): Clinical identifier formatted as `IRE-XXXXXX` (e.g., `IRE-000001`).
- `first_name` (TEXT NOT NULL): Patient primary name (supports English and Urdu Nastaleeq).
- `last_name` (TEXT): Patient surname or secondary name.
- `name` (TEXT NOT NULL): Legacy compatibility column synchronized with `first_name`.
- `surname` (TEXT): Legacy compatibility column synchronized with `last_name`.
- `age` (INTEGER): Age in years (0 to 150).
- `date_of_birth` (TEXT): Date of birth string (`YYYY-MM-DD`).
- `weight` (REAL): Patient body weight in kilograms (kg).
- `gender` (TEXT): Gender (`Male` or `Female`).
- `guardian_name` (TEXT): Father, husband, or guardian's full name.
- `guardian_relationship` (TEXT): Relationship selector (`S/O (Son of)`, `D/O (Daughter of)`, `W/O (Wife of)`, `H/O (Husband of)`, `C/O (Care of)`, `Guardian`, `Other`, or legacy `Father`).
- `whatsapp_number` (TEXT): WhatsApp/mobile contact number.
- `phone` (TEXT): Secondary phone contact.
- `alternate_phone` (TEXT): Alternate emergency phone number.
- `cnic` (TEXT): National Identity Card number.
- `address` (TEXT): Street address or residential colony.
- `city` (TEXT): City or geographical area (e.g., `Faisalabad`, `Peoples Colony`).
- `emergency_contact_name` (TEXT): Secondary emergency person name.
- `emergency_contact_number` (TEXT): Secondary emergency person contact number.
- `blood_group` (TEXT): Blood group (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
- `patient_status` (TEXT DEFAULT 'Active'): Status of patient (`Active`, `Inactive`, `Archived`).
- `diagnosis` (TEXT): Primary medical diagnosis.
- `allergies` (TEXT): Known pharmaceutical, environmental, or food allergies.
- `medical_history` (TEXT): Family medical history and historical clinical background.
- `current_medicines` (TEXT): JSON array or newline-delimited text of current medicines.
- `notes` (TEXT): Miscellaneous administrative or medical notes.
- `patient_image` (TEXT): Relative path to stored profile picture (`/uploads/patient-photos/...`) or Base64 data URL.
- `registration_date` (TEXT): Date registered in clinic (`YYYY-MM-DD`).
- `updated_at` (TEXT): ISO 8601 timestamp of last profile modification.
- `created_at` (TEXT DEFAULT (datetime('now'))): Record creation timestamp.

### 2.2 Table: `visits`
Stores each clinical encounter, consultation, prescription, and fee transaction. Cascades on patient deletion.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Primary key for the encounter.
- `patient_id` (INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE): Foreign key link to patient.
- `visit_date` (TEXT NOT NULL): Date of consultation (`YYYY-MM-DD`).
- `pulse_rate` (INTEGER): Heart pulse rate in beats per minute (bpm).
- `blood_pressure` (TEXT): Systolic/diastolic blood pressure reading (e.g. `120/80`).
- `temperature` (REAL): Body temperature in Fahrenheit (`°F`).
- `oxygen_level` (INTEGER): Blood oxygen saturation percentage (`SpO2%`, 0–100).
- `weight` (REAL): Weight recorded during this specific visit (kg).
- `diagnosis` (TEXT): Clinical diagnosis formulated during this encounter.
- `symptoms` (TEXT): Presenting complaints and clinical examination findings.
- `doctor` (TEXT): Consulting physician name.
- `prescription` (TEXT): General prescription narrative, instructions, or diet advice.
- `medicines` (TEXT): Prescribed medicines serialized as a JSON string array of objects (`[{name, dosage, frequency, duration, instructions}]`) or plain text.
- `notes` (TEXT): Internal clinical encounter notes.
- `defected_area_image` (TEXT): Photo 1 of physical affected/pathology area (`/uploads/defected-area-photos/...`).
- `defected_area_image_2` (TEXT): Photo 2 of physical affected/pathology area.
- `defected_area_image_3` (TEXT): Photo 3 of physical affected/pathology area.
- `consultation_fee` (REAL DEFAULT 0.0): Doctor's examination fee.
- `medicine_price` (REAL DEFAULT 0.0): Total price of dispensed homeopathic medicines.
- `total_amount` (REAL DEFAULT 0.0): Gross total amount (`consultation_fee + medicine_price`).
- `discount` (REAL DEFAULT 0.0): Discount granted to patient.
- `final_amount` (REAL DEFAULT 0.0): Net billable amount (`max(0, total_amount - discount)`).
- `payment_method` (TEXT DEFAULT 'Cash'): Payment type (`Cash`, `Card`, `EasyPaisa`, `JazzCash`, `Bank Transfer`).
- `payment_status` (TEXT DEFAULT 'Unpaid'): Payment condition (`Paid` or `Unpaid`).
- `amount_received` (REAL DEFAULT 0.0): Actual cash/funds collected from the patient.
- `remaining_balance` (REAL DEFAULT 0.0): Outstanding patient balance (`final_amount - amount_received`).
- `created_at` (TEXT DEFAULT (datetime('now'))): Visit creation timestamp.

### 2.3 Table: `medicines`
Stores the pharmacy inventory of homeopathic medicines, dilutions, mother tinctures, and combinations.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT): Internal ID.
- `name` (TEXT NOT NULL): Medicine name (e.g., `Arnica Montana 30`, `Thuja Occidentalis 200`).
- `code` (TEXT UNIQUE NOT NULL): Inventory SKU code (auto-generated as `MED-XXXX`, e.g. `MED-0001`).
- `category` (TEXT): Category (`Potency`, `Mother Tincture`, `Combination`).
- `company` (TEXT): Manufacturing pharmaceutical lab (e.g., `Schwabe`, `Dr. Reckeweg`, `Local`).
- `batch_no` (TEXT): Production lot/batch number.
- `purchase_date` (TEXT): Procurement date (`YYYY-MM-DD`).
- `expiry_date` (TEXT): Expiry date (`YYYY-MM-DD`).
- `purchase_price` (REAL DEFAULT 0.0): Purchase/cost price per unit.
- `selling_price` (REAL DEFAULT 0.0): Retail/dispensing price per unit.
- `quantity_purchased` (INTEGER DEFAULT 0): Total stock quantity originally received.
- `quantity_remaining` (INTEGER DEFAULT 0): Current stock on shelf.
- `min_stock_alert` (INTEGER DEFAULT 0): Threshold quantity triggering low-stock alert.
- `stock_status` (TEXT DEFAULT 'In Stock'): Status (`In Stock` or `Out of Stock`).
- `supplier_name` (TEXT): Distributor or vendor name.
- `supplier_contact` (TEXT): Supplier contact number.
- `notes` (TEXT): Storage instructions or notes.
- `created_at` (TEXT DEFAULT (datetime('now'))): Timestamp registered.

### 2.4 Table: `settings`
Key-value store for clinic configuration and goal tracking targets.
- `key` (TEXT PRIMARY KEY): Unique setting key.
- `value` (TEXT NOT NULL): Value stored.
- **Default Seeded Keys:**
  - `daily_patient_goal` = `'20'`
  - `weekly_patient_goal` = `'100'`
  - `monthly_patient_goal` = `'400'`
  - `total_patient_target` = `'500'`
  - `daily_revenue_goal` = `'5000'`
  - `weekly_revenue_goal` = `'25000'`
  - `monthly_revenue_goal` = `'100000'`
  - `total_revenue_goal` = `'500000'`
  - `azan_alarm_config` = JSON string of prayer schedules.

### 2.5 Table: `appointments`
Manages scheduled patient appointments and consultations.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `patient_id` (INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE)
- `appointment_date` (TEXT NOT NULL)
- `status` (TEXT DEFAULT 'Scheduled'): (`Scheduled`, `Completed`, `Cancelled`)
- `created_at` (TEXT DEFAULT (datetime('now')))

### 2.6 Table: `audit_logs`
Tracks modifications made to clinic settings and sensitive data.
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `username` (TEXT NOT NULL): Actor username (e.g. `'admin'`)
- `action` (TEXT NOT NULL): Action summary (e.g. `'Settings Changed'`)
- `table_name` (TEXT NOT NULL): Affected table
- `record_id` (INTEGER NOT NULL): Identifier of affected row
- `old_values` (TEXT): JSON representation of previous state
- `new_values` (TEXT): JSON representation of modified state
- `timestamp` (TEXT DEFAULT (datetime('now', 'localtime')))

---

# 3. GLOBAL UI SHELL & PERSISTENT COMPONENTS

### 3.1 Layout Architecture
The application shell consists of a two-column responsive layout:
1. **Left Sidebar (`aside.sidebar`):**
   - **Clinic Logo/Branding:** Icon with clinic name (`ATTA HOMEOPATHIC MARKAZ`) and subtitle (`Patient Management`).
   - **Main Menu Items:**
     - `Dashboard` (`#nav-dashboard`, icon: 4-square grid)
     - `New Patient` (`#nav-new-patient`, icon: user with plus)
     - `Patient Record` (`#nav-search`, icon: magnifying glass)
     - `Medicine Inventory` (`#nav-inventory`, icon: cylinder database / pills)
     - `Clinic Directory` (`#nav-all-records`, icon: file document with lines)
   - **Tools Menu Items:**
     - `Backup & Restore` (`#nav-backup`, icon: upload cloud / tray with arrow)
   - **Footer:**
     - Live server status indicator with pulsing green dot (`Server Online`).
     - Application version badge (`v1.2.20`).
2. **Sticky Topbar (`header.topbar`):**
   - Features background image `clinic_header_bg.png` with overlay.
   - Toggle button for mobile/compact sidebar collapse.
   - Hospital brand logo image `header-logo.png`.
3. **Floating Scroll Navigation Buttons (`#scroll-navigation-container`):**
   - Fixed to the bottom-right corner of the viewport.
   - **Scroll to Top (`#scroll-btn-top`):** Automatically hides when scroll position is near top; clicks smooth-scroll the content area to `0px`.
   - **Scroll to Bottom (`#scroll-btn-bottom`):** Clicks smooth-scroll the content container to its total `scrollHeight`.
4. **Toast Notification System (`#toast-container`):**
   - Displays floating notification popups in the top right.
   - Supports 4 severity types: `success` (green), `error` (red), `warning` (amber), `info` (blue).
   - Features an auto-dismiss timer (default 3500ms, configurable up to 10000ms) with a slide-out animation.
5. **Interactive Mascot Bee (`InteractiveBee`):**
   - Embedded mascot animated via GSAP (`bee-animation.js`) appearing on search inputs.
   - Changes visual sprite states based on user interaction:
     - `idle` / `happy`: `bee/happy.webp`
     - `find`: `bee/find.webp` (when typing or searching)
     - `sleep`: `bee/sleep.webp` (when idle for long durations)
     - `angry`: `bee/angry.webp` (on error or invalid inputs)
     - `fly`: `bee/fly.webp`
     - `hi`: `bee/hi.webp` (on mouseover)
   - Emits golden particle sparkle animations (`spawnSparkle()`) and searching blue dots (`spawnSearchingParticle()`).
   - Respects user accessibility preferences (`prefers-reduced-motion`).

---

# 4. COMPLETE SCREEN INVENTORY

---

### Screen 1: Dashboard (`#page-dashboard`)

- **Purpose:** Central operational command center providing real-time KPI metrics, revenue tracking, growth analytics, quick search, patient traffic maps, medicine stock alerts, target goal setting, stopwatch, calculator, Azan prayer reminders, and quick desk notes.
- **Navigation Path:** Sidebar -> Main Menu -> `Dashboard`. Default view upon launch.
- **Visible Elements & Sub-components:**
  1. **Quick Patient Search Header:**
     - `dash-quick-search` text input: Interactive live search across name, phone, reg no.
     - `dash-id-search` number input: Fast direct lookup by numeric Patient ID.
     - Animated search spinner indicator.
  2. **Top KPI Row (3 Cards):**
     - **Card 1: Total Patients (`#kpi-card-patients`):** Total count of registered patients; trend indicator (`+8.4%`); sparkline SVG graph; clickable to navigate to directory.
     - **Card 2: Today's Visits:** Count of encounters logged on current date; status tag (`Active`); sparkline SVG graph.
     - **Card 3: 1st Visit Revenue (`#kpi-card-first-visit-revenue`):** Revenue generated from initial registrations; expandable breakdown panel toggle button (`#btn-toggle-first-visit-details`) showing:
       - Daily Revenue (`#fv-daily-revenue`)
       - Weekly Revenue (`#fv-weekly-revenue`)
       - Monthly Revenue (`#fv-monthly-revenue`)
  3. **Left Column Components:**
     - **Segmented Progress Milestone Card:** Tracks total registered patients against configurable target milestone (e.g. 500) using segmented color blocks and percentage.
     - **Patient Traffic by Area Chart:** Horizontal bar chart (`#chart-patient-area`) displaying patient density grouped by city/address.
     - **Blood Group Distribution Chart:** Doughnut chart (`#chart-blood-group`) illustrating patient percentage per blood type (`A+`, `B+`, etc.).
     - **Growth Analytics Card:** Multi-metric time-series chart (`#chart-growth-analytics`) featuring:
       - Range selector dropdown (`last-7-days`, `last-28-days`, `last-90-days`, `this-year`, `last-year`, `custom`).
       - Custom date pickers (`#growth-date-from`, `#growth-date-to`, `#growth-apply-btn`).
       - Metric tabs: `Visits`, `Patients`, `Revenue`.
     - **Medicine Stock Alerts (RAG Status) Card:** Red/Amber/Green alert cards list (`#rag-alert-list`) flagging Out of Stock and Low Stock items.
     - **Setting Target Goals Form (`#dash-goals-form-new`):** Input field `#goal-total-patients-target` to update monthly targets with submit button.
     - **Revenue Coin Analytics Card:** Clickable coin toggle button (`#btn-toggle-followup`) with `coin-toggle.png` showing:
       - First Visit Revenue (1st registrations only)
       - Follow-up Revenue (2nd, 3rd, 4th & later visits)
       - Yearly Revenue list with breakdown by calendar year
     - **Quick Desk Notepad Card:**
       - Patient Name input (`#dash-scratchpad-patient-name`).
       - Multi-line scratchpad textarea (`#dash-quick-scratchpad`) with automatic `localStorage` saving.
       - Action buttons: `Print` (opens styled printable window), `Copy Pad` (`copyNotepadAsA5PadImage()`), `Copy Text` (copies plain text), `Clear Note`.
       - Status badge (`Saved`).
  4. **Right Column Clinical Utilities:**
     - **Clinical Stopwatch (`⏱️ Stopwatch`):**
       - Digital display (`#sw-digital-display`) in `MM:SS.mmm` format.
       - SVG Analog Dial (0 to 60 seconds) with graduation ticks, large numbers, and a rotating green second hand (`#sw-sec-hand`).
       - Center Play/Pause button (`#sw-btn-toggle-dial`).
       - Upper-left Reset button (`#sw-btn-reset-dial`).
       - Upper-right Lap/Flag button (`#sw-btn-lap-dial`).
       - Laps split log container (`#sw-laps-list`).
     - **Desktop Calculator (`🧮 Calculator`):**
       - Secondary expression display (`#dash-calc-expr`) and primary display (`#dash-calc-display`).
       - 16-key keypad (`C`, `DEL`, `%`, `÷`, `7`, `8`, `9`, `×`, `4`, `5`, `6`, `−`, `1`, `2`, `3`, `+`, `0`, `.`, `=`).
       - Full physical keyboard listener support.
     - **Azan Alarm System (`🕌 Azan Alarm`):**
       - 5 Daily Prayer Rows: Fajr (فجر), Dhuhr (ظہر), Asr (عصر), Maghrib (مغرب), Isha (عشاء).
       - Each row contains: Urdu calligraphy title, time picker (`<input type="time">`), toggle slider switch, and `Save` button.
       - Active announcement banner with title and audio stop button (`#azan-announcement-banner`).
       - Scheduled audio playback using local sound file `azan1.mp3`.

---

### Screen 2: New Patient Registration (`#page-new-patient`)

- **Purpose:** Full clinical intake and registration screen for newly arriving patients, capturing complete demographic, biometric, clinical vitals, symptomology, homeopathy prescription, and initial visit billing in one form.
- **Navigation Path:** Sidebar -> Main Menu -> `New Patient`.
- **Form ID:** `#new-patient-form` (enclosed in `#patient-form-card`).
- **Fields & Sections:**
  1. **Top Demographics & Identification Box (`.preg-box`):**
     - `Date` (`#f-registration-date`): Intake date picker (defaults to today).
     - `Patient Name *` (`#f-first-name`): Full name input (Urdu or English, mandatory, with autocomplete).
     - `Guardian Name` (`#f-guardian-name`): Father or husband name (with autocomplete).
     - `Patient ID` (`#f-ire-id`): Readonly display showing auto-generated `IRE-XXXXXX`.
     - `Phone Number` (`#f-whatsapp`): Mobile/WhatsApp contact number.
     - `Gender` (`f-gender`): Radio buttons (`Male`, `Female`).
     - `Guardian Relation` (`#f-guardian-relationship`): Dropdown options (`S/O (Son of)`, `D/O (Daughter of)`, `W/O (Wife of)`, `H/O (Husband of)`, `C/O (Care of)`, `Guardian`, `Other`).
     - `Age *` (`#f-age`): Numeric age (0–150, mandatory).
     - `Pulse Rate` (`#f-pulse-rate`): Heart rate (bpm).
     - `Blood Pressure` (`#f-blood-pressure`): BP text string (e.g. `120/80`).
     - `Temperature` (`#f-temperature`): Body temperature in `°F` (step 0.1).
     - `Oxygen Level` (`#f-oxygen-level`): Blood oxygen saturation in `SpO2%` (0–100).
     - `Blood Group` (`#f-blood`): Dropdown (`Select`, `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`).
     - `Weight` (`#f-weight`): Weight in kilograms (kg).
     - `Address` (`#f-address`): Street address.
     - `Area` (`#f-city`): Town/City/Locality (with autocomplete).
     - `Allergies` (`#f-allergies`): Known medical allergies.
  2. **Middle Clinical Box (2-column layout):**
     - **Left Box - Symptoms:** `#f-symptoms` multi-line textarea with autocomplete suggestion popup.
     - **Right Box - Medicines:** `#f-medicines-text` multi-line textarea with auto-suggestions for remedies and potencies.
  3. **Bottom Financial & Billing Box:**
     - `Consultant Fee` (`#f-consultation-fee`): Input numeric doctor fee.
     - `Medicine Price` (`#f-medicine-price`): Input numeric medicine fee.
     - `Total Amount` (`#f-total-amount`): Readonly computed gross total.
     - `Discount` (`#f-discount`): Input discount amount.
     - `Final Amount` (`#f-final-amount`): Readonly computed net payable amount.
     - `Received Amount` (`#f-amount-received`): Input cash collected from patient.
     - `Remaining Balance` (`#f-remaining-balance`): Readonly computed balance.
     - `Payment Status` (`#f-payment-status`): Dropdown (`Paid`, `Unpaid`).
  4. **Sticky Action Bar:**
     - `Register Patient` button (`#btn-submit-patient`): Validates and submits patient and initial visit.
     - `WhatsApp` button (`#btn-wa-direct-new-patient`): Saves record, renders graphic cards via html2canvas, copies image to clipboard, and deep-links to WhatsApp.
     - `Clear Form` button (`#btn-clear-form`): Clears all inputs and resets auto ID.

---

### Screen 3: Patient Record / Search (`#page-search`)

- **Purpose:** Primary directory search screen to locate existing patient records by name, mobile number, CNIC, registration number, or numeric ID.
- **Navigation Path:** Sidebar -> Main Menu -> `Patient Record`.
- **Visible Elements:**
  - `Search Input` (`#search-input`): Full wildcard search input with interactive Bee animation integration.
  - `ID Search Input` (`#search-id-input`): Number input for direct lookup by patient ID.
  - `Search Spinner` (`#search-spinner`): Loading indicator during debounce queries.
  - `Search Results Label` (`#search-results-label`): Dynamic feedback banner (e.g. `Found 12 matching patients`).
  - `Patients Grid` (`#patients-grid`): Responsive grid of patient cards (`.patient-card`) displaying:
    - Patient avatar (colored by gender or actual photo).
    - Full name with relation badge.
    - IRE ID & Registration No.
    - Age, gender, blood group, contact phone.
    - Last visit date.
    - Action button `View Record` (opens `#record-panel`).

---

### Screen 4: Medicine Inventory (`#page-inventory`)

- **Purpose:** Complete pharmaceutical stock management screen for registering, editing, deleting, and auditing medicines, dilutions, and tinctures.
- **Navigation Path:** Sidebar -> Main Menu -> `Medicine Inventory`.
- **Visible Elements:**
  1. **Header Toolbar:** Banner with title and shortcut button `View in Directory` (`#btn-inventory-to-dir`).
  2. **Add / Edit Medicine Form (`#med-inventory-form`):**
     - `Serial Number` (`#med-serial`): Readonly auto-generated SKU code (`MED-XXXX`).
     - `Name of Medicine` (`#med-name`): Mandatory medicine name.
     - `Category` (`#med-category`): Dropdown (`Potency`, `Mother Tincture`, `Combination`).
     - `Quantity` (`#med-qty-remaining`): Numeric stock on hand.
     - `Stock Status` (`#med-stock-status`): Dropdown (`In Stock`, `Out of Stock`).
     - Action Buttons: `Add Medicine` (`#btn-save-medicine`) and `Clear` (`#btn-clear-medicine`).
  3. **Embedded Inventory Table (`#med-inventory-table-body`):**
     - Table columns: `Code`, `Medicine`, `Category`, `Stock`, `Status`, `Req. Qty` (hidden/toggleable), `Actions`.
     - Direct Action buttons per row: `Edit` (populates form for quick updates) and `Delete` (prompts confirmation).

---

### Screen 5: Clinic Directory (`#page-all-records`)

- **Purpose:** Unified administrative master list for all patients and all medicine inventory records with tabbed views, column sorting, pagination, and PDF exports.
- **Navigation Path:** Sidebar -> Main Menu -> `Clinic Directory`.
- **Sub-sections & Elements:**
  1. **Tab Navigation:** `Patient Inventory List` (`#btn-tab-patients`).
  2. **Patients Directory (`#dir-section-patients`):**
     - Count badge (`#dir-patients-count`): Total count of records.
     - `Export PDF` button (`exportPatientListPDF()`): Generates simplified patient list PDF.
     - `Print Direct` button (`window._pdfAutoPrint = true`): Direct print trigger.
     - `Bulk Print` button (`openBulkPrintModal()`): Opens the bulk PDF generation modal.
     - Blood Group Filter dropdown (`#dir-bg-search`): Filter by `A+`, `B+`, etc.
     - Search Input (`#dir-patients-search`): Live text search across name, phone, reg no.
     - Table Columns: `Registration No.`, `Name`, `Gender`, `Age`, `Blood Group`, `WhatsApp`, `Address`, `Registration Date`.
     - Pagination Bar: Displays current slice (e.g. `Showing 1 to 25 of 142 entries`) and page numbers (`1`, `2`, `3...`).
  3. **Medicines Directory (`#dir-section-medicines`):**
     - Count badge (`#dir-medicines-count`).
     - `In Stock PDF` & Print buttons (`exportMedicineListPDF('in-stock')`).
     - `Out of Stock PDF` & Print buttons (`exportMedicineListPDF('out-of-stock')`).
     - `Manage Stock` shortcut button: Switches to `#page-inventory`.
     - `Search medicines...` input (`#dir-medicines-search`).
     - `Out of Stock` checkbox filter (`#filter-out-of-stock`).
     - Sortable Table Headers: `Code ↕`, `Name ↕`, `Category ↕`, `Remaining Stock ↕`, `Company`, `Price`, `Min Alert`, `Status`, `Action`.

---

### Screen 6: Backup & Restore Data (`#page-backup`)

- **Purpose:** Disaster recovery and data protection hub providing local snapshot backups, email backup dispatch via Gmail SMTP, smart database merge restoration, and local snapshot restoration.
- **Navigation Path:** Sidebar -> Tools -> `Backup & Restore`.
- **Cards & Functionalities:**
  1. **Card 1: Create Local Backup:**
     - Button `Backup Now` (`#btn-create-backup`): Uses SQLite `VACUUM INTO` and recursively clones the `uploads/` folder to create a dated folder in Documents.
  2. **Card 2: Email Backup Settings:**
     - Informational guide on generating a Google App Password.
     - `Sender Gmail Address` (`#eb-sender`).
     - `Gmail App Password` (`#eb-password`): Masked password input.
     - `Recipient Email` (`#eb-recipient`): Destination inbox.
     - `SMTP Host` (`#eb-smtp-host`): Defaults to `smtp.gmail.com`.
     - Button `Save Email Settings` (`#btn-save-email-config`).
  3. **Card 3: Send Backup by Email:**
     - Button `Send Backup by Email Now` (`#btn-send-email-backup`): Compiles fresh backup, packages DB as a self-describing base64 manifest JSON (`.backup.json`), and transmits via Nodemailer.
  4. **Card 4: Restore from Email Backup:**
     - File input (`#eb-restore-file`) accepting `.backup.json`.
     - Warning banner informing that existing records will be merged safely.
     - Button `Restore from This File` (`#btn-restore-from-file`): Triggers Smart Merge engine and displays summary modal.
  5. **Card 5: Local Backups List:**
     - Table listing existing local backups in Documents directory.
     - Columns: `Backup Name`, `Created Time`, `Action` (`Restore` button).

---

### Screen 7: Patient Record Slide-in Panel (`#record-panel`)

- **Purpose:** Modal drawer panel that slides in from the right edge of the screen when any patient is selected. Displays detailed patient demographics, historical consultation timeline, and embedded editing/visit subforms.
- **Navigation Path:** Clicking any patient card in Search or any row in Directory.
- **Components:**
  1. **Header Area:**
     - Close Button (`#panel-close`).
     - Patient Avatar with gender coloring / photo.
     - Full Name (`#panel-name`) and Subtitle (`#panel-sub` - ID & Phone).
     - Action Buttons:
       - `Add Visit` (`#btn-add-visit-action`): Reveals the new visit subform.
       - `Edit Patient` (`#btn-edit-patient-toggle`): Requires Admin password and toggles `#edit-patient-form`.
       - `Repeat Patient` (`#btn-repeat-last-visit`): Automatically populates a new visit with data from the previous visit.
       - `WhatsApp` button (`#btn-send-patient-whatsapp`): Generates and shares patient card.
  2. **Subform A: Update Patient & Latest Visit (`#edit-patient-form`):**
     - Contains all demographic inputs prefixed with `ep-` (`ep-first-name`, `ep-guardian-name`, `ep-ire-id`, `ep-whatsapp`, `ep-gender`, `ep-guardian-relationship`, `ep-age`, `ep-pulse-rate`, `ep-blood-pressure`, `ep-temperature`, `ep-oxygen-level`, `ep-blood`, `ep-weight`, `ep-address`, `ep-city`, `ep-allergies`, `ep-symptoms`, `ep-medicines-text`, and full billing row).
     - Buttons: `Cancel`, `WhatsApp` (`#btn-wa-direct-edit-patient`), `Update Patient` (`#btn-update-patient`).
  3. **Subform B: New Visit Form (`#add-visit-form`):**
     - Inputs prefixed with `av-` (`av-registration-date`, `av-first-name`, `av-guardian-name`, `av-ire-id`, `av-whatsapp`, `av-gender`, `av-guardian-relationship`, `av-age`, `av-pulse-rate`, `av-blood-pressure`, `av-temperature`, `av-oxygen-level`, `av-blood`, `av-weight`, `av-address`, `av-city`, `av-diagnosis`, `av-symptoms`, `av-medicines-text`, and full billing row).
     - Buttons: `Repeat Previous Visit` (`#btn-repeat-visit`), `Cancel`, `Add Visit` (`#btn-save-visit`).
  4. **Subform C: Edit Specific Historical Visit (`#edit-visit-form`):**
     - Inputs prefixed with `ev-` (`ev-registration-date`, `ev-first-name`, `ev-guardian-name`, `ev-ire-id`, `ev-whatsapp`, `ev-gender`, `ev-guardian-relationship`, `ev-age`, `ev-pulse-rate`, `ev-blood-pressure`, `ev-temperature`, `ev-oxygen-level`, `ev-blood`, `ev-weight`, `ev-address`, `ev-city`, `ev-diagnosis`, `ev-symptoms`, `ev-medicines-text`, and full billing row).
     - Buttons: `Cancel` (`#ev-btn-cancel`), `Save Visit` (`#btn-save-edit-visit`).
  5. **Patient Details Grid (`#panel-detail-grid`):**
     - Visual grid of read-only demographic key-value badges.
  6. **Visit History Timeline (`#visit-timeline`):**
     - Chronological descending timeline of all visits. Each visit card contains:
       - Visit date, doctor name, and visit number badge.
       - Vitals pills (`BP`, `Pulse`, `Temp`, `Weight`, `O2`).
       - Diagnosis & Symptoms boxes.
       - Affected area photographs (with lightbox expansion).
       - Prescribed medicines list.
       - Financial bar: Fee amount, discount, payment status.
       - Action buttons per visit:
         - `BILLING`: Exports/copies dedicated billing summary card.
         - `View Pad`: Opens the A5 Clinical Pad modal for this visit.
         - `Print A5`: Directly sends A5 Clinical Pad to printer.
         - `Prescription`: Generates and copies PNG prescription card.
         - `Edit Visit`: Populates Subform C.
         - `Delete Visit`: Prompts confirmation and deletes visit.

---

### Modal 1: Live Camera Capture Modal (`#camera-modal`)

- **Purpose:** Hardware integration modal capturing webcam photographs for patient identification or physical defect/affected areas.
- **Controls & Sections:**
  - Title (`#camera-modal-title`): Dynamically indicates `Patient Photo` or `Affected Area Photo`.
  - Close button (`#btn-camera-close`).
  - Live View Section (`#camera-live-section`): Contains `<video id="camera-video">` stream and alignment frame overlay. Permission denial banner with `Try Again` button (`#btn-retry-camera`).
  - Preview Section (`#camera-preview-section`): Displays captured freeze-frame on `<canvas id="camera-canvas">`.
  - Actions:
    - Live state: `Capture Photo` (`#btn-capture-photo`) and `Cancel` (`#btn-camera-cancel`).
    - Preview state: `Use This Photo` (`#btn-use-photo`), `Retake` (`#btn-retake-photo`), and `Cancel` (`#btn-camera-cancel-2`).

---

### Modal 2: Admin Password Dialog (`#password-overlay`)

- **Purpose:** Security gate protecting sensitive record modifications and patient updates from unauthorized tampering.
- **Elements:**
  - Shield/Lock icon in red hue.
  - Heading: `Admin Password Required`.
  - Input field `#admin-password-input` (type: password, centered).
  - Password visibility toggle icon (`#toggle-admin-password`).
  - Buttons: `Cancel` (`#password-cancel`) and `Verify` (`#password-ok`).
- **Validation:** Compares input strictly against authorized passwords (`admin123` or `admin`).

---

### Modal 3: Delete Confirmation Dialog (`#confirm-overlay`)

- **Purpose:** Prevents accidental deletion of patients, visits, or medicines.
- **Elements:**
  - Red trashcan icon.
  - Title (`#confirm-title`): Dynamically set (e.g. `Delete Patient?`, `Delete Visit?`).
  - Warning Message (`#confirm-message`): Explains cascading implications.
  - Buttons: `Cancel` (`#confirm-cancel`) and `Delete` (`#confirm-ok`).

---

### Modal 4: Bulk Print Patient Records Modal (`#bulk-print-modal`)

- **Purpose:** Range-based multi-patient PDF generation modal.
- **Inputs:**
  - `From Patient # (Reg No.)` (`#bulk-from`): Starting integer registration number.
  - `To Patient # (Reg No.)` (`#bulk-to`): Ending integer registration number.
- **Progress Tracking:**
  - Progress bar (`#bulk-print-progress-bar`) animating from 0% to 100%.
  - Status text (`#bulk-print-status`): Displays current patient being rendered (e.g. `Processing 4 of 20: Muhammad Ali...`).
- **Actions:**
  - `Generate PDF` button (`#btn-start-bulk-print`).
  - `Cancel` / Close button (`closeBulkPrintModal()`).

---

### Modal 5: Backup Merge Summary Modal (`#backup-summary-modal`)

- **Purpose:** Detailed metrics report presented to the user after restoring an email backup file.
- **Metrics Displayed:**
  - `✓ New Records Imported`: `#summary-new` (count of rows added).
  - `✓ Existing Records Updated`: `#summary-updated` (count of rows updated with newer timestamps).
  - `✓ Duplicate Records Skipped`: `#summary-skipped` (count of unchanged rows preserved).
  - `Total Records After Merge`: `#summary-total` (total count of rows in database).
- **Actions:**
  - `Continue` button: Dismisses modal and refreshes application state.

---

### Modal 6: A5 Clinical Pad Preview & Print Modal (`#clinical-pad-modal`)

- **Purpose:** Exact physical representation of the official clinic A5 prescription pad for reviewing, downloading, copying, or printing.
- **Toolbar Actions:**
  - Visit title indicator (`#cp-modal-visit-title`, e.g. `Visit #1 (18/09/2026)`).
  - `🖼️ PNG` button (`triggerPadDownload('png')`): Downloads pad as PNG.
  - `🖼️ JPG` button (`triggerPadDownload('jpeg')`): Downloads pad as JPG.
  - `📋 Copy Image` button (`triggerPadCopy()`): Automatically rasterizes pad and writes image to system clipboard.
  - `🖨️ Print A5` button (`triggerPadPrint()`): Triggers standard browser/Electron print dialog formatted for A5 paper.
  - `✖` Close button (`closeClinicalPadModal()`).
- **Body Layout (`#clinical-pad-container`):**
  - Displays `#a5-pad-printable` with exact dimensions `148mm × 210mm`.
  - Injects top header banner `clinical_pad_header.png`.
  - Header metadata fields formatted in bordered pills: `P/ID`, `Name`, `Guardian`, `Date`, `Age`, `Gender`, `Visit#`, `Whatsapp`, `Address`.
  - Split column body:
    - **Left Column:** Vitals block (`BP`, `Pulse`, `Wt`, `Temp`, `Allergies: NiL`) and `Symptoms / History` narrative (supporting Urdu Nastaleeq font).
    - **Right Column:** Large `Rx` calligraphic symbol, centered prescribed medicines with Potency, Dosage, Frequency, and Duration.
  - Bottom clinic footer banner `clinical_pad_footer.png`.

---

# 5. FEATURE-BY-FEATURE FUNCTIONAL SPECIFICATION

---

### 5.1 Patient Registration & Intake
- **Purpose:** Creates a permanent patient file and immediately records their opening consultation.
- **Location:** `#page-new-patient`.
- **How to Access:** Click `New Patient` on the sidebar navigation.
- **User Actions:** Fill in demographics, vitals, symptoms, medicines, and billing; click `Register Patient` or `WhatsApp`.
- **Inputs:** `f-registration-date`, `f-first-name`, `f-guardian-name`, `f-whatsapp`, `f-gender`, `f-guardian-relationship`, `f-age`, `f-pulse-rate`, `f-blood-pressure`, `f-temperature`, `f-oxygen-level`, `f-blood`, `f-weight`, `f-address`, `f-city`, `f-allergies`, `f-symptoms`, `f-medicines-text`, `f-consultation-fee`, `f-medicine-price`, `f-discount`, `f-amount-received`, `f-payment-status`.
- **Validation:**
  - `f-first-name` cannot be empty (highlights red with shake/error class).
  - `f-age` is required and must be between 0 and 150.
  - Dates must follow `YYYY-MM-DD` format.
  - Financial fields reject negative numbers.
- **Process:**
  1. Validates required inputs.
  2. Calculates financial values.
  3. Submits `POST /api/patient` payload.
  4. Backend executes an atomic SQLite transaction: inserts patient, generates next IDs (`REG-XXXXXX`, `IRE-XXXXXX`), inserts initial visit into `visits` table, and returns `patient_id`.
  5. Shows green toast notification (`✅ Patient Registered! ID #XX`).
  6. Resets form fields and updates Dashboard KPI counters.
- **Output/Result:** Clean form ready for the next patient; record visible in Search and Directory.
- **Database Behavior:** Inserts 1 row into `patients`, 1 row into `visits`.
- **Dependencies:** Express backend, SQLite driver, `setupBillingCalculations()`.
- **Edge Cases:** Base64 webcam photos exceeding normal limits are accepted up to 50MB and saved to disk as JPEG files in `uploads/`.

---

### 5.2 Patient Search Engine
- **Purpose:** Instantly locates patient records matching arbitrary queries.
- **Location:** `#page-search`, Topbar, and Dashboard header.
- **How to Access:** Sidebar `Patient Record` or top search bars.
- **User Actions:** Enter text or numeric ID.
- **Inputs:** Text query (`#search-input`, `#dash-quick-search`) or Numeric ID (`#search-id-input`, `#dash-id-search`).
- **Validation:** Strips leading/trailing spaces; handles empty query by loading latest patients.
- **Process:** Debounces user keystrokes by 250ms, sends `GET /api/patients?q=<query>`, matches against `name`, `first_name`, `last_name`, `phone`, `whatsapp_number`, `reg_id`, `ire_id`, `address`, `city`, `symptoms`, `medicines`, and `doctor`.
- **Output/Result:** Cards rendered in `#patients-grid` with highlight effects.
- **Database Behavior:** Executes SQL query with 22 wildcard bindings and limit of 50 records.

---

### 5.3 Slide-in Patient Record & Timeline
- **Purpose:** Comprehensive consultation workspace for inspecting a patient's medical history across all encounters.
- **Location:** `#record-panel`.
- **How to Access:** Click `View Record` on any patient card or directory row.
- **User Actions:** Inspect visits, view pathology photos, open A5 pad, add visits, edit demographics.
- **Process:** Fetches `GET /api/patient/:id`, populates demographics grid, parses JSON prescriptions, and constructs descending timeline cards.
- **Dependencies:** `jspdf`, `html2canvas`, `openClinicalPadModal()`.

---

### 5.4 Consultation Encounter Management (Add / Repeat / Edit Visit)
- **Purpose:** Records follow-up consultations, repeats previous medications, and edits existing notes.
- **Location:** Slide-in panel subforms.
- **User Actions:**
  - Click `Add Visit` to open blank encounter form.
  - Click `Repeat Previous Visit` to duplicate past medicines and vitals into form.
  - Click `Edit Visit` on any history card to modify historical records.
- **Database Behavior:** `POST /api/visit` inserts new row; `PUT /api/visit/:id` updates existing row; `DELETE /api/visit/:id` removes record.

---

### 5.5 WhatsApp Integration & Graphic Card Generation
- **Purpose:** Creates and sends branded, high-resolution visual cards directly to the patient's WhatsApp.
- **Location:** New Patient form, Edit Patient form, Slide-in panel header, and Visit timeline cards.
- **User Actions:** Click `WhatsApp` button.
- **Process:**
  1. Formats international phone number (`03...` -> `923...`).
  2. Injects hidden offscreen HTML cards (`#wa-card-capture` and `#wa-card-capture-meds`).
  3. Waits for images to load.
  4. Calls `html2canvas` at 2x pixel ratio.
  5. Copies PNG/JPEG data URL to system clipboard via Electron IPC `clipboard.writeImage()`.
  6. Opens WhatsApp URL (`https://wa.me/92...` or `https://web.whatsapp.com`).
  7. User simply presses `Ctrl + V` in WhatsApp to send the graphic card.

---

### 5.6 A5 Clinical Pad Preview & Print
- **Purpose:** Provides a 1:1 visual match of the physical A5 clinic prescription pad.
- **Location:** `#clinical-pad-modal`.
- **User Actions:** Click `View Pad` or `Print A5` on any visit card.
- **Process:** Calculates chronological visit number, lays out header/footer graphics, aligns vitals on the left and remedies on the right, and renders modal. Automatically copies JPG image to clipboard upon modal display.

---

### 5.7 Batch / Bulk Record PDF Export
- **Purpose:** Compiles a continuous multi-page PDF document for a specified range of patient registration numbers.
- **Location:** `#bulk-print-modal`.
- **How to Access:** Clinic Directory -> Click `Bulk Print`.
- **User Actions:** Specify `From Patient #` and `To Patient #`; click `Generate PDF`.
- **Process:** Queries all patients in range, iterates sequentially, fetches complete visit history for each, renders header banners, patient info, and medicines using jsPDF, embeds Urdu Nastaleeq font for Urdu names, advances progress bar, and triggers download of `Bulk_Records_X-Y_DATE.pdf`.

---

### 5.8 Medicine Inventory & Restock Request
- **Purpose:** Monitors dispensary stock and generates restock requisition orders for depleted medicines.
- **Location:** `#page-inventory`.
- **Features:**
  - CRUD operations on medicines table.
  - Category filtering (`Potency`, `Mother Tincture`, `Combination`).
  - Auto-generated SKU codes (`MED-XXXX`).
  - `Generate Restock PDF` (`window.generateRestockPDF()`): Filters all `Out of Stock` items, captures user-entered required quantities, and outputs a formatted table PDF for suppliers.

---

### 5.9 Backup, Email Dispatch & Smart Merge Restoration
- **Purpose:** Protects clinical data against hardware failure, corruption, or data loss.
- **Location:** `#page-backup`.
- **Operations:**
  - **Local Backup:** Executes SQLite `VACUUM INTO` command for hot backup without locking database; copies image uploads.
  - **Email Backup:** Builds self-describing JSON archive (`format: clinicms-backup-v1`) containing base64 database buffer and transmits via Gmail SMTP.
  - **Smart Merge Restore:** Takes safety snapshot of current database, attaches uploaded database (`ATTACH DATABASE ... AS backup_db`), iterates all tables, checks record timestamps (`updated_at` / `created_at`), inserts missing rows, updates older rows, preserves local newer edits, detaches, and presents detailed metrics summary modal.

---

### 5.10 Azan Prayer Alarm System
- **Purpose:** Audio reminder system for Islamic prayer times.
- **Location:** `#page-dashboard` (Right Column).
- **Features:**
  - Individual time settings for Fajr, Dhuhr, Asr, Maghrib, Isha.
  - Toggle switch to enable/disable each prayer.
  - Persistent settings stored in `settings` table and `localStorage`.
  - Background 10-second ticker checking current system time against active alarms.
  - Triggers HTML5 Audio player loading local file `azan1.mp3`.
  - Displays top banner with Urdu prayer announcement and `Stop` button.

---

### 5.11 Clinical Stopwatch & Laps Split
- **Purpose:** Precision timer for doctor consultations and clinical observations.
- **Location:** `#page-dashboard` (Right Column).
- **Features:**
  - Digital readout (`MM:SS.mmm`).
  - Analog 60-second dial with animated rotating second hand.
  - Controls: Start/Pause, Reset, Lap/Flag.
  - Records and logs split lap times in a scrollable list.

---

### 5.12 Desktop Calculator
- **Purpose:** Quick fee calculation and medical dosage math.
- **Location:** `#page-dashboard` (Right Column).
- **Features:**
  - Clean on-screen keypad with percentage, clear, and backspace.
  - Physical keyboard typing support (Enter for `=`, Esc for `C`, Backspace for `DEL`).

---

### 5.13 Quick Desk Notepad
- **Purpose:** Temporary scratchpad for doctor's clinical thoughts and dosage reminders.
- **Location:** `#page-dashboard` (Left Column).
- **Features:**
  - Dedicated patient name input.
  - Auto-saving textarea stored in browser `localStorage`.
  - Direct print action with customized clinic header.
  - `Copy Pad` button: Renders note inside A5 Clinical Pad template and copies image to clipboard.
  - `Copy Text` button: Copies note text with standardized footer.

---

# 6. COMPLETE STEP-BY-STEP USER WORKFLOWS

---

### Workflow 1: New Patient Registration & First Visit
1. User clicks **New Patient** on the sidebar.
2. The system navigates to `#page-new-patient` and fetches the next available ID (`/api/next-ire-id`).
3. User enters the patient's name, guardian name, WhatsApp number, selects gender and guardian relationship.
4. User enters the patient's age (e.g. `34`).
5. User enters vitals (Blood Pressure `130/85`, Pulse `76`, Temperature `98.6`, Weight `72`).
6. User enters physical complaints in **Symptoms** (e.g. `Chronic migraines, worse in sun`). Autocomplete suggestions assist typing.
7. User enters prescribed remedies in **Medicines** (e.g. `Belladonna 200, 4 drops twice daily`).
8. In the **Billing Row**, user inputs `Consultant Fee` (e.g. `1000`) and `Medicine Price` (e.g. `500`).
9. The system automatically computes `Total Amount` (`1500.00`) and `Final Amount` (`1500.00`).
10. User enters `Received Amount` (e.g. `1500`); the system sets `Remaining Balance` to `0.00` and `Payment Status` to `Paid`.
11. User clicks **Register Patient**.
12. System validates that Name and Age are present.
13. Payload is sent to `POST /api/patient`.
14. Database starts transaction, inserts record into `patients`, generates `REG-000123` and `IRE-000123`, inserts row into `visits`.
15. A success toast notification appears: `✅ Patient Registered! ID #123 created successfully.`
16. Form resets cleanly.

---

### Workflow 2: Patient Search & Opening Clinical Record
1. User clicks **Patient Record** on the sidebar (or uses the topbar search input).
2. User types a patient's name, phone number, or numeric ID into the search input.
3. Interactive mascot Bee starts searching animation.
4. The system queries `GET /api/patients?q=...` after a 250ms debounce.
5. Matching cards appear in the grid showing demographic highlights and last visit date.
6. User clicks **View Record** on the target card.
7. The right-side **Patient Record Panel (`#record-panel`)** slides smoothly into view.
8. Complete demographic badges and the chronological visit timeline are loaded and displayed.

---

### Workflow 3: Logging a Follow-Up Consultation (New Visit)
1. User opens the patient record in `#record-panel`.
2. User clicks the **Add Visit** button in the panel header.
3. The `#add-visit-form` expands inside the panel.
4. If medicines are unchanged, user clicks **Repeat Previous Visit**; the system automatically copies vitals, symptoms, diagnosis, and medicines from their last consultation into the form.
5. User adjusts any vitals, symptoms, or dosages as needed.
6. User enters the consultation fee and medicine price.
7. User clicks **Add Visit**.
8. System posts payload to `POST /api/visit`.
9. The visit is inserted into the database, linked to the patient ID.
10. The panel automatically refreshes, displaying the new consultation at the top of the history timeline.

---

### Workflow 4: Generating & Sending Graphic Cards via WhatsApp
1. User opens a patient record in `#record-panel` (or fills New Patient form).
2. User clicks the green **WhatsApp** button.
3. The system captures the consultation data, vitals, symptoms, and medicines.
4. The system renders an off-screen graphic card containing clinic header, patient identification, clinical details, and itemized billing.
5. `html2canvas` renders the DOM elements into high-resolution canvas at 2x scale.
6. The graphic image is converted to a PNG/JPEG blob and copied to the Windows system clipboard via Electron IPC (`copyImageToClipboard`).
7. The system opens WhatsApp (`https://wa.me/92...` or web app) in the external browser.
8. Toast notification instructs user: `✅ Copied to Clipboard! Paste in WhatsApp (Ctrl+V)`.
9. User opens the chat with the patient and presses `Ctrl + V` to send the branded card.

---

### Workflow 5: A5 Clinical Pad Preview, Copy & Print
1. User navigates to any visit entry in the patient timeline.
2. User clicks **View Pad**.
3. `#clinical-pad-modal` appears with the exact A5 wireframe: top header graphic, patient information pills, vitals box, symptoms narrative, `Rx` symbol, and centered remedies.
4. The system automatically copies a JPG raster of the pad to the clipboard in the background.
5. User can:
   - Click **🖼️ PNG** or **🖼️ JPG** to save the file to local disk.
   - Click **📋 Copy Image** to re-copy.
   - Click **🖨️ Print A5** to open the Electron/Windows print dialog configured for A5 paper.
6. User clicks **✖** to close the preview.

---

### Workflow 6: Generating Range Bulk PDF Records
1. User navigates to **Clinic Directory** (`#page-all-records`).
2. User clicks the **Bulk Print** button above the patient table.
3. The `#bulk-print-modal` modal opens.
4. User specifies the range: `From Patient #` (e.g. `1`) and `To Patient #` (e.g. `50`).
5. User clicks **Generate PDF**.
6. Progress bar appears and increments as each patient is fetched from `GET /api/patient/:id`.
7. jsPDF renders multi-page vector documents, applying `Jameel Noori Nastaleeq` font for any Urdu names.
8. Upon completion, the browser saves `Bulk_Records_1-50_YYYY-MM-DD.pdf`.
9. Modal closes and a success toast appears.

---

### Workflow 7: Medicine Inventory Reordering & Restock PDF
1. User clicks **Medicine Inventory** on the sidebar.
2. When inspecting depleted items, user checks the stock table.
3. To generate an order sheet for distributors, user clicks the restock action (`window.generateRestockPDF()`).
4. System filters all medicines where `stock_status == 'Out of Stock'`.
5. Requisition table is compiled with Serial Number, Medicine Name, Category, and Required Quantity.
6. A vector PDF titled `MEDICINE RESTOCK REQUEST` is downloaded (`Medicine_Restock_Request.pdf`).

---

### Workflow 8: Disaster Recovery - Email Backup & Smart Merge
1. User navigates to **Backup & Restore** (`#page-backup`).
2. **Setup:** User enters their Gmail address, 16-character Google App Password, and recipient backup email; clicks `Save Email Settings`.
3. **Dispatch:** User clicks `Send Backup by Email Now`. The system creates a hot SQLite backup, packs it into a `.backup.json` manifest, and emails it.
4. **Restoration:** On another PC or after system format, user opens `Backup & Restore` -> `Restore from Email Backup`.
5. User uploads the received `.backup.json` file.
6. System takes an emergency pre-restore snapshot of current data.
7. System runs `mergeDatabaseFromBuffer()`, matching IDs and timestamps, inserting missing rows, and updating outdated rows.
8. The **Restore Completed** modal (`#backup-summary-modal`) opens, detailing exact counts of new, updated, and skipped records.

---

# 7. CALCULATIONS, FORMULAS & BUSINESS LOGIC

### 7.1 Financial & Billing Engine
- **Gross Total Amount Formula:**
  $$\text{Total Amount} = \text{Consultation Fee} + \text{Medicine Price}$$
- **Net Final Amount Formula:**
  $$\text{Final Amount} = \max(0, \text{Total Amount} - \text{Discount})$$
- **Remaining Balance Formula:**
  $$\text{Remaining Balance} = \text{Final Amount} - \text{Amount Received}$$
- **Payment Status Logic:**
  - If `Remaining Balance <= 0` and `Amount Received > 0`, default is `Paid`.
  - If `Amount Received == 0` or `Remaining Balance > 0`, status can be set to `Unpaid`.

### 7.2 Patient Identifier Generation Logic
- **Registration ID (`reg_id`):**
  - Formatted as string: `'REG-' + String(patient_id).padStart(6, '0')`
  - Example: ID `1` becomes `REG-000001`.
- **Clinical ID (`ire_id`):**
  - Formatted as string: `'IRE-' + String(patient_id).padStart(6, '0')`
  - Example: ID `1` becomes `IRE-000001`.
- **Medicine SKU Code (`code`):**
  - Formatted as string: `'MED-' + String(next_medicine_id).padStart(4, '0')`
  - Example: ID `1` becomes `MED-0001`.

### 7.3 Revenue Attribution Rules
- **First Visit Revenue:**
  - Attributed **strictly** to the patient's initial registration visit (`MIN(id)` partitioned by `patient_id`).
  - Subsequent visits by the same patient are never categorized as First Visit Revenue.
- **Follow-up Revenue:**
  - Sum of `final_amount` across all visits where `visit_number > 1` and `payment_status = 'Paid'`.
- **Yearly Revenue:**
  - Grouped by `strftime('%Y', visit_date)` summing all paid encounters.

### 7.4 Milestone Target Calculation
- **Patient Target Percentage:**
  $$\text{Progress \%} = \min\left(100, \text{round}\left(\frac{\text{Total Patients}}{\text{Target Goal}} \times 100\right)\right)$$
- The visual progress track (`#track-patients-registered`) renders 20 segments; filled segments equal `Math.round(Progress % / 5)`.

---

# 8. SEARCH, FILTERING & AUTOCOMPLETE ENGINE

### 8.1 Multi-Attribute Search Query
When querying patients (`/api/patients?q=term`), the SQL engine evaluates 22 conditions:
```sql
WHERE p.reg_id LIKE ? 
   OR p.ire_id LIKE ?
   OR p.first_name LIKE ?
   OR p.last_name LIKE ?
   OR (p.first_name || ' ' || p.last_name) LIKE ?
   OR p.whatsapp_number LIKE ?
   OR p.address LIKE ?
   OR p.city LIKE ?
   OR p.gender LIKE ?
   OR CAST(p.age AS TEXT) = ?
   OR v.symptoms LIKE ?
   OR v.doctor LIKE ?
   OR v.medicines LIKE ?
   OR v.prescription LIKE ?
   OR v.payment_status LIKE ?
   OR CAST(v.final_amount AS TEXT) LIKE ?
   OR v.visit_date LIKE ?
   OR p.blood_group LIKE ?
   OR p.registration_date LIKE ?
   OR CAST(p.id AS TEXT) = ?
   OR CAST(p.registration_no AS TEXT) = ?
```

### 8.2 Autocomplete Suggestions Engine (`autocomplete.js`)
- **Endpoint:** `GET /api/suggestions?type=<field>&q=<query>`
- Supported Types:
  - `first_name`: Distinct patient names.
  - `guardian_name`: Distinct guardian names.
  - `city`: Distinct localities/cities.
  - `address`: Distinct street addresses.
  - `symptoms`: Parses historical comma-separated clinical symptoms and returns top 15 matches.
  - `medicines_text` / `scratchpad`: Combines previously prescribed medicines and all registered medicine names in inventory.
- **DOM Behavior:** Input fields use HTML5 `<datalist>`; textareas use floating popup dropdown positioned below the cursor.

---

# 9. REPORTING, PRINTING & DOCUMENT GENERATION

### 9.1 A5 Clinical Pad Layout Specifications
- **Paper Format:** ISO A5 (`148mm × 210mm`), portrait orientation, exact zero margins with clipping prevention.
- **Top Header:** Embedded `clinical_pad_header.png`.
- **Top Metadata Grid:** 3 rows of rounded pill containers (`1px solid #475569`, background `#fff`).
- **Divider:** Solid 2px `#000000` rule.
- **Left Column (width: 165px):**
  - Vitals grid: Blood Pressure, Pulse, Weight, Temperature, Allergies (`NiL`).
  - Divider: Solid 2px `#000000` rule.
  - Symptoms / History section supporting multi-line Urdu/English text.
- **Right Column:**
  - Calligraphic $R_x$ symbol (`font-family: Georgia, serif`, 22px).
  - Centered medicine prescriptions (Name, Potency, Dosage, Frequency, Duration).
- **Bottom Footer:** Embedded `clinical_pad_footer.png`.

### 9.2 PDF Document Exports Summary
1. **Clinical Patient Directory PDF (`exportPatientListPDF`):**
   - Portrait A4, emerald header bar, alternating row striping.
   - Columns: `#`, `Patient Name`, `Phone / WhatsApp`, `Prescribed Medicines`.
   - Embeds `Jameel Noori Nastaleeq` font for Urdu patient names.
2. **Medicine Directory PDF (`exportMedicineListPDF`):**
   - Filters by `in-stock` or `out-of-stock`.
   - Columns: `Medicine Name`, `Category`, `Company`, `Remaining Stock`.
3. **Medicine Restock Request PDF (`generateRestockPDF`):**
   - Formatted for pharmaceutical vendors.
   - Columns: `Serial No.`, `Medicine Name`, `Category`, `Required Quantity`.
4. **Bulk Patient Records PDF (`startBulkPrint`):**
   - Renders multi-page detailed patient reports for an entire range of registration numbers.
5. **Print Notepad (`printNotepad`):**
   - Generates pop-up window formatted with clinic header, date, centered clinical notes, and signature footer for printing.

---

# 10. HARDWARE, EXTERNAL & SYSTEM INTEGRATIONS

### 10.1 Web Camera Hardware Interface
- Accessible via `navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })`.
- Stream piped to `<video id="camera-video">`.
- Frame captured by drawing video to `<canvas id="camera-canvas">` with `canvas.toDataURL('image/jpeg', 0.9)`.
- Integrated error detection: displays `Camera Access Denied` UI when hardware is unplugged or permission is refused.

### 10.2 System Clipboard Integration
- Uses Electron context bridge `window.electronAPI.copyImageToClipboard(dataUrl)`.
- Main process decodes base64 data URL via `nativeImage.createFromDataURL()` and writes directly to Windows clipboard via `clipboard.writeImage()`.
- Browser fallback uses `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`.

### 10.3 WhatsApp Protocol Integration
- Strips punctuation, dashes, spaces from phone number.
- Converts Pakistan local mobile numbers:
  - `03001234567` -> `923001234567`
  - `3001234567` -> `923001234567`
- Opens via Electron `shell.openExternal('https://wa.me/923001234567')` or external browser window.

### 10.4 Gmail SMTP Backup Integration
- Protocol: Secure SMTP over TLS via `nodemailer`.
- Target: `smtp.gmail.com`, Port `587` (STARTTLS) or Port `465` (SSL).
- Payload: Self-contained JSON manifest containing base64 database string attached as `.backup.json`.

---

# 11. MASTER FEATURE CHECKLIST

### Dashboard & Analytics
- [x] Quick search by patient name, phone, or registration number
- [x] Direct search by numeric Patient ID
- [x] Total Patients KPI card with trend indicator
- [x] Today's Visits KPI card
- [x] 1st Visit Revenue KPI card
- [x] Expandable 1st Visit Revenue breakdown (Daily, Weekly, Monthly)
- [x] Segmented Progress Milestone Indicator (Patients vs Target Goal)
- [x] Patient Traffic by Area Horizontal Bar Chart
- [x] Blood Group Distribution Doughnut Chart
- [x] Growth Analytics Multi-tab Line/Bar Chart (Visits, Patients, Revenue)
- [x] Growth Analytics Date Range Filtering (7d, 28d, 90d, This Year, Last Year, Custom)
- [x] Medicine Stock Alerts (RAG Status) Alert Card List
- [x] Target Goals Configuration Form (Monthly Patient Target)
- [x] Revenue Coin Analytics Toggle & Card Breakdown
- [x] Yearly Revenue Historical Breakdown List
- [x] Quick Desk Notepad with auto-saving to local storage
- [x] Quick Desk Notepad Print Window Generator
- [x] Quick Desk Notepad Copy Pad (A5 image generator to clipboard)
- [x] Quick Desk Notepad Copy Text with standardized footer
- [x] Quick Desk Notepad Patient Name tagging
- [x] Clinical Stopwatch with SVG 0–60 analog dial and rotating hand
- [x] Clinical Stopwatch digital display with milliseconds
- [x] Clinical Stopwatch Lap/Flag split logging
- [x] Desktop Calculator with on-screen keypad
- [x] Desktop Calculator physical keyboard support
- [x] 5 Daily Prayer Azan Alarm Scheduler (Fajr, Dhuhr, Asr, Maghrib, Isha)
- [x] Azan Alarm audio playback with `azan1.mp3`
- [x] Azan Active Announcement Banner with Stop Button
- [x] Azan individual prayer time customization and toggle switches
- [x] Interactive Mascot Bee character animation with GSAP

### Patient Management & Clinical Encounters
- [x] New Patient Intake Registration form
- [x] Patient demographic recording (Name, Guardian, Relation, Gender, Age, DOB)
- [x] Clinical vitals recording (Pulse, BP, Temp, SpO2, Weight, Blood Group)
- [x] Geographical recording (Address, Area/City)
- [x] Patient medical allergy tracking
- [x] Freeform clinical symptoms textarea with autocomplete
- [x] Prescribed medicines textarea with autocomplete
- [x] Automated financial calculations (Total, Discount, Final, Received, Balance)
- [x] Automatic Registration ID (`REG-XXXXXX`) generation
- [x] Automatic Clinical ID (`IRE-XXXXXX`) generation
- [x] Patient photo upload via file picker
- [x] Patient photo live capture via web camera
- [x] Affected area pathology photos (up to 3 photos per visit)
- [x] Patient search with multi-field matching
- [x] Slide-in Patient Record Panel
- [x] Patient demographic details grid display
- [x] Descending chronological consultation history timeline
- [x] Add New Visit form for existing patients
- [x] Repeat Previous Visit / Repeat Patient one-click cloning
- [x] Edit Patient Profile & Latest Visit
- [x] Edit Historical Specific Consultation Visit
- [x] Delete Individual Visit
- [x] Delete Patient Record with cascading deletion of visits and images
- [x] Admin Password verification (`admin123` / `admin`) on sensitive edits
- [x] Duplicate patient detection check on registration

### WhatsApp & Clinical Pad Integrations
- [x] Branded Patient Card image generation via html2canvas
- [x] Branded Prescribed Medicines Card generation via html2canvas
- [x] Branded Billing Summary Card generation via html2canvas
- [x] Clipboard image copy via Electron IPC / Navigator API
- [x] Automatic WhatsApp phone number formatting (`+92`)
- [x] External deep-linking to `https://wa.me/`
- [x] A5 Clinical Pad preview modal (`#clinical-pad-modal`)
- [x] A5 Clinical Pad PNG export
- [x] A5 Clinical Pad JPEG export
- [x] A5 Clinical Pad clipboard copy
- [x] A5 Clinical Pad direct printing
- [x] Single Visit Prescription Card generator (`printVisitPrescription`)
- [x] Offline Urdu Nastaleeq typography support (`Jameel Noori Nastaleeq`)
- [x] Online fallback Urdu typography (`Gulzar`)

### Medicine Inventory Management
- [x] Add New Medicine form
- [x] Medicine SKU Code auto-generation (`MED-XXXX`)
- [x] Medicine category classification (Potency, Mother Tincture, Combination)
- [x] Medicine stock quantity tracking
- [x] Medicine stock status control (`In Stock`, `Out of Stock`)
- [x] Edit Medicine details
- [x] Delete Medicine record
- [x] Search medicines inventory
- [x] Generate Medicine Restock Request PDF

### Clinic Directory & Batch Reporting
- [x] Unified Clinic Directory screen
- [x] Master Patients Directory table with pagination
- [x] Patient search and blood group filter
- [x] Export Clinical Patient Directory PDF
- [x] Direct print patient directory
- [x] Master Medicines Directory table with pagination
- [x] Medicine search and out-of-stock filter
- [x] Export In-Stock Medicines PDF
- [x] Export Out-of-Stock Medicines PDF
- [x] Bulk Print Patient Records modal
- [x] Multi-patient batch PDF compilation with progress bar

### Backup, Recovery & Security
- [x] Hot local SQLite database backup via `VACUUM INTO`
- [x] Patient photo uploads folder recursive backup
- [x] List existing local backups with creation timestamps
- [x] Restore database and uploads from local backup folder
- [x] Gmail SMTP email configuration with Google App Password
- [x] Send database backup manifest via email attachment (`.backup.json`)
- [x] Restore database from uploaded `.backup.json` file
- [x] Smart Merge restoration engine (merges without deleting local data)
- [x] Pre-restore emergency safety database snapshot
- [x] Backup merge summary metrics modal (New, Updated, Skipped, Total)
- [x] Admin password dialog overlay for authorized operations
- [x] Delete confirmation modal dialog
