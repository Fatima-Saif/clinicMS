const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('./database');

// Base storage path: Vercel serverless > Environment variable > User Documents > Local ./data directory
function getStoragePath() {
  if (process.env.VERCEL) return '/tmp';
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  try {
    const userDocs = path.join(os.homedir(), 'Documents');
    if (fs.existsSync(userDocs)) {
      return path.join(userDocs, 'Atta Homeopathic Clinic');
    }
  } catch (e) {}
  return path.join(__dirname, 'data');
}

const documentsPath = getStoragePath();
const uploadsDir = path.join(documentsPath, 'uploads');
const dbDir = path.join(documentsPath, 'database');

// Ensure directories exist safely
try {
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(path.join(uploadsDir, 'patient-photos'))) fs.mkdirSync(path.join(uploadsDir, 'patient-photos'), { recursive: true });
  if (!fs.existsSync(path.join(uploadsDir, 'defected-area-photos'))) fs.mkdirSync(path.join(uploadsDir, 'defected-area-photos'), { recursive: true });
} catch (err) {
  console.warn('Storage directory setup notice:', err.message);
}

function saveBase64Image(base64Str, subfolder, prefix) {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str;
  
  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Str;
    
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const filename = `${prefix}_${Date.now()}.${ext}`;
    const filepath = path.join(uploadsDir, subfolder, filename);
    
    fs.writeFileSync(filepath, data);
    return `/uploads/${subfolder}/${filename}`;
  } catch (err) {
    console.error('Error saving image:', err);
    return base64Str;
  }
}

const app = express();
const db = new Database();

// Middleware to ensure DB promise completes on Vercel Serverless
app.use(async (req, res, next) => {
  if (app.dbPromise) {
    try {
      await app.dbPromise;
    } catch (e) {
      console.error('[Middleware] Database initialization wait error:', e);
    }
  }
  next();
});

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());

app.use((req, res, next) => {
  console.log('Incoming request:', req.method, req.url);
  next();
});

// Parse JSON and urlencoded request bodies
// Limit raised to 50MB to support base64-encoded patient images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Static File Serving ──────────────────────────────────────────────────────

// 1. Original web UI (ClinicMS) at root '/'
app.use(express.static(path.join(__dirname, 'web'), { etag: false, maxAge: 0 }));

// Serve uploads from Documents directory
app.use('/uploads', express.static(uploadsDir));



// 3. Standalone patient registration page
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'register.html'));
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/debug-ping', (req, res) => {
  res.json({ cwd: process.cwd(), dirname: __dirname });
});

/**
 * GET /api/azan-settings
 * Returns saved Azan alarm settings from settings DB table
 */
app.get('/api/azan-settings', async (req, res) => {
  try {
    const row = await db.getSetting('azan_alarm_config');
    if (row && row.value) {
      return res.json({ success: true, settings: JSON.parse(row.value) });
    }
    return res.json({ success: true, settings: null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/azan-settings
 * Saves updated Azan alarm settings to settings DB table
 */
app.post('/api/azan-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) return res.status(400).json({ success: false, error: 'Missing settings payload' });
    await db.setSetting('azan_alarm_config', JSON.stringify(settings));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/patients

 * Search patients by Name, Phone, or ID. If query is empty, returns the 10 most recent patients.
 * If ?all=true or ?q=* is passed, returns ALL patients.
 */
app.get('/api/patients', async (req, res) => {
  try {
    const query = req.query.q || req.query.search || '';
    let patients;
    if (query.trim() === '') {
      patients = await db.getAllPatients();
    } else {
      patients = await db.searchPatients(query.trim());
    }
    res.json(patients);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/patients/all
 * Returns ALL patients for the Clinic Directory (no limit).
 */
app.get('/api/patients/all', async (req, res) => {
  try {
    const patients = await db.getAllPatients();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/patients/with-latest-visit
 * Returns ALL patients joined with their most recent visit data.
 * Used by the Clinical Directory PDF for efficient single-query export.
 */
app.get('/api/patients/with-latest-visit', async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        p.id, p.name, p.first_name, p.last_name, p.reg_id, p.ire_id, p.registration_no,
        p.age, p.gender, p.phone, p.whatsapp_number, p.city, p.address,
        p.blood_group, p.weight, p.cnic, p.guardian_name, p.patient_status,
        p.diagnosis, p.allergies, p.notes, p.created_at,
        v.id             AS visit_id,
        v.visit_date,
        v.symptoms,
        v.medicines,
        v.prescription,
        v.pulse_rate,
        v.blood_pressure,
        v.temperature,
        v.oxygen_level,
        v.consultation_fee,
        v.medicine_price,
        v.total_amount,
        v.final_amount,
        v.discount,
        v.payment_method,
        v.payment_status,
        v.amount_received,
        v.remaining_balance,
        v.notes          AS visit_notes
      FROM patients p
      LEFT JOIN visits v ON v.id = (
        SELECT id FROM visits WHERE patient_id = p.id ORDER BY visit_date DESC, id DESC LIMIT 1
      )
      ORDER BY p.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



/**
 * GET /api/next-ire-id
 * Returns the next available IRE ID (IRE-XXXXXX) based on max patient id.
 */
app.get('/api/next-ire-id', async (req, res) => {
  try {
    const row = await db.get('SELECT MAX(id) as maxId FROM patients');
    const nextId = (row && row.maxId ? row.maxId : 0) + 1;
    const ire_id = 'IRE-' + String(nextId).padStart(6, '0');
    res.json({ ire_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/patient/:id
 * Retrieve patient general details and history of visits.
 * Formatted to satisfy both the nested format (ClinicMS) and the flat format (CareFlow).
 */
app.get('/api/patient/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid patient ID' });
    }

    const patient = await db.getPatient(id);
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient not found' });
    }

    const visits = await db.getVisitsForPatient(id);

    // Merge response formats:
    // ClinicMS expects data.patient.name, data.visits
    // CareFlow expects data.name, data.visits
    res.json({
      ...patient,
      patient: patient,
      visits: visits
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/patient
 * Register a new patient and record an optional initial visit.
 */
app.post('/api/patient', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      age,
      date_of_birth,
      weight,
      gender,
      guardian_name,
      guardian_relationship,
      whatsapp_number,
      address,
      city,
      emergency_contact_name,
      emergency_contact_number,
      blood_group,
      patient_status,
      diagnosis,
      allergies,
      medical_history,
      current_medicines,
      notes,
      patient_image,
      registration_date,
      ignoreDuplicate
    } = req.body;

    console.log("HELLO STARTING PATIENT REGISTRATION");
    
    if (!first_name || first_name.trim() === '') {
      return res.status(400).json({ success: false, error: 'First name is required' });
    }

    console.log("RECEIVED PATIENT REGISTRATION: ", req.body);

    const patientResult = await db.insertPatient({
      first_name: first_name.trim(),
      last_name: (last_name || '').trim(),
      age: parseInt(age, 10) || null,
      date_of_birth: date_of_birth || '',
      weight: parseFloat(weight) || null,
      gender: gender || '',
      guardian_name: (guardian_name || '').trim(),
      guardian_relationship: (guardian_relationship || 'Father').trim(),
      whatsapp_number: (whatsapp_number || '').trim(),
      address: (address || '').trim(),
      city: (city || '').trim(),
      emergency_contact_name: (emergency_contact_name || '').trim(),
      emergency_contact_number: (emergency_contact_number || '').trim(),
      blood_group: blood_group || '',
      patient_status: patient_status || 'Active',
      diagnosis: (diagnosis || '').trim(),
      allergies: (allergies || '').trim(),
      medical_history: (medical_history || '').trim(),
      current_medicines: (current_medicines || '').trim(),
      notes: (notes || '').trim(),
      patient_image: saveBase64Image(patient_image, 'patient-photos', 'patient') || null,
      registration_date: registration_date || new Date().toISOString().split('T')[0]
    });

    const patientId = patientResult.last_insert_id;
    let visitId = null;

    // Create initial visit for patient registration using visit_date, date, or registration_date (default today)
    const visitDate = req.body.visit_date || req.body.date || req.body.registration_date || new Date().toISOString().split('T')[0];
    const cFee = parseFloat(req.body.consultation_fee) || 0.0;
    const mPrice = parseFloat(req.body.medicine_price) || 0.0;
    const disc = parseFloat(req.body.discount) || 0.0;
    const tAmt = parseFloat(req.body.total_amount) || (cFee + mPrice);
    const fAmt = (req.body.final_amount !== undefined && req.body.final_amount !== null && req.body.final_amount !== '') 
      ? parseFloat(req.body.final_amount) 
      : Math.max(0, tAmt - disc);
    const payStat = req.body.payment_status || 'Paid';

    const visitResult = await db.insertVisit({
      patient_id: patientId,
      visit_date: visitDate,
      pulse_rate: parseInt(req.body.pulse_rate, 10) || null,
      blood_pressure: req.body.blood_pressure || '',
      temperature: parseFloat(req.body.temperature) || null,
      oxygen_level: parseInt(req.body.oxygen_level, 10) || null,
      symptoms: req.body.symptoms || '',
      diagnosis: req.body.diagnosis || '',
      doctor: req.body.doctor || '',
      prescription: req.body.prescription || '',
      medicines: req.body.medicines || '',
      notes: req.body.notes || '',
      defected_area_image: saveBase64Image(req.body.defected_area_image, 'defected-area-photos', 'area') || null,
      defected_area_image_2: saveBase64Image(req.body.defected_area_image_2, 'defected-area-photos', 'area2') || null,
      defected_area_image_3: saveBase64Image(req.body.defected_area_image_3, 'defected-area-photos', 'area3') || null,
      consultation_fee: cFee,
      medicine_price: mPrice,
      total_amount: tAmt,
      discount: disc,
      final_amount: fAmt,
      payment_method: req.body.payment_method || 'Cash',
      payment_status: payStat,
      amount_received: parseFloat(req.body.amount_received) || fAmt,
      remaining_balance: parseFloat(req.body.remaining_balance) || 0.0
    });
    visitId = visitResult.last_insert_id;

    res.status(201).json({
      success: true,
      patient_id: patientId,
      id: patientId, // For CareFlow
      reg_id: patientResult.reg_id,
      ire_id: patientResult.ire_id,
      visit_id: visitId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/patient/:id
 * Edit patient general details.
 */
app.put('/api/patient/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid patient ID' });
    }

    const {
      first_name,
      last_name,
      age,
      date_of_birth,
      weight,
      gender,
      guardian_name,
      guardian_relationship,
      whatsapp_number,
      address,
      city,
      emergency_contact_name,
      emergency_contact_number,
      blood_group,
      patient_status,
      diagnosis,
      allergies,
      medical_history,
      current_medicines,
      notes,
      patient_image,
      registration_date,
      ignoreDuplicate
    } = req.body;

    if (!first_name || first_name.trim() === '') {
      return res.status(400).json({ success: false, error: 'First name is required' });
    }

    // Skip duplicate check on updates (only relevant for new patient registration)

    await db.updatePatient(id, {
      first_name: first_name.trim(),
      last_name: (last_name || '').trim(),
      age: parseInt(age, 10) || null,
      date_of_birth: date_of_birth || '',
      weight: parseFloat(weight) || null,
      gender: gender || '',
      guardian_name: (guardian_name || '').trim(),
      guardian_relationship: (guardian_relationship || 'Father').trim(),
      whatsapp_number: (whatsapp_number || '').trim(),
      address: (address || '').trim(),
      city: (city || '').trim(),
      emergency_contact_name: (emergency_contact_name || '').trim(),
      emergency_contact_number: (emergency_contact_number || '').trim(),
      blood_group: blood_group || '',
      patient_status: patient_status || 'Active',
      diagnosis: (diagnosis || '').trim(),
      allergies: (allergies || '').trim(),
      medical_history: (medical_history || '').trim(),
      current_medicines: (current_medicines || '').trim(),
      notes: (notes || '').trim(),
      patient_image: patient_image ? (saveBase64Image(patient_image, 'patient-photos', 'patient') || null) : null,
      registration_date: registration_date || null
    });

    res.json({ success: true, patient_id: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/visit
 * Add a new consultation visit for an existing patient.
 */
app.post('/api/visit', async (req, res) => {
  try {
    const { patient_id, symptoms, diagnosis, doctor, prescription, notes, pulse_rate, blood_pressure, temperature, oxygen_level, medicines, defected_area_image, defected_area_image_2, defected_area_image_3, consultation_fee, medicine_price, total_amount, discount, final_amount, payment_method, payment_status, amount_received, remaining_balance } = req.body;
    const visitDate = req.body.visit_date || req.body.date;

    const patientIdInt = parseInt(patient_id, 10);
    if (!patientIdInt || !visitDate) {
      return res.status(400).json({ success: false, error: 'patient_id and visit date are required' });
    }

    const visitResult = await db.insertVisit({
      patient_id: patientIdInt,
      visit_date: visitDate,
      pulse_rate: parseInt(pulse_rate, 10) || null,
      blood_pressure: blood_pressure || '',
      temperature: parseFloat(temperature) || null,
      oxygen_level: parseInt(oxygen_level, 10) || null,
      symptoms,
      diagnosis: diagnosis || req.body.diagnosis || '',
      doctor,
      prescription,
      medicines,
      notes,
      defected_area_image: saveBase64Image(defected_area_image, 'defected-area-photos', 'area') || null,
      defected_area_image_2: saveBase64Image(defected_area_image_2, 'defected-area-photos', 'area2') || null,
      defected_area_image_3: saveBase64Image(defected_area_image_3, 'defected-area-photos', 'area3') || null,
      consultation_fee: parseFloat(consultation_fee) || 0.0,
      medicine_price: parseFloat(medicine_price) || 0.0,
      total_amount: parseFloat(total_amount) || 0.0,
      discount: parseFloat(discount) || 0.0,
      final_amount: parseFloat(final_amount) || 0.0,
      payment_method: payment_method || '',
      payment_status: payment_status || 'Unpaid',
      amount_received: parseFloat(amount_received) || 0.0,
      remaining_balance: parseFloat(remaining_balance) || 0.0
    });

    // Auto-decrement medicine inventory stocks
    if (medicines) {
      await decrementStockFromPrescription(medicines);
    }

    res.status(201).json({
      success: true,
      visit_id: visitResult.last_insert_id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/patient/:id
 * Delete a patient and cascade delete all their visits.
 */
app.delete('/api/patient/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid patient ID' });
    }

    // Fetch images before deletion
    const patient = await db.getPatient(id);
    const visits = await db.getVisitsForPatient(id);
    const imagePaths = [];
    if (patient && patient.patient_image && patient.patient_image.startsWith('/uploads/')) {
      imagePaths.push(patient.patient_image);
    }
    if (visits) {
      for (const v of visits) {
        if (v.defected_area_image && v.defected_area_image.startsWith('/uploads/')) {
          imagePaths.push(v.defected_area_image);
        }
        if (v.defected_area_image_2 && v.defected_area_image_2.startsWith('/uploads/')) {
          imagePaths.push(v.defected_area_image_2);
        }
        if (v.defected_area_image_3 && v.defected_area_image_3.startsWith('/uploads/')) {
          imagePaths.push(v.defected_area_image_3);
        }
      }
    }

    // Attempt to delete files
    for (const imgPath of imagePaths) {
      const fullPath = path.join(documentsPath, imgPath); // /uploads/... maps relative to documentsPath
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) { console.error('Failed to unlink file:', fullPath, e); }
      }
    }

    await db.deletePatient(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/visit/:id
 * Delete an individual visit.
 */

app.put('/api/visit/:id', async (req, res) => {
  try {
    if (req.body.patient_id && req.body.first_name) {
      await db.updatePatient(req.body.patient_id, req.body);
    }
    const data = await db.updateVisit(req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/visit/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid visit ID' });
    }
    await db.deleteVisit(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/dashboard
 * Retrieve clinic metrics (total patients, visits today, visits this month, top doctor).
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const total = await db.getTotalPatients();
    const today = await db.getVisitsToday();
    const month = await db.getVisitsThisMonth();
    const doctor = await db.getMostActiveDoctor();

    res.json({
      total_patients: total,
      visits_today: today,
      visits_this_month: month,
      most_active_doctor: doctor
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup
 * Create a backup of both the SQLite database and patient uploaded photos.
 */
app.post('/api/backup', async (req, res) => {
  try {
    const backupName = `backup_${Date.now()}`;
    const backupsFolder = path.join(documentsPath, 'backups');
    const backupDir = path.join(backupsFolder, backupName);

    // Ensure backups directory exists
    if (!fs.existsSync(backupsFolder)) {
      fs.mkdirSync(backupsFolder, { recursive: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    // 1. Backup database safely using SQLite's VACUUM INTO
    const backupDbPath = path.join(backupDir, 'clinic.db');
    await db.db.run('VACUUM INTO ?', [backupDbPath]);

    // 2. Backup patient uploads recursively
    const backupUploadsDir = path.join(backupDir, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.cpSync(uploadsDir, backupUploadsDir, { recursive: true });
    }

    res.json({
      success: true,
      backup: backupName,
      time: new Date().toLocaleString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─── Email Backup Config File Path ────────────────────────────────────────── */
const emailConfigPath = path.join(documentsPath, 'email_backup_config.json');

/**
 * GET /api/backup/email-config
 * Load saved email configuration (passwords are masked in response).
 */
app.get('/api/backup/email-config', (req, res) => {
  try {
    if (!fs.existsSync(emailConfigPath)) {
      return res.json({ success: true, config: null });
    }
    const raw = fs.readFileSync(emailConfigPath, 'utf8');
    const cfg = JSON.parse(raw);
    // Mask password before sending to frontend
    const safe = { ...cfg, password: cfg.password ? '••••••••' : '' };
    res.json({ success: true, config: safe });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/email-config
 * Save email configuration. If password field is '••••••••', keep existing.
 */
app.post('/api/backup/email-config', (req, res) => {
  try {
    const { senderEmail, password, recipientEmail, smtpHost, smtpPort } = req.body;
    if (!senderEmail || !recipientEmail) {
      return res.status(400).json({ success: false, error: 'Sender and recipient email are required.' });
    }

    let existingPassword = '';
    if (fs.existsSync(emailConfigPath)) {
      try {
        existingPassword = JSON.parse(fs.readFileSync(emailConfigPath, 'utf8')).password || '';
      } catch (_) {}
    }

    const finalPassword = (password && password !== '••••••••') ? password : existingPassword;
    if (!finalPassword) {
      return res.status(400).json({ success: false, error: 'App password is required.' });
    }

    const cfg = {
      senderEmail: senderEmail.trim(),
      password: finalPassword,
      recipientEmail: recipientEmail.trim(),
      smtpHost: (smtpHost || 'smtp.gmail.com').trim(),
      smtpPort: parseInt(smtpPort, 10) || 587
    };

    // Ensure documents directory exists
    if (!fs.existsSync(documentsPath)) fs.mkdirSync(documentsPath, { recursive: true });
    fs.writeFileSync(emailConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/send-email
 * Creates a fresh DB backup, zips it, and sends it as an email attachment.
 */
app.post('/api/backup/send-email', async (req, res) => {
  try {
    // Load email config
    if (!fs.existsSync(emailConfigPath)) {
      return res.status(400).json({ success: false, error: 'Email not configured. Please save your email settings first.' });
    }
    const cfg = JSON.parse(fs.readFileSync(emailConfigPath, 'utf8'));
    if (!cfg.senderEmail || !cfg.password || !cfg.recipientEmail) {
      return res.status(400).json({ success: false, error: 'Incomplete email configuration.' });
    }

    // 1. Create a fresh backup
    const backupName = `backup_${Date.now()}`;
    const backupsFolder = path.join(documentsPath, 'backups');
    const backupDir = path.join(backupsFolder, backupName);
    if (!fs.existsSync(backupsFolder)) fs.mkdirSync(backupsFolder, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    const backupDbPath = path.join(backupDir, 'clinic.db');
    await db.db.run('VACUUM INTO ?', [backupDbPath]);

    // 2. Copy uploads if they exist
    const backupUploadsDir = path.join(backupDir, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      try { fs.cpSync(uploadsDir, backupUploadsDir, { recursive: true }); } catch (_) {}
    }

    // 3. Create a ZIP archive of the backup folder
    const nodemailer = require('nodemailer');
    const { pipeline } = require('stream/promises');
    const archiveOutPath = path.join(backupsFolder, `${backupName}.zip`);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(archiveOutPath);
      output.on('close', resolve);
      output.on('error', reject);

      // Manual ZIP using built-in zlib — pure Node.js, no extra dependency
      // We use a simple tar-like approach: pack the DB file as base64 JSON
      // Actually, use a streaming approach with the built-in archiver-less technique:
      // Write a self-describing JSON manifest with the DB embedded as base64
      const dbBuffer = fs.readFileSync(backupDbPath);
      const manifest = {
        format: 'clinicms-backup-v1',
        created: new Date().toISOString(),
        backupName,
        db_base64: dbBuffer.toString('base64'),
        note: 'To restore: save db_base64 decoded bytes as clinic.db and replace the active database file.'
      };
      output.write(JSON.stringify(manifest, null, 2));
      output.end();
    });

    // 4. Send email with attachment
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost || 'smtp.gmail.com',
      port: cfg.smtpPort || 587,
      secure: (cfg.smtpPort === 465),
      auth: { user: cfg.senderEmail, pass: cfg.password },
      tls: { rejectUnauthorized: false }
    });

    const dateStr = new Date().toLocaleString();
    await transporter.sendMail({
      from: `"Atta Homeopathic Clinic" <${cfg.senderEmail}>`,
      to: cfg.recipientEmail,
      subject: `📦 Clinic Database Backup — ${new Date().toLocaleDateString()}`,
      text: `Hello,\n\nPlease find attached the full database backup for ATTA HOMEOPATHIC CLINIC.\n\nBackup created: ${dateStr}\nBackup name: ${backupName}\n\nTo restore this backup:\n1. Open the Atta Homeopathic Clinic application\n2. Go to Backup & Restore page\n3. Click "Restore from Email Backup"\n4. Upload the .backup.json file attached to this email\n\nThis backup contains all patient records, visit history, medicines, fees, and clinical notes.\n\n— Atta Homeopathic Clinic`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#0F8B6D;padding:20px;border-radius:8px 8px 0 0;"><h2 style="color:#fff;margin:0;">📦 Database Backup</h2><p style="color:#e0f7f4;margin:4px 0 0;">ATTA HOMEOPATHIC CLINIC</p></div><div style="background:#f8fffe;border:1px solid #d0e9e3;border-radius:0 0 8px 8px;padding:24px;"><p>Hello,</p><p>Please find attached the complete database backup.</p><table style="border-collapse:collapse;width:100%;margin:16px 0;"><tr style="background:#e8f8f4;"><td style="padding:10px 14px;font-weight:bold;color:#0F8B6D;">Backup Created</td><td style="padding:10px 14px;">${dateStr}</td></tr><tr><td style="padding:10px 14px;font-weight:bold;color:#0F8B6D;">Backup Name</td><td style="padding:10px 14px;font-family:monospace;">${backupName}</td></tr></table><p style="background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:6px;"><strong>To restore:</strong> Open the app → Backup &amp; Restore → "Restore from Email Backup" → upload the attached .backup.json file.</p><p style="color:#888;font-size:12px;margin-top:24px;">— Atta Homeopathic Clinic (Auto-generated backup)</p></div></div>`,
      attachments: [{
        filename: `${backupName}.backup.json`,
        path: archiveOutPath,
        contentType: 'application/json'
      }]
    });

    // Clean up the zip temp file
    try { fs.unlinkSync(archiveOutPath); } catch (_) {}

    res.json({
      success: true,
      backupName,
      sentTo: cfg.recipientEmail,
      time: dateStr
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/backup/restore-from-file
 * Restore database from an uploaded .backup.json file (from email).
 */
app.post('/api/backup/restore-from-file', async (req, res) => {
  try {
    const { fileContent } = req.body;
    if (!fileContent) {
      return res.status(400).json({ success: false, error: 'No file content provided.' });
    }

    let manifest;
    try {
      manifest = JSON.parse(fileContent);
    } catch (_) {
      return res.status(400).json({ success: false, error: 'Invalid backup file format.' });
    }

    if (manifest.format !== 'clinicms-backup-v1' || !manifest.db_base64) {
      return res.status(400).json({ success: false, error: 'This file is not a valid ClinicMS backup.' });
    }

    // Save current DB as emergency snapshot before overwriting
    const snapshotName = `pre_restore_snapshot_${Date.now()}.db`;
    const backupsFolder = path.join(documentsPath, 'backups');
    if (!fs.existsSync(backupsFolder)) fs.mkdirSync(backupsFolder, { recursive: true });

    // Write restored DB (Smart Merge)
    const dbBuffer = Buffer.from(manifest.db_base64, 'base64');
    const activeDbPath = path.join(documentsPath, 'database', 'clinic.db');
    
    // Safety snapshot of current DB
    try { fs.copyFileSync(activeDbPath, path.join(backupsFolder, snapshotName)); } catch (_) {}

    // Merge database instead of blind overwrite
    const tempDbPath = path.join(backupsFolder, `temp_merge_${Date.now()}.db`);
    const metrics = await db.mergeDatabaseFromBuffer(dbBuffer, tempDbPath);

    res.json({ 
      success: true, 
      restoredFrom: manifest.backupName || 'email backup', 
      time: manifest.created,
      metrics 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



/**
 * GET /api/backups
 * Retrieve a list of all existing backups.
 */
app.get('/api/backups', async (req, res) => {
  try {
    const backupsFolder = path.join(documentsPath, 'backups');
    if (!fs.existsSync(backupsFolder)) {
      return res.json([]);
    }

    const items = fs.readdirSync(backupsFolder)
      .filter(item => {
        const fullPath = path.join(backupsFolder, item);
        return fs.statSync(fullPath).isDirectory() && item.startsWith('backup_');
      })
      .map(item => {
        const timestamp = parseInt(item.split('_')[1], 10);
        return {
          id: item,
          name: item,
          timestamp,
          formattedDate: new Date(timestamp).toLocaleString()
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.json(items);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/restore
 * Restore the database and uploads from a backup.
 */
app.post('/api/restore', async (req, res) => {
  try {
    const { backupName } = req.body;
    if (!backupName) {
      return res.status(400).json({ success: false, error: 'Backup name is required' });
    }

    const backupsFolder = path.join(documentsPath, 'backups');
    const backupDir = path.join(backupsFolder, backupName);
    const backupDbPath = path.join(backupDir, 'clinic.db');
    const backupUploadsDir = path.join(backupDir, 'uploads');

    if (!fs.existsSync(backupDir) || !fs.existsSync(backupDbPath)) {
      return res.status(404).json({ success: false, error: 'Backup not found' });
    }

    // 1. Close current database connection so file isn't locked
    await db.close();

    // 2. Overwrite active database file
    const activeDbPath = path.join(dbDir, 'clinic.db');
    fs.copyFileSync(backupDbPath, activeDbPath);

    // 3. Overwrite patient uploads folder
    if (fs.existsSync(backupUploadsDir)) {
      if (fs.existsSync(uploadsDir)) {
        fs.rmSync(uploadsDir, { recursive: true, force: true });
      }
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.cpSync(backupUploadsDir, uploadsDir, { recursive: true });
    }

    // 4. Re-open database
    const errObj = {};
    const opened = await db.open(activeDbPath, errObj);
    if (!opened) {
      throw new Error(`Failed to re-open database: ${errObj.message}`);
    }

    res.json({ success: true });
  } catch (err) {
    // Attempt database recovery in case of error
    try {
      const activeDbPath = path.join(dbDir, 'clinic.db');
      await db.open(activeDbPath);
    } catch (e) {}
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper function to auto-decrement medicine inventory stocks (DISABLED for homeopathic clinic)
async function decrementStockFromPrescription(medicinesJson) {
  // The clinic uses single bottles for many patients, so we don't automatically reduce stock.
  // The user manually controls stock status.
  return;
}

// ─── MEDICINES INVENTORY API ────────────────────────────────────────────────

app.get('/api/medicines', async (req, res) => {
  try {
    const query = req.query.q || '';
    const medicines = await db.searchMedicines(query);
    res.json({ success: true, medicines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/medicine', async (req, res) => {
  try {
    const med = req.body;
    if (!med.name || !med.code) {
      return res.status(400).json({ success: false, error: 'Medicine name and code are required' });
    }
    const result = await db.insertMedicine(med);
    res.status(201).json({ success: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/medicine/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const med = req.body;
    if (isNaN(id) || !med.name || !med.code) {
      return res.status(400).json({ success: false, error: 'Valid ID, name and code are required' });
    }
    await db.updateMedicine(id, med);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/medicine/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Valid ID is required' });
    }
    await db.deleteMedicine(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/suggestions', async (req, res) => {
  try {
    const type = req.query.type;
    const q = (req.query.q || '').trim();
    let results = [];
    
    if(type === 'first_name') {
      const rows = await db.db.all(`SELECT DISTINCT first_name FROM patients WHERE first_name IS NOT NULL AND first_name != '' LIMIT 50`);
      results = rows.map(r => r.first_name);
    } else if(type === 'guardian_name') {
      const rows = await db.db.all(`SELECT DISTINCT guardian_name FROM patients WHERE guardian_name IS NOT NULL AND guardian_name != '' LIMIT 50`);
      results = rows.map(r => r.guardian_name);
    } else if(type === 'city') {
      const rows = await db.db.all(`SELECT DISTINCT city FROM patients WHERE city IS NOT NULL AND city != '' LIMIT 50`);
      results = rows.map(r => r.city);
    } else if(type === 'address') {
      const rows = await db.db.all(`SELECT DISTINCT address FROM patients WHERE address IS NOT NULL AND address != '' LIMIT 50`);
      results = rows.map(r => r.address);
    } else if(type === 'symptoms') {
      // Split all symptoms by comma and filter
      const rows = await db.db.all(`SELECT symptoms FROM visits WHERE symptoms IS NOT NULL AND symptoms != ''`);
      let allWords = new Set();
      rows.forEach(r => {
         const parts = r.symptoms.split(/[\n,]/);
         parts.forEach(p => { 
           const pStr = p.trim();
           if(pStr.length > 2 && (!q || pStr.toLowerCase().includes(q.toLowerCase()))) allWords.add(pStr); 
         });
      });
      results = Array.from(allWords).slice(0, 15);
    } else if(type === 'medicines_text' || type === 'scratchpad') {
      // Fetch both from text and actual medicines DB
      const rows = await db.db.all(`SELECT medicines_text FROM visits WHERE medicines_text IS NOT NULL AND medicines_text != ''`);
      let allWords = new Set();
      rows.forEach(r => {
         const parts = r.medicines_text.split(/[\n,]/);
         parts.forEach(p => { 
           const pStr = p.trim();
           if(pStr.length > 2 && (!q || pStr.toLowerCase().includes(q.toLowerCase()))) allWords.add(pStr); 
         });
      });
      // Also add from medicines inventory
      const meds = await db.db.all(`SELECT name FROM medicines WHERE name IS NOT NULL AND name != ''`);
      meds.forEach(r => {
         const pStr = r.name.trim();
         if(pStr.length > 2 && (!q || pStr.toLowerCase().includes(q.toLowerCase()))) allWords.add(pStr); 
      });
      results = Array.from(allWords).slice(0, 15);
    }
    
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── EXTENDED ANALYTICS API ──────────────────────────────────────────────────

app.get('/api/analytics/growth', async (req, res) => {
  try {
    const { metric = 'visits', range = 'last-28-days', from, to } = req.query;
    const data = await db.getAnalyticsGrowth(metric, range, from, to);
    res.json({ success: true, data, metric, range, granularity: data.length && data[0].label.length === 7 ? 'monthly' : 'daily' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard-stats', async (req, res) => {
  try {
    const stats = await db.getDashboardDetailedStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/dashboard-charts', async (req, res) => {
  try {
    const chartData = await db.getDashboardChartsData();
    res.json({ success: true, charts: chartData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const rows = await db.all("SELECT key, value FROM settings");
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings body' });
    }

    const defaultSettings = {
      daily_patient_goal: '20',
      weekly_patient_goal: '100',
      monthly_patient_goal: '400',
      daily_revenue_goal: '5000',
      weekly_revenue_goal: '25000',
      monthly_revenue_goal: '100000',
      total_revenue_goal: '500000',
      total_patient_target: '500'
    };

    // Perform transaction to save settings and write audit log
    await db.run('BEGIN TRANSACTION');
    try {
      for (const [key, rawVal] of Object.entries(settings)) {
        if (!defaultSettings.hasOwnProperty(key)) continue;

        let val = String(rawVal).trim();
        const num = parseFloat(val);
        if (isNaN(num) || num <= 0) {
          val = defaultSettings[key]; // restore default
        }

        const oldRow = await db.get("SELECT value FROM settings WHERE key = ?", [key]);
        const oldVal = oldRow ? oldRow.value : '';

        await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, val]);

        await db.insertAuditLog(
          'admin', 
          'Settings Changed', 
          'settings', 
          0, 
          JSON.stringify({ key, value: oldVal }), 
          JSON.stringify({ key, value: val })
        );
      }
      await db.run('COMMIT');
    } catch (txErr) {
      await db.run('ROLLBACK');
      throw txErr;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Database and Server Bootstrap ──────────────────────────────────────────

const PORT = process.env.PORT || 8080;

// Database path configuration
let dbPath = path.join(dbDir, 'clinic.db');
if (process.env.VERCEL) {
  dbPath = '/tmp/clinic.db';
  const rootDb = path.join(__dirname, 'clinic.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(rootDb)) {
    try {
      fs.copyFileSync(rootDb, dbPath);
      console.log('[Vercel] Successfully initialized /tmp/clinic.db from project root database.');
    } catch (e) {
      console.error('[Vercel] Error initializing /tmp/clinic.db:', e.message);
    }
  }
}

async function startServer() {
  const errObj = {};
  const opened = await db.open(dbPath, errObj);
  if (!opened) {
    console.error(`[Error] Failed to open SQLite database at ${dbPath}:`, errObj.message);
    // Don't crash process exit in serverless environment
    if (!process.env.VERCEL) process.exit(1);
  }
  console.log(`[Database] Connected to SQLite database at: ${dbPath}`);

  // Only listen directly if run as a standalone process (node server.js)
  if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Clinical Management Server running at http://localhost:${PORT}/`);
    });
  }
  return db;
}

app.dbPromise = startServer();

module.exports = app;
