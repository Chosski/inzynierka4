const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const winston = require('winston');
const dotenv = require('dotenv').config();

const app = express();
const PORT = 3000;

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(__dirname, 'logs', 'system.log') }),
  ],
});

const configFilePath = path.join(__dirname, 'config.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware sprawdzający tryb konserwacji
app.use((req, res, next) => {
  fs.readFile(configFilePath, 'utf8', (err, data) => {
    if (err) {
      logger.error('Błąd odczytu pliku konfiguracji:', err);
      return res.status(500).send('Błąd serwera');
    }
    try {
      const config = JSON.parse(data);
      if (config.maintenanceMode === 'on' && req.path !== '/index.html' && !req.path.startsWith('/api/login')) {
        res.status(503).send('System jest w trybie konserwacji. Proszę spróbować później.');
      } else {
        next();
      }
    } catch (parseError) {
      logger.error('Błąd parsowania pliku konfiguracji:', parseError);
      return res.status(500).send('Błąd serwera');
    }
  });
});

async function getConnection() {
  const connection = await mysql.createConnection(dbConfig);
  return connection;
}

// Strona główna
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Logowanie
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT * FROM users WHERE login = ?', [login]);

    if (rows.length > 0) {
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        logger.info(`Użytkownik ${login} zalogował się pomyślnie.`);
        res.status(200).json({
          id: user.id,
          login: user.login,
          role: user.role,
          temporaryPassword: user.temporaryPassword === 1,
        });
      } else {
        logger.warn(`Nieudana próba logowania dla ${login} - nieprawidłowe hasło.`);
        res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
      }
    } else {
      logger.warn(`Nieudana próba logowania - nieznany użytkownik ${login}.`);
      res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
    }
    connection.end();
  } catch (error) {
    logger.error('Błąd logowania:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Użytkownicy
app.get('/api/users', async (req, res) => {
  try {
    const { login, lastName } = req.query;
    let query = 'SELECT id, login, firstName, lastName, pesel, role FROM users';
    const params = [];

    if (login) {
      query += ' WHERE login LIKE ?';
      params.push(`%${login}%`);
    } else if (lastName) {
      query += ' WHERE lastName LIKE ?';
      params.push(`%${lastName}%`);
    }

    const connection = await getConnection();
    const [users] = await connection.execute(query, params);
    connection.end();
    res.status(200).json(users);
  } catch (error) {
    logger.error('Błąd pobierania użytkowników:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
    connection.end();

    if (users.length > 0) {
      res.status(200).json(users[0]);
    } else {
      res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
  } catch (error) {
    logger.error('Błąd pobierania danych użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/users', async (req, res) => {
  const { login, firstName, lastName, pesel, role, password } = req.body;
  try {
    const connection = await getConnection();
    const [existingUsers] = await connection.execute('SELECT * FROM users WHERE login = ? OR pesel = ?', [login, pesel]);

    if (existingUsers.length > 0) {
      connection.end();
      logger.warn(`Próba dodania istniejącego użytkownika ${login} lub PESEL ${pesel}.`);
      return res.status(400).json({ message: 'Użytkownik już istnieje' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await connection.execute(
      'INSERT INTO users (login, firstName, lastName, pesel, role, password, temporaryPassword) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [login, firstName, lastName, pesel, role, hashedPassword, false]
    );
    connection.end();
    logger.info(`Dodano nowego użytkownika ${login}.`);
    res.status(201).json({ message: 'Dodano użytkownika', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute('DELETE FROM users WHERE id = ?', [id]);
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Usunięto użytkownika o ID ${id}.`);
      res.status(200).json({ message: 'Użytkownik został usunięty' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
  } catch (error) {
    logger.error('Błąd usuwania użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Edycja użytkownika - opcjonalne hasło
app.put('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, pesel, role, password } = req.body;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE users SET firstName = ?, lastName = ?, pesel = ?, role = ? WHERE id = ?',
      [firstName, lastName, pesel, role, id]
    );

    if (result.affectedRows > 0) {
      if (password && password.trim() !== '') {
        const hashedPassword = await bcrypt.hash(password.trim(), 10);
        await connection.execute(
          'UPDATE users SET password = ?, temporaryPassword = false WHERE id = ?',
          [hashedPassword, id]
        );
      }

      logger.info(`Zaktualizowano dane użytkownika o ID ${id}.`);
      res.status(200).json({ message: 'Dane użytkownika zostały zaktualizowane' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    connection.end();
  } catch (error) {
    logger.error('Błąd edycji użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.put('/api/users/:id/reset-password', async (req, res) => {
  const id = req.params.id;
  const { temporaryPassword } = req.body;
  if (!temporaryPassword || temporaryPassword.trim() === '') {
    return res.status(400).json({ message: 'Hasło nie może być puste' });
  }

  try {
    const connection = await getConnection();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const [result] = await connection.execute(
      'UPDATE users SET password = ?, temporaryPassword = ? WHERE id = ?',
      [hashedPassword, true, id]
    );
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Zresetowano hasło użytkownika o ID ${id}.`);
      res.status(200).json({ message: 'Hasło zostało zresetowane' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
  } catch (error) {
    logger.error('Błąd resetowania hasła:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Widoczne poradnie dla użytkownika
app.get('/api/users/:id/visible-clinics', async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await getConnection();
    const [clinics] = await connection.execute(`
      SELECT c.id, c.name
      FROM user_visible_clinics uvc
      JOIN clinics c ON uvc.clinic_id = c.id
      WHERE uvc.user_id = ?
    `, [userId]);
    connection.end();
    res.status(200).json(clinics);
  } catch (error) {
    logger.error('Błąd pobierania widocznych poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});



app.post('/api/users/:id/visible-clinics', async (req, res) => {
  const id = req.params.id;
  const { clinics } = req.body;
  if (!Array.isArray(clinics)) {
    return res.status(400).json({ message: 'Wymagana lista id poradni' });
  }

  try {
    const connection = await getConnection();
    await connection.execute('DELETE FROM user_visible_clinics WHERE user_id = ?', [id]);

    for (const cId of clinics) {
      await connection.execute('INSERT INTO user_visible_clinics (user_id, clinic_id) VALUES (?, ?)', [id, cId]);
    }

    connection.end();
    logger.info(`Zaktualizowano widoczne poradnie dla użytkownika o ID ${id}.`);
    res.status(200).json({ message: 'Zaktualizowano widoczne poradnie' });
  } catch (error) {
    logger.error('Błąd aktualizacji widocznych poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/doctors', async (req, res) => {
  const { clinicId, lastName } = req.query;
  let query = 'SELECT u.id, u.firstName, u.lastName FROM users u WHERE u.role = "doctor"';
  const params = [];

  if (clinicId) {
    query = `
      SELECT u.id, u.firstName, u.lastName 
      FROM users u
      JOIN doctor_clinics dc ON u.id = dc.doctor_id
      WHERE u.role = "doctor" AND dc.clinic_id = ?
    `;
    params.push(clinicId);
    if (lastName) {
      query += ' AND u.lastName LIKE ?';
      params.push(`%${lastName}%`);
    }
  } else {
    if (lastName) {
      query += ' AND u.lastName LIKE ?';
      params.push(`%${lastName}%`);
    }
  }

  try {
    const connection = await getConnection();
    const [doctors] = await connection.execute(query, params);
    connection.end();
    res.status(200).json(doctors);
  } catch (error) {
    logger.error('Błąd pobierania lekarzy:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/doctors/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [docs] = await connection.execute('SELECT id, firstName, lastName FROM users WHERE id = ? AND role="doctor"', [id]);
    connection.end();
    if (docs.length > 0) {
      res.status(200).json(docs[0]);
    } else {
      res.status(404).json({ message: 'Nie znaleziono lekarza' });
    }
  } catch (error) {
    logger.error('Błąd pobierania lekarza:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Terminarze z kolumnami start_time i end_time
// Dodawanie nowego terminu
app.post('/api/schedules', async (req, res) => {
  const { doctorId, patientId, start, end, clinicId } = req.body;

  if (!doctorId || !patientId || !start || !clinicId) {
    return res.status(400).json({ message: 'Wymagane: doctorId, patientId, start, clinicId' });
  }

  let endTime = end;
  if (!endTime) {
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 30*60000);
    endTime = endDate.toISOString().slice(0,19).replace('T',' ');
  }

  try {
    const connection = await getConnection();
    await connection.execute(
      'INSERT INTO schedules (doctor_id, patient_id, clinic_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [doctorId, patientId, clinicId, start, endTime]
    );
    connection.end();
    logger.info(`Dodano nowy termin: lekarz ${doctorId}, pacjent ${patientId}, poradnia ${clinicId}.`);
    res.status(201).json({ message: 'Dodano termin' });
  } catch (error) {
    logger.error('Błąd dodawania terminu:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Pobieranie terminarza
app.get('/api/schedules', async (req, res) => {
  const { doctorId, clinicId } = req.query;

  if (!doctorId) {
    return res.status(400).json({ message: 'doctorId jest wymagany' });
  }

  try {
    const connection = await getConnection();

    let query = `
      SELECT s.*, p.firstName AS patientFirstName, p.lastName AS patientLastName, p.pesel AS patientPesel, c.name AS clinicName
      FROM schedules s
      JOIN patients p ON s.patient_id = p.id
      JOIN clinics c ON s.clinic_id = c.id
      WHERE s.doctor_id = ?
    `;
    const params = [doctorId];

    if (clinicId) {
      query += ' AND s.clinic_id = ?';
      params.push(clinicId);
    } else {
      // Pobierz wszystkie poradnie przypisane do lekarza
      const [clinicRows] = await connection.execute(`
        SELECT clinic_id FROM doctor_clinics WHERE doctor_id = ?
      `, [doctorId]);

      const clinicIds = clinicRows.map(row => row.clinic_id);

      if (clinicIds.length === 0) {
        connection.end();
        return res.status(404).json({ message: 'Lekarz nie jest przypisany do żadnej poradni.' });
      }

      const placeholders = clinicIds.map(() => '?').join(',');
      query += ` AND s.clinic_id IN (${placeholders})`;
      params.push(...clinicIds);
    }

    const [rows] = await connection.execute(query, params);
    connection.end();

    const events = rows.map(sch => ({
      id: sch.id,
      title: `${sch.patientFirstName} ${sch.patientLastName} (PESEL: ${sch.patientPesel})`,
      start: sch.start_time,
      end: sch.end_time,
      extendedProps: {
        doctorId: sch.doctor_id,
        patientId: sch.patient_id,
        clinicId: sch.clinic_id,
        clinicName: sch.clinicName,
        patientFirstName: sch.patientFirstName,
        patientLastName: sch.patientLastName,
        patientPesel: sch.patientPesel
      }
    }));

    res.status(200).json(events);
  } catch (error) {
    logger.error('Błąd pobierania terminarzy:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Usuwanie terminu
app.delete('/api/schedules/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute('DELETE FROM schedules WHERE id = ?', [id]);
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Usunięto termin ID ${id}.`);
      res.status(200).json({ message: 'Termin został usunięty' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono terminu' });
    }
  } catch (error) {
    logger.error('Błąd usuwania terminu:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/patients', async (req, res) => {
  const {
    firstName,
    lastName,
    pesel,
    gender_id,
    nationality_id,
    phone,
    addressResidence,
    addressRegistration
  } = req.body;

  if (!firstName || !lastName || !pesel || !gender_id || !nationality_id || !addressResidence || !addressRegistration) {
    return res.status(400).json({ message: 'Wymagane dane pacjenta i obu adresów' });
  }

  try {
    const connection = await getConnection();
    // Sprawdzenie czy pacjent o tym PESEL już istnieje
    const [existingPatients] = await connection.execute('SELECT id FROM patients WHERE pesel = ?', [pesel]);
    if (existingPatients.length > 0) {
      connection.end();
      return res.status(400).json({ message: 'Pacjent z tym numerem PESEL już istnieje' });
    }

    // Wstawianie adresów do tabeli addresses
    const insertAddress = async (addr) => {
      const [result] = await connection.execute(
        `INSERT INTO addresses (country, city, postal_code, street, house_number, apartment_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [addr.country, addr.city, addr.postal_code, addr.street, addr.house_number, addr.apartment_number]
      );
      return result.insertId;
    };

    const addressResidence_id = await insertAddress(addressResidence);
    const addressRegistration_id = await insertAddress(addressRegistration);

    // Wstawianie pacjenta
    const [resultPatient] = await connection.execute(
      `INSERT INTO patients (firstName, lastName, pesel, gender_id, nationality_id, phone, addressResidence_id, addressRegistration_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, pesel, gender_id, nationality_id, phone || null, addressResidence_id, addressRegistration_id]
    );

    connection.end();
    logger.info(`Dodano nowego pacjenta ${firstName} ${lastName}, pesel: ${pesel}.`);
    res.status(201).json({ message: 'Dodano pacjenta', id: resultPatient.insertId });

  } catch (error) {
    logger.error('Błąd dodawania pacjenta:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});


app.get('/api/patients', async (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT p.*, g.name AS genderName, c.name AS nationalityName
    FROM patients p
    LEFT JOIN genders g ON p.gender_id = g.id
    LEFT JOIN countries c ON p.nationality_id = c.id
  `;
  const params = [];

  if (search) {
    query += ` WHERE p.firstName LIKE ? OR p.lastName LIKE ? OR p.pesel LIKE ?`;
    const likeSearch = `%${search}%`;
    params.push(likeSearch, likeSearch, likeSearch);
  }

  try {
    const connection = await getConnection();
    const [patients] = await connection.execute(query, params);
    connection.end();
    res.status(200).json(patients);
  } catch (error) {
    logger.error('Błąd pobierania pacjentów:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/genders', async (req, res) => {
  try {
    const connection = await getConnection();
    const [genders] = await connection.execute('SELECT id, name FROM genders');
    connection.end();
    res.status(200).json(genders);
  } catch (error) {
    logger.error('Błąd pobierania płci:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/countries', async (req, res) => {
  try {
    const connection = await getConnection();
    const [countries] = await connection.execute('SELECT id, name FROM countries');
    connection.end();
    res.status(200).json(countries);
  } catch (error) {
    logger.error('Błąd pobierania krajów:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});


// Edycja terminu (start i end)
app.put('/api/schedules/:id', async (req, res) => {
  const id = req.params.id;
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ message: 'Wymagane pola: start i end' });
  }

  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ?',
      [start, end, id]
    );
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Zaktualizowano termin ID ${id}.`);
      res.status(200).json({ message: 'Termin zaktualizowany' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono terminu' });
    }
  } catch (error) {
    logger.error('Błąd edycji terminu:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Poradnie
app.get('/api/clinics', async (req, res) => {
  try {
    const connection = await getConnection();
    const [clinics] = await connection.execute('SELECT id, name FROM clinics');
    connection.end();
    res.status(200).json(clinics);
  } catch (error) {
    logger.error('Błąd pobierania poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/clinics', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Nazwa poradni jest wymagana' });

  try {
    const connection = await getConnection();
    const [result] = await connection.execute('INSERT INTO clinics (name) VALUES (?)', [name]);
    connection.end();
    logger.info(`Dodano nową poradnię: ${name}.`);
    res.status(201).json({ message: 'Dodano poradnię', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.put('/api/clinics/:id', async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Nazwa poradni jest wymagana' });

  try {
    const connection = await getConnection();
    const [result] = await connection.execute('UPDATE clinics SET name = ? WHERE id = ?', [name, id]);
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Zaktualizowano poradnię o ID ${id}.`);
      res.status(200).json({ message: 'Zaktualizowano poradnię' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono poradni' });
    }
  } catch (error) {
    logger.error('Błąd edycji poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.delete('/api/clinics/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute('DELETE FROM clinics WHERE id = ?', [id]);
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Usunięto poradnię o ID ${id}.`);
      res.status(200).json({ message: 'Poradnia została usunięta' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono poradni' });
    }
  } catch (error) {
    logger.error('Błąd usuwania poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/clinics/:id/doctors', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [doctors] = await connection.execute(`
      SELECT u.id, u.firstName, u.lastName 
      FROM doctor_clinics dc
      JOIN users u ON dc.doctor_id = u.id
      WHERE dc.clinic_id = ? AND u.role = 'doctor'`, [id]);
    connection.end();
    res.status(200).json(doctors);
  } catch (error) {
    logger.error('Błąd pobierania lekarzy poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/clinics/:id/doctors', async (req, res) => {
  const id = req.params.id;
  const { doctors } = req.body;
  if (!Array.isArray(doctors)) {
    return res.status(400).json({ message: 'Wymagana lista id lekarzy' });
  }

  try {
    const connection = await getConnection();
    await connection.execute('DELETE FROM doctor_clinics WHERE clinic_id = ?', [id]);

    for (const docId of doctors) {
      await connection.execute('INSERT INTO doctor_clinics (doctor_id, clinic_id) VALUES (?, ?)', [docId, id]);
    }

    connection.end();
    logger.info(`Zaktualizowano lekarzy dla poradni o ID ${id}.`);
    res.status(200).json({ message: 'Zaktualizowano lekarzy dla poradni' });
  } catch (error) {
    logger.error('Błąd aktualizacji lekarzy poradni:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Endpoint pobierania konfiguracji systemowej
app.get('/api/system-config', async (req, res) => {
  try {
    const configFilePath = path.join(__dirname, 'config.json');

    // Sprawdzenie, czy plik konfiguracyjny istnieje
    if (!fs.existsSync(configFilePath)) {
      return res.status(404).json({ message: 'Plik konfiguracji nie został znaleziony.' });
    }

    // Czytanie zawartości pliku konfiguracyjnego
    fs.readFile(configFilePath, 'utf8', (err, data) => {
      if (err) {
        logger.error('Błąd odczytu pliku config.json:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas odczytu konfiguracji.' });
      }
      try {
        const config = JSON.parse(data);
        res.status(200).json(config);
      } catch (parseError) {
        logger.error('Błąd parsowania pliku config.json:', parseError);
        res.status(500).json({ message: 'Błąd serwera podczas parsowania konfiguracji.' });
      }
    });
  } catch (error) {
    logger.error('Błąd pobierania konfiguracji systemowej:', error);
    res.status(500).json({ message: 'Błąd serwera.' });
  }
});

// Endpoint aktualizacji konfiguracji systemowej
app.put('/api/system-config', async (req, res) => {
  try {
    const newConfig = req.body; // Zakładamy, że ciało żądania zawiera nową konfigurację jako JSON

    // Walidacja danych (przykładowa)
    if (typeof newConfig !== 'object' || Array.isArray(newConfig) || newConfig === null) {
      return res.status(400).json({ message: 'Nieprawidłowy format danych konfiguracji.' });
    }

    const configFilePath = path.join(__dirname, 'config.json');

    // Zapis nowej konfiguracji do pliku
    fs.writeFile(configFilePath, JSON.stringify(newConfig, null, 2), 'utf8', (err) => {
      if (err) {
        logger.error('Błąd zapisu do pliku config.json:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas zapisu konfiguracji.' });
      }
      res.status(200).json({ message: 'Konfiguracja została zaktualizowana.' });
    });
  } catch (error) {
    logger.error('Błąd aktualizacji konfiguracji systemowej:', error);
    res.status(500).json({ message: 'Błąd serwera.' });
  }
});

app.get('/api/system-logs', async (req, res) => {
  try {
    const logFilePath = path.join(__dirname, 'logs', 'system.log');

    // Sprawdzenie, czy plik istnieje
    if (!fs.existsSync(logFilePath)) {
      return res.status(404).json({ message: 'Plik logów nie został znaleziony.' });
    }

    // Czytanie zawartości pliku logów
    fs.readFile(logFilePath, 'utf8', (err, data) => {
      if (err) {
        logger.error('Błąd odczytu pliku system.log:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas odczytu logów.' });
      }
      res.status(200).send(data);
    });
  } catch (error) {
    logger.error('Błąd pobierania systemowych logów:', error);
    res.status(500).json({ message: 'Błąd serwera.' });
  }
});

// Strony statyczne
app.get('/edit_patient.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/edit_patient.html'));
});
app.get('/add_patient.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/add_patient.html'));
});
app.get('/add_user.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/add_user.html'));
});


app.get('/schedule.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/schedule.html'));
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});

