const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Opens the SQLite database file and applies the schema
   * @param {string} dbPath - Path to the SQLite database file
   */
  async open(dbPath, outErrorObj = {}) {
    try {
      // Ensure the parent directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign key support
      await this.db.run('PRAGMA foreign_keys = ON;');
      
      // Enable WAL (Write-Ahead Logging) mode for performance and concurrency
      await this.db.run('PRAGMA journal_mode=WAL;');

      // Apply initial table schema
      await this.applySchema();
      return true;
    } catch (err) {
      outErrorObj.message = err.message;
      return false;
    }
  }

  /**
   * Reads schema.sql and runs it on the SQLite instance
   */
  async applySchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    let schemaSql;

    if (fs.existsSync(schemaPath)) {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } else {
      // Fallback SQL schema in case file is missing
      schemaSql = `
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS patients (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          registration_no INTEGER,
          name            TEXT NOT NULL,
          surname         TEXT,
          age             INTEGER,
          weight          REAL,
          gender          TEXT,
          phone           TEXT,
          address         TEXT,
          blood_group     TEXT,
          medical_history TEXT,
          patient_image   TEXT,
          created_at      TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS visits (
          id                  INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id          INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          visit_date          TEXT NOT NULL,
          pulse_rate          INTEGER,
          blood_pressure      TEXT,
          temperature         REAL,
          symptoms            TEXT,
          doctor              TEXT,
          prescription        TEXT,
          medicines           TEXT,
          notes               TEXT,
          defected_area_image TEXT,
          defected_area_image_2 TEXT,
          defected_area_image_3 TEXT,
          created_at          TEXT DEFAULT (datetime('now'))
        );
      `;
    }

    // Executes multiple SQL statements separated by semicolons
    await this.db.exec(schemaSql);

    // Dynamic schema migration: add columns to existing tables if they don't exist
    const patientCols = [
      { name: 'registration_no', type: 'INTEGER' },
      { name: 'surname', type: 'TEXT' },
      { name: 'weight', type: 'REAL' },
      { name: 'patient_image', type: 'TEXT' },
      { name: 'reg_id', type: 'TEXT' },
      { name: 'ire_id', type: 'TEXT' },
      { name: 'first_name', type: 'TEXT' },
      { name: 'last_name', type: 'TEXT' },
      { name: 'date_of_birth', type: 'TEXT' },
      { name: 'guardian_name', type: 'TEXT' },
      { name: 'guardian_relationship', type: 'TEXT' },
      { name: 'cnic', type: 'TEXT' },
      { name: 'alternate_phone', type: 'TEXT' },
      { name: 'whatsapp_number', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'emergency_contact_name', type: 'TEXT' },
      { name: 'emergency_contact_number', type: 'TEXT' },
      { name: 'patient_status', type: "TEXT DEFAULT 'Active'" },
      { name: 'diagnosis', type: 'TEXT' },
      { name: 'allergies', type: 'TEXT' },
      { name: 'current_medicines', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'registration_date', type: 'TEXT' },
      { name: 'updated_at', type: 'TEXT' }
    ];
    for (const col of patientCols) {
      try {
        await this.db.run(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type};`);
      } catch (e) {
        // Ignore error if column already exists
      }
    }

    // Ensure medicines table exists
    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS medicines (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          name               TEXT NOT NULL,
          code               TEXT UNIQUE NOT NULL,
          category           TEXT,
          company            TEXT,
          batch_no           TEXT,
          purchase_date      TEXT,
          expiry_date        TEXT,
          purchase_price     REAL,
          selling_price      REAL,
          quantity_purchased INTEGER,
          quantity_remaining INTEGER,
          min_stock_alert    INTEGER,
          stock_status       TEXT DEFAULT 'In Stock',
          supplier_name      TEXT,
          supplier_contact   TEXT,
          notes              TEXT,
          created_at         TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('Failed to create medicines table:', e);
    }

    const medCols = [
      { name: 'purchase_date', type: 'TEXT' },
      { name: 'expiry_date', type: 'TEXT' },
      { name: 'stock_status', type: "TEXT DEFAULT 'In Stock'" }
    ];
    for (const col of medCols) {
      try {
        await this.db.run(`ALTER TABLE medicines ADD COLUMN ${col.name} ${col.type}`);
        
        // Data migration for existing medicines when the column is first added
        if (col.name === 'stock_status') {
          await this.db.run(`
            UPDATE medicines 
            SET stock_status = CASE 
              WHEN quantity_remaining > 0 THEN 'In Stock' 
              ELSE 'Out of Stock' 
            END
            WHERE stock_status IS NULL OR stock_status = 'In Stock'
          `);
        }
      } catch (e) {
        // Ignore error if column already exists
      }
    }

    // Normalize medicines data according to strict options
    try {
      await this.db.run(`
        UPDATE medicines
        SET stock_status = CASE
          WHEN stock_status = 'Out of Stock' THEN 'Out of Stock'
          ELSE 'In Stock'
        END
        WHERE stock_status NOT IN ('In Stock', 'Out of Stock');
      `);
      
      await this.db.run(`
        UPDATE medicines
        SET category = CASE
          WHEN category LIKE '%Potency%' THEN 'Potency'
          WHEN category LIKE '%Mother Tincture%' THEN 'Mother Tincture'
          WHEN category LIKE '%Combination%' THEN 'Combination'
          ELSE 'Potency' -- fallback default
        END
        WHERE category NOT IN ('Potency', 'Mother Tincture', 'Combination') OR category IS NULL;
      `);
    } catch (e) {
      console.error('Failed to normalize medicines data:', e);
    }

    const visitCols = [
      { name: 'pulse_rate', type: 'INTEGER' },
      { name: 'blood_pressure', type: 'TEXT' },
      { name: 'temperature', type: 'REAL' },
      { name: 'oxygen_level', type: 'INTEGER' },
      { name: 'medicines', type: 'TEXT' },
      { name: 'defected_area_image', type: 'TEXT' },
      { name: 'defected_area_image_2', type: 'TEXT' },
      { name: 'defected_area_image_3', type: 'TEXT' },
      { name: 'consultation_fee', type: 'REAL' },
      { name: 'medicine_price', type: 'REAL' },
      { name: 'total_amount', type: 'REAL' },
      { name: 'discount', type: 'REAL' },
      { name: 'final_amount', type: 'REAL' },
      { name: 'payment_method', type: 'TEXT' },
      { name: 'payment_status', type: 'TEXT' },
      { name: 'amount_received', type: 'REAL' },
      { name: 'remaining_balance', type: 'REAL' },
      { name: 'weight', type: 'REAL' },
      { name: 'diagnosis', type: 'TEXT' }
    ];
    for (const col of visitCols) {
      try {
        await this.db.run(`ALTER TABLE visits ADD COLUMN ${col.name} ${col.type};`);
      } catch (e) {
        // Ignore error if column already exists
      }
    }

    // Create indexes for fast searching and unique constraints
    try {
      await this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_reg_id ON patients(reg_id);`);
      await this.db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_ire_id ON patients(ire_id);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_patients_cnic ON patients(cnic);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_patients_names ON patients(first_name, last_name);`);
    } catch (e) {
      console.error('Failed to create indexes:', e);
    }

    // Migrate old patient name data to first_name/last_name
    try {
      await this.db.run(`
        UPDATE patients
        SET first_name = name, last_name = surname
        WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL AND name != '';
      `);
      await this.db.run(`
        UPDATE patients
        SET last_name = ''
        WHERE last_name IS NULL;
      `);
    } catch (e) {
      console.error('Failed to migrate name columns:', e);
    }

    // Populate auto-generated registration and IRE IDs for existing records
    try {
      await this.db.run(`
        UPDATE patients
        SET reg_id = 'REG-' || printf('%06d', id)
        WHERE reg_id IS NULL OR reg_id = '';
      `);
      await this.db.run(`
        UPDATE patients
        SET ire_id = 'IRE-' || printf('%06d', id)
        WHERE ire_id IS NULL OR ire_id = '';
      `);
      await this.db.run(`
        UPDATE patients
        SET registration_date = created_at
        WHERE registration_date IS NULL OR registration_date = '';
      `);
    } catch (e) {
      console.error('Failed to populate reg_id / ire_id for legacy records:', e);
    }

    // Setup configurable settings, appointments, and audit trail tables
    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      // Seed default dashboard settings if not present
      const defaultSettings = {
        daily_patient_goal: '20',
        weekly_patient_goal: '100',
        monthly_patient_goal: '400',
        daily_revenue_goal: '5000',
        weekly_revenue_goal: '25000',
        monthly_revenue_goal: '100000',
        total_revenue_goal: '500000'
      };
      for (const [key, val] of Object.entries(defaultSettings)) {
        await this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);`, [key, val]);
      }
    } catch (e) {
      console.error('Failed to initialize settings table:', e);
    }

    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          appointment_date TEXT NOT NULL,
          status TEXT DEFAULT 'Scheduled',
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
    } catch (e) {
      console.error('Failed to initialize appointments table:', e);
    }

    try {
      await this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          action TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          old_values TEXT,
          new_values TEXT,
          timestamp TEXT DEFAULT (datetime('now', 'localtime'))
        );
      `);
    } catch (e) {
      console.error('Failed to initialize audit_logs table:', e);
    }

    // Index optimizations
    try {
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_visits_payment ON visits(payment_status);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);`);
      await this.db.run(`CREATE INDEX IF NOT EXISTS idx_medicines_stock ON medicines(quantity_remaining, min_stock_alert);`);
    } catch (e) {
      console.error('Failed to build performance optimization indexes:', e);
    }
  }

  /**
   * Closes the database connection
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async run(sql, params = []) {
    return this.db.run(sql, params);
  }

  async get(sql, params = []) {
    return this.db.get(sql, params);
  }

  async all(sql, params = []) {
    return this.db.all(sql, params);
  }

  // ─── Patient CRUD ─────────────────────────────────────────────────────────────

  async insertPatient(patient) {
    const {
      reg_id,
      ire_id,
      registration_no,
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
      registration_date
    } = patient;

    // Use a transaction to ensure atomic insert and ID generation
    await this.db.run('BEGIN TRANSACTION;');
    try {
      const sql = `
        INSERT INTO patients (
          reg_id, ire_id, registration_no, first_name, last_name, name, surname,
          age, date_of_birth, weight, gender, guardian_name, guardian_relationship,
          whatsapp_number, address, city, emergency_contact_name, emergency_contact_number,
          blood_group, patient_status, diagnosis, allergies, medical_history, current_medicines,
          notes, patient_image, registration_date, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `;

      const compatName = first_name;
      const compatSurname = last_name || '';

      const result = await this.db.run(sql, [
        reg_id || null,
        ire_id || null,
        registration_no || null,
        first_name,
        last_name || '',
        compatName,
        compatSurname,
        age || null,
        date_of_birth || '',
        weight || null,
        gender || '',
        guardian_name || '',
        guardian_relationship || 'Father',
        whatsapp_number || '',
        address || '',
        city || '',
        emergency_contact_name || '',
        emergency_contact_number || '',
        blood_group || '',
        patient_status || 'Active',
        diagnosis || '',
        allergies || '',
        medical_history || '',
        current_medicines || '',
        notes || '',
        patient_image || null,
        registration_date || new Date().toISOString().split('T')[0],
        new Date().toISOString()
      ]);

      const lastId = result.lastID;
      let finalRegId = reg_id;
      let finalIreId = ire_id;

      if (!finalRegId) {
        finalRegId = 'REG-' + String(lastId).padStart(6, '0');
      }
      if (!finalIreId) {
        finalIreId = 'IRE-' + String(lastId).padStart(6, '0');
      }

      // If we auto-generated either ID, update the row
      if (!reg_id || !ire_id) {
        await this.db.run(
          `UPDATE patients SET reg_id = ?, ire_id = ? WHERE id = ?`,
          [finalRegId, finalIreId, lastId]
        );
      }

      
      return {
        success: true,
        last_insert_id: lastId,
        reg_id: finalRegId,
        ire_id: finalIreId
      };
    } catch (err) {
      
      throw err;
    }
  }

  async updatePatient(patientId, patient) {
    const {
      ire_id,
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
      registration_date
    } = patient;

    // Use a transaction
    await this.db.run('BEGIN TRANSACTION;');
    try {
      const sql = `
        UPDATE patients SET
          ire_id = ?,
          first_name = ?,
          last_name = ?,
          name = ?,
          surname = ?,
          age = ?,
          date_of_birth = ?,
          weight = ?,
          gender = ?,
          guardian_name = ?,
          guardian_relationship = ?,
          whatsapp_number = ?,
          address = ?,
          city = ?,
          emergency_contact_name = ?,
          emergency_contact_number = ?,
          blood_group = ?,
          patient_status = ?,
          diagnosis = ?,
          allergies = ?,
          medical_history = ?,
          current_medicines = ?,
          notes = ?,
          patient_image = CASE WHEN ? IS NOT NULL THEN ? ELSE patient_image END,
          registration_date = ?,
          updated_at = ?
        WHERE id = ?
      `;

      const compatName = first_name;
      const compatSurname = last_name || '';

      await this.db.run(sql, [
        ire_id || null,
        first_name,
        last_name || '',
        compatName,
        compatSurname,
        age || null,
        date_of_birth || '',
        weight || null,
        gender || '',
        guardian_name || '',
        guardian_relationship || 'Father',
        whatsapp_number || '',
        address || '',
        city || '',
        emergency_contact_name || '',
        emergency_contact_number || '',
        blood_group || '',
        patient_status || 'Active',
        diagnosis || '',
        allergies || '',
        medical_history || '',
        current_medicines || '',
        notes || '',
        patient_image || null,
        patient_image || null,
        registration_date || null,
        new Date().toISOString(),
        patientId
      ]);

      
      return { success: true };
    } catch (err) {
      
      throw err;
    }
  }

  async checkDuplicate(whatsapp_number, excludeId = null) {
    const conditions = [];
    const params = [];
    
    if (whatsapp_number && whatsapp_number.trim() !== '') {
      conditions.push(`whatsapp_number = ?`);
      params.push(whatsapp_number.trim());
    }
    
    if (conditions.length === 0) return null;
    
    let sql = `SELECT id, first_name, last_name, name, reg_id, whatsapp_number FROM patients WHERE (${conditions.join(' OR ')})`;
    if (excludeId) {
      sql += ` AND id != ?`;
      params.push(excludeId);
    }
    sql += ` LIMIT 1`;
    
    const row = await this.db.get(sql, params);
    return row || null;
  }

  async deletePatient(patientId) {
    // Explicitly enforce foreign key constraints
    await this.db.run('PRAGMA foreign_keys = ON;');
    const sql = `DELETE FROM patients WHERE id = ?`;
    await this.db.run(sql, [patientId]);
    return { success: true };
  }

  async getPatient(patientId) {
    const sql = `
      SELECT id, reg_id, ire_id, registration_no, first_name, last_name, name, surname,
             age, date_of_birth, weight, gender, guardian_name, 
             whatsapp_number, address, city, emergency_contact_name, emergency_contact_number,
             blood_group, patient_status, diagnosis, allergies, medical_history, current_medicines,
             notes, patient_image, registration_date, updated_at, created_at
      FROM patients WHERE id = ? LIMIT 1
    `;
    const row = await this.db.get(sql, [patientId]);
    if (row) {
      row.name = row.first_name || row.name || '';
      row.surname = row.last_name || row.surname || '';
    }
    return row || null;
  }

  async searchPatients(query) {
    const trimmed = query.trim();
    if (trimmed.startsWith('id:')) {
      const targetId = trimmed.substring(3).trim();
      const sql = `
        SELECT p.id, p.reg_id, p.ire_id, p.registration_no, p.first_name, p.last_name, p.name, p.surname,
               p.age, p.date_of_birth, p.weight, p.whatsapp_number, p.address, p.city, p.registration_date,
               p.blood_group, p.gender, p.patient_image, p.created_at, p.patient_status,
               (SELECT v2.visit_date FROM visits v2 WHERE v2.patient_id = p.id
                ORDER BY v2.visit_date DESC LIMIT 1) AS last_visit
        FROM patients p
        WHERE p.id = ? OR CAST(p.id AS TEXT) = ? OR p.reg_id = ? OR p.ire_id = ?
        LIMIT 50
      `;
      const rows = await this.db.all(sql, [targetId, targetId, `REG-${String(targetId).padStart(6, '0')}`, `IRE-${String(targetId).padStart(6, '0')}`]);
      return rows.map(row => ({
        ...row,
        name: row.first_name || row.name || '',
        surname: row.last_name || row.surname || '',
        last_visit_date: row.last_visit
      }));
    }

    const wildcardQuery = `%${trimmed}%`;
    const sql = `
      SELECT DISTINCT p.id, p.reg_id, p.ire_id, p.registration_no, p.first_name, p.last_name, p.name, p.surname,
             p.age, p.date_of_birth, p.weight, p.whatsapp_number, p.address, p.city, p.registration_date,
             p.blood_group, p.gender, p.patient_image, p.created_at, p.patient_status,
             (SELECT v2.visit_date FROM visits v2 WHERE v2.patient_id = p.id
              ORDER BY v2.visit_date DESC LIMIT 1) AS last_visit
      FROM patients p
      LEFT JOIN visits v ON p.id = v.patient_id
      WHERE p.reg_id LIKE ? 
         OR p.ire_id LIKE ?
         OR p.first_name LIKE ?
         OR p.last_name LIKE ?
         OR (p.first_name || ' ' || p.last_name) LIKE ?
         OR p.name LIKE ?
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
      ORDER BY p.first_name ASC, p.id DESC LIMIT 50
    `;
    const rows = await this.db.all(sql, [
      wildcardQuery, // reg_id
      wildcardQuery, // ire_id
      wildcardQuery, // first_name
      wildcardQuery, // last_name
      wildcardQuery, // full name
      wildcardQuery, // legacy name
      wildcardQuery, // whatsapp_number
      wildcardQuery, // address
      wildcardQuery, // city
      wildcardQuery, // gender
      trimmed,       // age
      wildcardQuery, // symptoms (disease)
      wildcardQuery, // doctor
      wildcardQuery, // medicines
      wildcardQuery, // prescription
      wildcardQuery, // payment_status
      wildcardQuery, // final_amount
      wildcardQuery, // visit_date
      wildcardQuery, // blood_group
      wildcardQuery, // registration_date
      trimmed,       // id
      trimmed        // registration_no
    ]);
    
    return rows.map(row => ({
      ...row,
      name: row.first_name || row.name || '',
      surname: row.last_name || row.surname || '',
      last_visit_date: row.last_visit
    }));
  }

  async getRecentPatients(limit = 10) {
    const sql = `
      SELECT p.id, p.reg_id, p.ire_id, p.registration_no, p.first_name, p.last_name, p.name, p.surname,
             p.age, p.weight, p.whatsapp_number, p.blood_group, p.gender, p.patient_image, p.created_at, p.patient_status, p.address, p.city, p.registration_date,
             (SELECT v.visit_date FROM visits v WHERE v.patient_id = p.id
              ORDER BY v.visit_date DESC LIMIT 1) AS last_visit
      FROM patients p ORDER BY p.created_at DESC LIMIT ?
    `;
    const rows = await this.db.all(sql, [limit]);
    
    return rows.map(row => ({
      ...row,
      name: row.first_name || row.name || '',
      surname: row.last_name || row.surname || '',
      last_visit_date: row.last_visit
    }));
  }

  async getAllPatients() {
    const sql = `
      SELECT p.id, p.reg_id, p.ire_id, p.registration_no, p.first_name, p.last_name, p.name, p.surname,
             p.age, p.weight, p.blood_group, p.gender, p.patient_image, p.created_at, p.patient_status,
             p.address, p.city, p.registration_date, p.whatsapp_number,
             (SELECT v.visit_date FROM visits v WHERE v.patient_id = p.id
              ORDER BY v.visit_date DESC LIMIT 1) AS last_visit
      FROM patients p ORDER BY p.created_at DESC
    `;
    const rows = await this.db.all(sql);
    return rows.map(row => ({
      ...row,
      name: row.first_name || row.name || '',
      surname: row.last_name || row.surname || '',
      last_visit_date: row.last_visit
    }));
  }

  // ─── Visit CRUD ───────────────────────────────────────────────────────────────

  async insertVisit(visit) {
    const { patient_id, visit_date, pulse_rate, blood_pressure, temperature, oxygen_level, symptoms, doctor, prescription, medicines, notes, defected_area_image, defected_area_image_2, defected_area_image_3, consultation_fee, medicine_price, total_amount, discount, final_amount, payment_method, payment_status, amount_received, remaining_balance, weight, diagnosis } = visit;
    const sql = `
      INSERT INTO visits (patient_id, visit_date, pulse_rate, blood_pressure, temperature, oxygen_level, symptoms, doctor, prescription, medicines, notes, defected_area_image, defected_area_image_2, defected_area_image_3, consultation_fee, medicine_price, total_amount, discount, final_amount, payment_method, payment_status, amount_received, remaining_balance, weight, diagnosis)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [
      patient_id,
      visit_date,
      pulse_rate || null,
      blood_pressure || '',
      temperature || null,
      oxygen_level || null,
      symptoms || '',
      doctor || '',
      prescription || '',
      medicines || '',
      notes || '',
      defected_area_image || null,
      defected_area_image_2 || null,
      defected_area_image_3 || null,
      parseFloat(consultation_fee) || 0.0,
      parseFloat(medicine_price) || 0.0,
      parseFloat(total_amount) || 0.0,
      parseFloat(discount) || 0.0,
      parseFloat(final_amount) || 0.0,
      payment_method || '',
      payment_status || 'Unpaid',
      parseFloat(amount_received) || 0.0,
      parseFloat(remaining_balance) || 0.0,
      parseFloat(weight) || null,
      diagnosis || ''
    ]);
    return {
      success: true,
      last_insert_id: result.lastID
    };
  }

  async updateVisit(id, visit) {
    const fields = [];
    const params = [];
    const allowed = [
      'visit_date', 'pulse_rate', 'blood_pressure', 'temperature', 'oxygen_level',
      'symptoms', 'diagnosis', 'doctor', 'prescription', 'medicines', 'notes',
      'defected_area_image', 'defected_area_image_2', 'defected_area_image_3',
      'consultation_fee', 'medicine_price', 'total_amount', 'discount',
      'final_amount', 'payment_method', 'payment_status', 'amount_received',
      'remaining_balance', 'weight'
    ];

    for (const key of allowed) {
      if (visit[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(visit[key]);
      }
    }

    if (fields.length === 0) return { success: true };

    params.push(id);
    const sql = `UPDATE visits SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.run(sql, params);
    return { success: true };
  }

  async getVisitsForPatient(patientId) {
    const sql = `
      SELECT id, patient_id, visit_date, pulse_rate, blood_pressure, temperature, oxygen_level, symptoms, diagnosis, doctor, prescription, medicines, notes, defected_area_image, defected_area_image_2, defected_area_image_3, consultation_fee, medicine_price, total_amount, discount, final_amount, payment_method, payment_status, amount_received, remaining_balance, created_at
      FROM visits WHERE patient_id = ?
      ORDER BY visit_date DESC, created_at DESC
    `;
    const rows = await this.db.all(sql, [patientId]);
    
    // Add compatibility mapping
    return rows.map(row => ({
      ...row,
      date: row.visit_date // Map for CareFlow frontend (frontend/app.js)
    }));
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────────

  async getTotalPatients() {
    const row = await this.db.get('SELECT COUNT(*) AS count FROM patients;');
    return row ? row.count : 0;
  }

  async getVisitsToday() {
    const row = await this.db.get("SELECT COUNT(*) AS count FROM visits WHERE date(visit_date) = date('now');");
    return row ? row.count : 0;
  }

  async getVisitsThisMonth() {
    const row = await this.db.get("SELECT COUNT(*) AS count FROM visits WHERE strftime('%Y-%m', visit_date) = strftime('%Y-%m', 'now');");
    return row ? row.count : 0;
  }

  async getMostActiveDoctor() {
    const row = await this.db.get(`
      SELECT doctor, COUNT(*) as cnt FROM visits
      WHERE doctor IS NOT NULL AND doctor != ''
      GROUP BY doctor ORDER BY cnt DESC LIMIT 1;
    `);
    return row && row.doctor ? row.doctor : 'N/A';
  }

  // ─── Medicines Inventory CRUD ───────────────────────────────────────────────

  async insertMedicine(med) {
    if (!med.code || med.code === 'AUTO-CODE') {
      const row = await this.db.get('SELECT MAX(id) as maxId FROM medicines');
      const nextId = (row && row.maxId ? row.maxId + 1 : 1);
      med.code = 'MED-' + String(nextId).padStart(4, '0');
    }

    const sql = `
      INSERT INTO medicines (
        name, code, category, company, batch_no, purchase_date, expiry_date,
        purchase_price, selling_price, quantity_purchased, quantity_remaining,
        min_stock_alert, stock_status, supplier_name, supplier_contact, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [
      med.name,
      med.code,
      med.category || '',
      med.company || '',
      med.batch_no || '',
      med.purchase_date || '',
      med.expiry_date || '',
      parseFloat(med.purchase_price) || 0.0,
      parseFloat(med.selling_price) || 0.0,
      parseInt(med.quantity_purchased, 10) || 0,
      parseInt(med.quantity_remaining, 10) || parseInt(med.quantity_purchased, 10) || 0,
      parseInt(med.min_stock_alert, 10) || 0,
      med.stock_status || 'In Stock',
      med.supplier_name || '',
      med.supplier_contact || '',
      med.notes || '',
      med.created_at || new Date().toISOString()
    ]);
    return { success: true, lastID: result.lastID };
  }

  async updateMedicine(id, med) {
    const sql = `
      UPDATE medicines SET
        name = ?, code = ?, category = ?, company = ?, batch_no = ?,
        purchase_date = ?, expiry_date = ?, purchase_price = ?, selling_price = ?,
        quantity_purchased = ?, quantity_remaining = ?, min_stock_alert = ?,
        stock_status = ?, supplier_name = ?, supplier_contact = ?, notes = ?, created_at = ?
      WHERE id = ?
    `;
    await this.db.run(sql, [
      med.name,
      med.code,
      med.category || '',
      med.company || '',
      med.batch_no || '',
      med.purchase_date || '',
      med.expiry_date || '',
      parseFloat(med.purchase_price) || 0.0,
      parseFloat(med.selling_price) || 0.0,
      parseInt(med.quantity_purchased, 10) || 0,
      parseInt(med.quantity_remaining, 10) || 0,
      parseInt(med.min_stock_alert, 10) || 0,
      med.stock_status || 'In Stock',
      med.supplier_name || '',
      med.supplier_contact || '',
      med.notes || '',
      med.created_at || new Date().toISOString(),
      id
    ]);
    return { success: true };
  }

  async deleteMedicine(id) {
    const sql = `DELETE FROM medicines WHERE id = ?`;
    await this.db.run(sql, [id]);
    return { success: true };
  }

  

  async deleteVisit(id) {
    const sql = `DELETE FROM visits WHERE id = ?`;
    await this.db.run(sql, [id]);
    return { success: true };
  }

  async searchMedicines(query) {
    if (!query) {
      return await this.db.all('SELECT * FROM medicines ORDER BY name ASC');
    }
    const term = `%${query}%`;
    const sql = `
      SELECT * FROM medicines
      WHERE name LIKE ? OR code LIKE ? OR company LIKE ? OR category LIKE ? OR batch_no LIKE ? OR supplier_name LIKE ? OR expiry_date LIKE ?
      ORDER BY name ASC
    `;
    return await this.db.all(sql, [term, term, term, term, term, term, term]);
  }

  async decrementMedicineStock(name, qty) {
    // Attempt exact match first
    const med = await this.db.get('SELECT id, quantity_remaining FROM medicines WHERE name = ?', [name]);
    if (med) {
      const newQty = Math.max(0, med.quantity_remaining - qty);
      await this.db.run('UPDATE medicines SET quantity_remaining = ? WHERE id = ?', [newQty, med.id]);
    } else {
      // Partial case-insensitive fallback search
      const partialMed = await this.db.get('SELECT id, quantity_remaining FROM medicines WHERE name LIKE ? LIMIT 1', [`%${name}%`]);
      if (partialMed) {
        const newQty = Math.max(0, partialMed.quantity_remaining - qty);
        await this.db.run('UPDATE medicines SET quantity_remaining = ? WHERE id = ?', [newQty, partialMed.id]);
      }
    }
  }

  // ─── Extended Dashboard Analytics ──────────────────────────────────────────

  async getDashboardDetailedStats() {
    // Load config settings
    const settingsRows = await this.db.all("SELECT key, value FROM settings");
    const settings = {};
    settingsRows.forEach(row => {
      settings[row.key] = row.value;
    });

    const totalPatients = await this.getTotalPatients();
    
    const todayRow = await this.db.get("SELECT COUNT(*) AS count FROM visits WHERE visit_date >= date('now', 'localtime')");
    const visitsToday = todayRow ? todayRow.count : 0;
    
    const weekRow = await this.db.get("SELECT COUNT(*) AS count FROM visits WHERE visit_date >= date('now', '-6 days', 'localtime')");
    const visitsThisWeek = weekRow ? weekRow.count : 0;
    
    const monthRow = await this.db.get("SELECT COUNT(*) AS count FROM visits WHERE visit_date >= date('now', 'start of month', 'localtime')");
    const visitsThisMonth = monthRow ? monthRow.count : 0;

    const earningsTodayRow = await this.db.get(`
      WITH ranked_visits AS (
        SELECT final_amount, visit_date, payment_status,
               ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
      )
      SELECT SUM(final_amount) AS sum FROM ranked_visits
      WHERE visit_num > 1 AND visit_date >= date('now', 'localtime') AND payment_status = 'Paid'
    `);
    const earningsToday = earningsTodayRow ? (earningsTodayRow.sum || 0) : 0;

    const earningsWeekRow = await this.db.get(`
      WITH ranked_visits AS (
        SELECT final_amount, visit_date, payment_status,
               ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
      )
      SELECT SUM(final_amount) AS sum FROM ranked_visits
      WHERE visit_num > 1 AND visit_date >= date('now', '-6 days', 'localtime') AND payment_status = 'Paid'
    `);
    const earningsThisWeek = earningsWeekRow ? (earningsWeekRow.sum || 0) : 0;

    const earningsMonthRow = await this.db.get(`
      WITH ranked_visits AS (
        SELECT final_amount, visit_date, payment_status,
               ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
      )
      SELECT SUM(final_amount) AS sum FROM ranked_visits
      WHERE visit_num > 1 AND visit_date >= date('now', 'start of month', 'localtime') AND payment_status = 'Paid'
    `);
    const earningsThisMonth = earningsMonthRow ? (earningsMonthRow.sum || 0) : 0;

    const earningsTotalRow = await this.db.get(`
      WITH ranked_visits AS (
        SELECT final_amount, payment_status,
               ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
      )
      SELECT SUM(final_amount) AS sum FROM ranked_visits
      WHERE visit_num > 1 AND payment_status = 'Paid'
    `);
    const totalEarnings = earningsTotalRow ? (earningsTotalRow.sum || 0) : 0;

    const medicinesRow = await this.db.get("SELECT COUNT(*) AS count FROM medicines");
    const totalMedicines = medicinesRow ? medicinesRow.count : 0;

    const inStockRow = await this.db.get("SELECT COUNT(*) AS count FROM medicines WHERE stock_status = 'In Stock'");
    const stockInStock = inStockRow ? inStockRow.count : 0;

    const lowStockRow = await this.db.get("SELECT COUNT(*) AS count FROM medicines WHERE stock_status = 'Low Stock'");
    const stockLowStock = lowStockRow ? lowStockRow.count : 0;

    const outStockRow = await this.db.get("SELECT COUNT(*) AS count FROM medicines WHERE stock_status = 'Out of Stock'");
    const stockOutOfStock = outStockRow ? outStockRow.count : 0;

    const apptCompletedRow = await this.db.get("SELECT COUNT(*) AS count FROM appointments WHERE status = 'Completed'");
    const appointmentsCompleted = apptCompletedRow ? apptCompletedRow.count : 0;

    const revenueByVisitRows = await this.db.all(`
      WITH ranked_visits AS (
        SELECT 
          final_amount,
          ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
        WHERE payment_status = 'Paid'
      )
      SELECT 
        visit_num, 
        SUM(final_amount) as revenue
      FROM ranked_visits
      WHERE visit_num > 1
      GROUP BY visit_num
      ORDER BY visit_num;
    `);

    const fvTodayRow = await this.db.get(`
      WITH first_visits AS (
        SELECT patient_id, MIN(id) as first_visit_id
        FROM visits
        GROUP BY patient_id
      )
      SELECT COALESCE(SUM(COALESCE(v.final_amount, (COALESCE(v.consultation_fee,0) + COALESCE(v.medicine_price,0) - COALESCE(v.discount,0)), 0)), 0) AS sum
      FROM visits v
      JOIN first_visits fv ON v.id = fv.first_visit_id
      WHERE (v.payment_status = 'Paid' OR v.payment_status IS NULL OR v.payment_status = '' OR LOWER(v.payment_status) = 'paid')
        AND date(v.visit_date) = date('now', 'localtime');
    `);
    const firstVisitRevenueToday = fvTodayRow ? (fvTodayRow.sum || 0) : 0;

    const fvWeekRow = await this.db.get(`
      WITH first_visits AS (
        SELECT patient_id, MIN(id) as first_visit_id
        FROM visits
        GROUP BY patient_id
      )
      SELECT COALESCE(SUM(COALESCE(v.final_amount, (COALESCE(v.consultation_fee,0) + COALESCE(v.medicine_price,0) - COALESCE(v.discount,0)), 0)), 0) AS sum
      FROM visits v
      JOIN first_visits fv ON v.id = fv.first_visit_id
      WHERE (v.payment_status = 'Paid' OR v.payment_status IS NULL OR v.payment_status = '' OR LOWER(v.payment_status) = 'paid')
        AND (
          strftime('%Y-%W', v.visit_date) = strftime('%Y-%W', 'now', 'localtime')
          OR date(v.visit_date) >= date('now', 'localtime', 'weekday 1', '-7 days')
          OR date(v.visit_date) >= date('now', 'localtime', '-6 days')
        );
    `);
    const firstVisitRevenueWeek = fvWeekRow ? (fvWeekRow.sum || 0) : 0;

    const fvMonthRow = await this.db.get(`
      WITH first_visits AS (
        SELECT patient_id, MIN(id) as first_visit_id
        FROM visits
        GROUP BY patient_id
      )
      SELECT COALESCE(SUM(COALESCE(v.final_amount, (COALESCE(v.consultation_fee,0) + COALESCE(v.medicine_price,0) - COALESCE(v.discount,0)), 0)), 0) AS sum
      FROM visits v
      JOIN first_visits fv ON v.id = fv.first_visit_id
      WHERE (v.payment_status = 'Paid' OR v.payment_status IS NULL OR v.payment_status = '' OR LOWER(v.payment_status) = 'paid')
        AND strftime('%Y-%m', v.visit_date) = strftime('%Y-%m', 'now', 'localtime');
    `);
    const firstVisitRevenueMonth = fvMonthRow ? (fvMonthRow.sum || 0) : 0;

    // All-time First Visit Revenue (1st Registrations Only)
    const totalFvRow = await this.db.get(`
      WITH first_visits AS (
        SELECT patient_id, MIN(id) as first_visit_id
        FROM visits
        GROUP BY patient_id
      )
      SELECT COALESCE(SUM(COALESCE(v.final_amount, (COALESCE(v.consultation_fee,0) + COALESCE(v.medicine_price,0) - COALESCE(v.discount,0)), 0)), 0) AS sum
      FROM visits v
      JOIN first_visits fv ON v.id = fv.first_visit_id
      WHERE (v.payment_status = 'Paid' OR v.payment_status IS NULL OR v.payment_status = '' OR LOWER(v.payment_status) = 'paid');
    `);
    const totalFirstVisitRevenue = totalFvRow ? (totalFvRow.sum || 0) : 0;

    // All-time Follow-up Revenue (All Visits Except 1st Registration)
    const totalFuRow = await this.db.get(`
      WITH ranked_visits AS (
        SELECT final_amount, payment_status,
               ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
        FROM visits
      )
      SELECT SUM(final_amount) AS sum FROM ranked_visits
      WHERE visit_num > 1 AND (payment_status = 'Paid' OR payment_status IS NULL OR payment_status = '')
    `);
    const totalFollowupRevenue = totalFuRow ? (totalFuRow.sum || 0) : 0;

    // Yearly Revenue Breakdown (First Visit + Follow-up Revenue per Year)
    const yearlyRevenueList = await this.db.all(`
      SELECT strftime('%Y', visit_date) AS yearLabel, COALESCE(SUM(final_amount), 0) AS amount
      FROM visits
      WHERE visit_date IS NOT NULL AND visit_date != '' AND (payment_status = 'Paid' OR payment_status IS NULL OR payment_status = '')
      GROUP BY yearLabel ORDER BY yearLabel ASC
    `);

    let revenueByVisit = { visit1: firstVisitRevenueToday, visit2: 0, visit3: 0, visit4plus: 0 };
    if (revenueByVisitRows && revenueByVisitRows.length > 0) {
      revenueByVisitRows.forEach(row => {
        if (row.visit_num === 2) revenueByVisit.visit2 = row.revenue || 0;
        else if (row.visit_num === 3) revenueByVisit.visit3 = row.revenue || 0;
        else if (row.visit_num >= 4) revenueByVisit.visit4plus += (row.revenue || 0);
      });
    }

    return {
      settings,
      totalPatients,
      visitsToday,
      visitsThisWeek,
      visitsThisMonth,
      earningsToday,
      earningsThisWeek,
      earningsThisMonth,
      totalEarnings,
      firstVisitRevenueToday,
      firstVisitRevenueWeek,
      firstVisitRevenueMonth,
      totalFirstVisitRevenue,
      totalFollowupRevenue,
      yearlyRevenueList,
      revenueByVisit,
      totalMedicines,
      stockInStock,
      stockLowStock,
      stockOutOfStock,
      appointmentsCompleted
    };
  }

  async getAnalyticsGrowth(metric, rangeStr, fromDate, toDate) {
    let dateFilter = "";
    let granularity = 'daily'; // 'daily' or 'monthly'
    let params = [];

    // 1. Determine Date Range & Granularity
    if (rangeStr === 'last-7-days') {
      dateFilter = ">= date('now', 'localtime', '-7 days')";
    } else if (rangeStr === 'last-28-days') {
      dateFilter = ">= date('now', 'localtime', '-28 days')";
    } else if (rangeStr === 'last-90-days') {
      dateFilter = ">= date('now', 'localtime', '-90 days')";
    } else if (rangeStr === 'this-year') {
      dateFilter = ">= date('now', 'localtime', 'start of year')";
      granularity = 'monthly';
    } else if (rangeStr === 'last-year') {
      dateFilter = ">= date('now', 'localtime', 'start of year', '-1 year') AND date_col < date('now', 'localtime', 'start of year')";
      granularity = 'monthly';
    } else if (rangeStr === 'custom' && fromDate && toDate) {
      dateFilter = ">= ? AND date_col <= ?";
      params.push(fromDate, toDate);
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      if (diffDays > 90) granularity = 'monthly';
    } else {
      dateFilter = ">= date('now', 'localtime', '-28 days')"; // default
    }

    let sql = "";
    if (metric === 'patients') {
      let finalFilter = dateFilter.replace(/date_col/g, "date(registration_date)");
      let dateFormat = granularity === 'daily' ? "date(registration_date)" : "strftime('%Y-%m', registration_date)";
      sql = `
        SELECT ${dateFormat} AS label, COUNT(*) AS value 
        FROM patients 
        WHERE date(registration_date) ${finalFilter}
        GROUP BY label ORDER BY label ASC
      `;
    } else if (metric === 'visits') {
      let finalFilter = dateFilter.replace(/date_col/g, "date(visit_date)");
      let dateFormat = granularity === 'daily' ? "date(visit_date)" : "strftime('%Y-%m', visit_date)";
      sql = `
        SELECT ${dateFormat} AS label, COUNT(*) AS value 
        FROM visits 
        WHERE date(visit_date) ${finalFilter}
        GROUP BY label ORDER BY label ASC
      `;
    } else if (metric === 'revenue') {
      let finalFilter = dateFilter.replace(/date_col/g, "date(visit_date)");
      let dateFormat = granularity === 'daily' ? "date(visit_date)" : "strftime('%Y-%m', visit_date)";
      sql = `
        SELECT ${dateFormat} AS label, COALESCE(SUM(final_amount), 0) AS value 
        FROM visits 
        WHERE date(visit_date) ${finalFilter}
        GROUP BY label ORDER BY label ASC
      `;
    } else {
      return []; // unknown metric
    }

    return await this.db.all(sql, params);
  }

  async getDashboardChartsData() {
    const [
      dailyPatients,
      monthlyEarnings,
      medicineCategories,
      patientGrowth,
      recentPatients,
      latestPayments,
      patientAreaDistribution,
      weeklyEarningsCurrentMonth,
      monthlyPatientGrowth,
      yearlyPatientGrowth,
      yearlyRevenue,
      monthlyVisitsGrowth,
      yearlyVisitsGrowth,
      monthlyTotalRevenue,
      bloodGroupDistribution
    ] = await Promise.all([
      // 1. Daily Patients (Last 7 Days)
      this.db.all(`
        SELECT date(visit_date) AS dateLabel, COUNT(*) AS count FROM visits
        WHERE date(visit_date) >= date('now', '-7 days')
        GROUP BY dateLabel ORDER BY dateLabel ASC
      `),
      // 2. Monthly Earnings (Current Year - Follow-up Revenue Only)
      this.db.all(`
        WITH ranked_visits AS (
          SELECT final_amount, visit_date,
                 ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
          FROM visits
        )
        SELECT strftime('%Y-%m', visit_date) AS monthLabel, SUM(final_amount) AS amount FROM ranked_visits
        WHERE visit_num > 1 AND strftime('%Y', visit_date) = strftime('%Y', 'now')
        GROUP BY monthLabel ORDER BY monthLabel ASC
      `),
      // 3. Medicine Categories
      this.db.all(`
        SELECT category, COUNT(*) AS count FROM medicines
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category ORDER BY count DESC LIMIT 6
      `),
      // 4. Patient Growth (Over Time Cumulative)
      this.db.all(`
        SELECT date(registration_date) AS regDate, COUNT(*) AS count FROM patients
        GROUP BY regDate ORDER BY regDate ASC LIMIT 30
      `),
      // 5. Recent Patients
      this.db.all(`
        SELECT id, first_name || ' ' || last_name AS name, reg_id, phone, created_at
        FROM patients ORDER BY id DESC LIMIT 5
      `),
      // 6. Latest Payments
      this.db.all(`
        SELECT v.id, v.visit_date, v.final_amount, v.payment_status, p.first_name || ' ' || p.last_name AS name
        FROM visits v JOIN patients p ON v.patient_id = p.id
        ORDER BY v.id DESC LIMIT 5
      `),
      // 7. Patient Distribution by Area
      this.db.all(`
        SELECT COALESCE(NULLIF(TRIM(city), ''), NULLIF(TRIM(address), ''), 'Unknown') AS area, COUNT(*) AS count
        FROM patients
        GROUP BY area
        ORDER BY count DESC LIMIT 10
      `),
      // 8. Weekly Earnings (Current Month - Follow-up Revenue Only)
      this.db.all(`
        WITH ranked_visits AS (
          SELECT final_amount, visit_date,
                 ROW_NUMBER() OVER(PARTITION BY patient_id ORDER BY visit_date ASC, id ASC) as visit_num
          FROM visits
        )
        SELECT ((strftime('%d', visit_date) - 1) / 7) + 1 AS weekLabel, SUM(final_amount) AS amount 
        FROM ranked_visits 
        WHERE visit_num > 1 AND strftime('%Y-%m', visit_date) = strftime('%Y-%m', 'now') 
        GROUP BY weekLabel ORDER BY weekLabel ASC
      `),
      // 9. Monthly Patient Growth (Current Year)
      this.db.all(`
        SELECT strftime('%Y-%m', registration_date) AS monthLabel, COUNT(*) AS count 
        FROM patients 
        WHERE strftime('%Y', registration_date) = strftime('%Y', 'now') 
        GROUP BY monthLabel ORDER BY monthLabel ASC
      `),
      // 10. Yearly Patient Growth (All Time)
      this.db.all(`
        SELECT strftime('%Y', registration_date) AS yearLabel, COUNT(*) AS count 
        FROM patients 
        GROUP BY yearLabel ORDER BY yearLabel ASC
      `),
      // 11. Yearly Revenue (All Time - First Visit + Follow-up Revenue)
      this.db.all(`
        SELECT strftime('%Y', visit_date) AS yearLabel, SUM(final_amount) AS amount 
        FROM visits 
        WHERE visit_date IS NOT NULL AND visit_date != '' AND (payment_status = 'Paid' OR payment_status IS NULL OR payment_status = '')
        GROUP BY yearLabel ORDER BY yearLabel ASC
      `),
      // 12. Monthly Visits (Current Year)
      this.db.all(`
        SELECT strftime('%Y-%m', visit_date) AS monthLabel, COUNT(*) AS count 
        FROM visits 
        WHERE strftime('%Y', visit_date) = strftime('%Y', 'now') 
        GROUP BY monthLabel ORDER BY monthLabel ASC
      `),
      // 13. Yearly Visits (All Time)
      this.db.all(`
        SELECT strftime('%Y', visit_date) AS yearLabel, COUNT(*) AS count 
        FROM visits 
        GROUP BY yearLabel ORDER BY yearLabel ASC
      `),
      // 14. Monthly Total Revenue (Current Year)
      this.db.all(`
        SELECT strftime('%Y-%m', visit_date) AS monthLabel, SUM(final_amount) AS amount 
        FROM visits 
        WHERE strftime('%Y', visit_date) = strftime('%Y', 'now') AND (payment_status = 'Paid' OR payment_status IS NULL OR payment_status = '')
        GROUP BY monthLabel ORDER BY monthLabel ASC
      `),
      // 15. Blood Group Distribution (Trend over time)
      this.db.all(`
        SELECT 
          strftime('%Y-%m', registration_date) AS monthLabel,
          blood_group,
          COUNT(*) as count 
        FROM patients 
        WHERE blood_group IS NOT NULL AND blood_group != '' AND registration_date IS NOT NULL
        GROUP BY monthLabel, blood_group 
        ORDER BY monthLabel ASC
      `)
    ]);

    return {
      dailyPatients,
      monthlyEarnings,
      medicineCategories,
      patientGrowth,
      recentPatients,
      latestPayments,
      patientAreaDistribution,
      weeklyEarningsCurrentMonth,
      monthlyPatientGrowth,
      yearlyPatientGrowth,
      yearlyRevenue,
      monthlyVisitsGrowth,
      yearlyVisitsGrowth,
      monthlyTotalRevenue,
      bloodGroupDistribution,
      topMedicines: [],
      topDiseases: [],
      topPatients: [],
      upcomingFollowUps: [],
      recentActivity: []
    };
  }

  async updateSetting(key, value) {
    return this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  }

  async insertAuditLog(username, action, tableName, recordId, oldValues, newValues) {
    return this.db.run(
      `INSERT INTO audit_logs (username, action, table_name, record_id, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, action, tableName, recordId, oldValues, newValues]
    );
  }

  /**
   * Smart Merge Restore: Merges incoming backup buffer into active database
   * without deleting local PC data. Keeps all existing records and appends missing ones.
   */
  async mergeDatabaseFromBuffer(dbBuffer, tempDbPath) {
    const fs = require('fs');
    fs.writeFileSync(tempDbPath, dbBuffer);

    // Escape backslashes for SQLite ATTACH command
    const safePath = tempDbPath.replace(/\\/g, '/');
    await this.db.run(`ATTACH DATABASE '${safePath}' AS backup_db`);

    const metrics = {
      patients: { new: 0, updated: 0, skipped: 0, total: 0 },
      visits: { new: 0, updated: 0, skipped: 0, total: 0 },
      medicines: { new: 0, updated: 0, skipped: 0, total: 0 },
      totalNew: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalRecords: 0
    };

    try {
      await this.db.run('BEGIN TRANSACTION');

      const tableRows = await this.db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
      
      const tablesToMerge = [];
      for (const row of tableRows) {
        const name = row.name;
        if (name === 'settings') continue; // Handled separately
        
        const colsInfo = await this.db.all(`PRAGMA table_info(${name})`);
        const colNames = colsInfo.map(c => c.name);
        
        if (colNames.includes('id')) {
          let tsCol = 'updated_at';
          if (!colNames.includes('updated_at') && colNames.includes('created_at')) {
            tsCol = 'created_at';
          } else if (!colNames.includes('updated_at') && !colNames.includes('created_at')) {
            tsCol = null;
          }
          tablesToMerge.push({ name, tsCol, colNames });
        }
      }

      for (const table of tablesToMerge) {
        const { name, tsCol, colNames } = table;
        
        // Initialize metrics for dynamically discovered tables
        if (!metrics[name]) {
          metrics[name] = { new: 0, updated: 0, skipped: 0, total: 0 };
        }

        const insertCols = colNames.join(', ');

        // Query backup data and local data
        let backupRecords = [];
        try {
          backupRecords = await this.db.all(`SELECT * FROM backup_db.${name}`);
        } catch (e) {
          // Table might not exist in an older backup, just skip
          continue;
        }

        const localRecords = await this.db.all(`SELECT * FROM ${name}`);
        
        const localRecordMap = new Map();
        localRecords.forEach(r => localRecordMap.set(r.id, r));

        for (const bRec of backupRecords) {
          const lRec = localRecordMap.get(bRec.id);
          
          if (!lRec) {
            // It's a new record
            const placeholders = colNames.map(() => '?').join(', ');
            const values = colNames.map(col => bRec[col]);
            await this.db.run(`INSERT INTO ${name} (${insertCols}) VALUES (${placeholders})`, values);
            metrics[name].new++;
            metrics.totalNew++;
          } else {
            // Exists in both, check timestamp
            let bTime = tsCol ? new Date(bRec[tsCol] || 0).getTime() : 0;
            let lTime = tsCol ? new Date(lRec[tsCol] || 0).getTime() : 0;
            
            if (isNaN(bTime)) bTime = 0;
            if (isNaN(lTime)) lTime = 0;

            if (bTime > lTime) {
              // Backup is newer, update local
              const setClause = colNames.map(col => `${col} = ?`).join(', ');
              const values = colNames.map(col => bRec[col]);
              values.push(bRec.id); // for WHERE id = ?
              await this.db.run(`UPDATE ${name} SET ${setClause} WHERE id = ?`, values);
              metrics[name].updated++;
              metrics.totalUpdated++;
            } else {
              // Local is newer or equal, skip
              metrics[name].skipped++;
              metrics.totalSkipped++;
            }
          }
        }

        // Count total after merge
        const totalCount = await this.db.get(`SELECT COUNT(*) as c FROM ${name}`);
        metrics[name].total = totalCount.c;
        metrics.totalRecords += totalCount.c;
      }

      // Special case for settings table (just merge key/values)
      try {
        const backupSettings = await this.db.all(`SELECT * FROM backup_db.settings`);
        for (const s of backupSettings) {
          await this.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [s.key, s.value]);
        }
      } catch (e) {
        // Ignored if settings table is missing in older backups
      }

      await this.db.run('COMMIT');
    } catch (err) {
      await this.db.run('ROLLBACK');
      throw err;
    } finally {
      try { await this.db.run(`DETACH DATABASE backup_db`); } catch (_) {}
      try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch (_) {}
    }

    return metrics;
  }
}

module.exports = Database;
