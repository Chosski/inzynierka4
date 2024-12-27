/************************************
 * app.js - zmodyfikowana wersja
 ************************************/
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const winston = require('winston');
require('dotenv').config(); // Wczytuje zmienne z .env
const { URL } = require('url'); // do parsowania DATABASE_URL

const app = express();
const PORT = process.env.PORT || 3000;

/** 
 * Odczytujemy z .env zmienną: DATABASE_URL (np. "mysql://root:haslo@mysql-xsuk.railway.internal:3306/myapp")
 */
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Brak zdefiniowanej zmiennej DATABASE_URL w .env!');
  process.exit(1);
}

const parsedDbUrl = new URL(dbUrl);
const dbConfig = {
  host: parsedDbUrl.hostname,
  port: parseInt(parsedDbUrl.port, 10) || 3306,
  user: parsedDbUrl.username,
  password: parsedDbUrl.password,
  database: parsedDbUrl.pathname.replace('/', ''), // usunięcie "/" z początku ścieżki
};

/**
 * Konfiguracja loggera (winston)
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // zapis logów do pliku system.log
    new winston.transports.File({ filename: path.join(__dirname, 'logs', 'system.log') }),
    // Opcjonalnie można dodać:
    // new winston.transports.Console()
  ],
});

/**
 * Ścieżka do pliku config.json (zawierającego np. maintenanceMode)
 */
const configFilePath = path.join(__dirname, 'config.json');

/**
 * Parsowanie JSON w body
 */
app.use(express.json());

/**
 * Serwuj pliki statyczne z folderu "public"
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Middleware sprawdzający tryb konserwacji
 */
app.use((req, res, next) => {
  fs.readFile(configFilePath, 'utf8', (err, data) => {
    if (err) {
      logger.error('Błąd odczytu pliku konfiguracji:', err);
      return res.status(500).send('Błąd serwera');
    }
    try {
      const config = JSON.parse(data);
      if (
        config.maintenanceMode === 'on' &&
        req.path !== '/index.html' &&
        !req.path.startsWith('/api/login')
      ) {
        return res
          .status(503)
          .send('System jest w trybie konserwacji. Proszę spróbować później.');
      }
      next();
    } catch (parseError) {
      logger.error('Błąd parsowania pliku konfiguracji:', parseError);
      return res.status(500).send('Błąd serwera');
    }
  });
});

/**
 * Funkcja pomocnicza do łączenia się z bazą
 */
async function getConnection() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    // Testowe zapytanie, żeby sprawdzić czy połączenie działa:
    await connection.query('SELECT 1');
    console.log('Połączenie z bazą danych działa poprawnie!');
  } catch (err) {
    console.error('Błąd testu połączenia z bazą:', err);
    throw err;
  }
  return connection;
}

/**
 * Logowanie (POST /api/login)
 */
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  let connection;
  try {
    connection = await getConnection();

    // Pobieramy usera z bazy
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE login = ?',
      [login]
    );

    if (!rows || rows.length === 0) {
      logger.warn(`Nieznany użytkownik lub błędne dane logowania: ${login}`);
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      logger.warn(`Nieudana próba logowania: błędne hasło dla ${login}`);
      return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
    }

    // Sukces:
    logger.info(`Użytkownik ${login} zalogował się pomyślnie.`);
    return res.status(200).json({
      id: user.id,
      login: user.login,
      role: user.role,
      temporaryPassword: user.temporaryPassword === 1,
    });

  } catch (error) {
    // W razie błędu:
    logger.error('Błąd logowania:', error);
    return res.status(500).json({
      message: 'Błąd serwera',
      details: String(error),
    });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
});

/**
 * Użytkownicy: GET /api/users
 */
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
    await connection.end();

    return res.status(200).json(users);
  } catch (error) {
    logger.error('Błąd pobierania użytkowników:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

/**
 * Pobierz użytkownika po ID
 */
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);

    if (!users || users.length === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
    await connection.end();
    return res.status(200).json(users[0]);
  } catch (error) {
    logger.error('Błąd pobierania danych użytkownika:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Dodawanie użytkownika (POST /api/users)
 */
app.post('/api/users', async (req, res) => {
  const { login, firstName, lastName, pesel, role, password } = req.body;
  let connection;
  try {
    connection = await getConnection();
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE login = ? OR pesel = ?',
      [login, pesel]
    );

    if (existingUsers.length > 0) {
      await connection.end();
      logger.warn(`Użytkownik (login=${login} / PESEL=${pesel}) już istnieje.`);
      return res.status(400).json({ message: 'Użytkownik już istnieje' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.execute(
      `INSERT INTO users (login, firstName, lastName, pesel, role, password, temporaryPassword)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [login, firstName, lastName, pesel, role, hashedPassword, false]
    );

    await connection.end();
    logger.info(`Dodano nowego użytkownika: ${login}`);
    return res.status(201).json({
      message: 'Dodano użytkownika',
      id: result.insertId,
    });
  } catch (error) {
    logger.error('Błąd dodawania użytkownika:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Usunięcie użytkownika
 */
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    await connection.end();
    logger.info(`Usunięto użytkownika o ID ${id}.`);
    return res.status(200).json({ message: 'Użytkownik został usunięty' });
  } catch (error) {
    logger.error('Błąd usuwania użytkownika:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Edycja użytkownika (opcjonalne hasło)
 */
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, pesel, role, password } = req.body;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE users SET firstName = ?, lastName = ?, pesel = ?, role = ? WHERE id = ?',
      [firstName, lastName, pesel, role, id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    // jeśli w body jest podane hasło (nie puste), to zaktualizuj
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      await connection.execute(
        'UPDATE users SET password = ?, temporaryPassword = false WHERE id = ?',
        [hashedPassword, id]
      );
    }

    await connection.end();
    logger.info(`Zaktualizowano dane użytkownika o ID ${id}.`);
    return res.status(200).json({
      message: 'Dane użytkownika zostały zaktualizowane',
    });
  } catch (error) {
    logger.error('Błąd edycji użytkownika:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Resetowanie hasła użytkownika
 */
app.put('/api/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { temporaryPassword } = req.body;

  if (!temporaryPassword || temporaryPassword.trim() === '') {
    return res.status(400).json({ message: 'Hasło nie może być puste' });
  }

  let connection;
  try {
    connection = await getConnection();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const [result] = await connection.execute(
      'UPDATE users SET password = ?, temporaryPassword = ? WHERE id = ?',
      [hashedPassword, true, id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    await connection.end();
    logger.info(`Zresetowano hasło użytkownika o ID ${id}.`);
    return res.status(200).json({ message: 'Hasło zostało zresetowane' });
  } catch (error) {
    logger.error('Błąd resetowania hasła:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Widoczne poradnie dla użytkownika
 */
app.get('/api/users/:id/visible-clinics', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [clinics] = await connection.execute(`
      SELECT c.id, c.name
      FROM user_visible_clinics uvc
      JOIN clinics c ON uvc.clinic_id = c.id
      WHERE uvc.user_id = ?
    `, [id]);

    await connection.end();
    return res.status(200).json(clinics);
  } catch (error) {
    logger.error('Błąd pobierania widocznych poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Ustawienie widocznych poradni
 */
app.post('/api/users/:id/visible-clinics', async (req, res) => {
  const { id } = req.params;
  const { clinics } = req.body;
  if (!Array.isArray(clinics)) {
    return res.status(400).json({ message: 'Wymagana lista ID poradni' });
  }

  let connection;
  try {
    connection = await getConnection();
    // Najpierw czyścimy stare wpisy
    await connection.execute('DELETE FROM user_visible_clinics WHERE user_id = ?', [id]);

    for (const cId of clinics) {
      await connection.execute(
        'INSERT INTO user_visible_clinics (user_id, clinic_id) VALUES (?, ?)',
        [id, cId]
      );
    }

    await connection.end();
    logger.info(`Zaktualizowano widoczne poradnie dla użytkownika o ID ${id}.`);
    return res.status(200).json({ message: 'Zaktualizowano widoczne poradnie' });
  } catch (error) {
    logger.error('Błąd aktualizacji widocznych poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie listy lekarzy
 */
app.get('/api/doctors', async (req, res) => {
  const { clinicId, lastName } = req.query;
  let connection;
  try {
    let query =
      'SELECT u.id, u.firstName, u.lastName FROM users u WHERE u.role = "doctor"';
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
    } else if (lastName) {
      query += ' AND u.lastName LIKE ?';
      params.push(`%${lastName}%`);
    }

    connection = await getConnection();
    const [doctors] = await connection.execute(query, params);
    await connection.end();

    return res.status(200).json(doctors);
  } catch (error) {
    logger.error('Błąd pobierania lekarzy:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobranie lekarza po ID
 */
app.get('/api/doctors/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [docs] = await connection.execute(
      'SELECT id, firstName, lastName FROM users WHERE id = ? AND role="doctor"',
      [id]
    );

    if (!docs || docs.length === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono lekarza' });
    }
    await connection.end();
    return res.status(200).json(docs[0]);
  } catch (error) {
    logger.error('Błąd pobierania lekarza:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Dodawanie nowego terminu w tabeli schedules
 */
app.post('/api/schedules', async (req, res) => {
  const { doctorId, patientId, start, end, clinicId } = req.body;
  if (!doctorId || !patientId || !start || !clinicId) {
    return res.status(400).json({
      message: 'Wymagane: doctorId, patientId, start, clinicId',
    });
  }

  let endTime = end;
  if (!endTime) {
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    endTime = endDate.toISOString().slice(0, 19).replace('T', ' ');
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.execute(
      'INSERT INTO schedules (doctor_id, patient_id, clinic_id, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      [doctorId, patientId, clinicId, start, endTime]
    );

    await connection.end();
    logger.info(
      `Dodano nowy termin: lekarz=${doctorId}, pacjent=${patientId}, poradnia=${clinicId}.`
    );
    return res.status(201).json({ message: 'Dodano termin' });
  } catch (error) {
    logger.error('Błąd dodawania terminu:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie terminarza (GET /api/schedules)
 */
app.get('/api/schedules', async (req, res) => {
  const { doctorId, clinicId } = req.query;
  if (!doctorId) {
    return res.status(400).json({ message: 'doctorId jest wymagany' });
  }

  let connection;
  try {
    connection = await getConnection();
    let query = `
      SELECT s.*,
             p.firstName AS patientFirstName,
             p.lastName AS patientLastName,
             p.pesel AS patientPesel,
             c.name AS clinicName
      FROM schedules s
      JOIN patients p ON s.patient_id = p.id
      JOIN clinics c  ON s.clinic_id = c.id
      WHERE s.doctor_id = ?
    `;
    const params = [doctorId];

    if (clinicId) {
      query += ' AND s.clinic_id = ?';
      params.push(clinicId);
    } else {
      // Pobierz wszystkie poradnie przypisane do lekarza
      const [clinicRows] = await connection.execute(
        'SELECT clinic_id FROM doctor_clinics WHERE doctor_id = ?',
        [doctorId]
      );
      const clinicIds = clinicRows.map(row => row.clinic_id);

      if (clinicIds.length === 0) {
        await connection.end();
        return res
          .status(404)
          .json({ message: 'Lekarz nie jest przypisany do żadnej poradni.' });
      }

      // placeholders do IN
      const placeholders = clinicIds.map(() => '?').join(',');
      query += ` AND s.clinic_id IN (${placeholders})`;
      params.push(...clinicIds);
    }

    const [rows] = await connection.execute(query, params);
    await connection.end();

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
        patientPesel: sch.patientPesel,
      },
    }));

    return res.status(200).json(events);
  } catch (error) {
    logger.error('Błąd pobierania terminarzy:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Usunięcie terminu
 */
app.delete('/api/schedules/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'DELETE FROM schedules WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono terminu' });
    }

    await connection.end();
    logger.info(`Usunięto termin o ID ${id}.`);
    return res.status(200).json({ message: 'Termin został usunięty' });
  } catch (error) {
    logger.error('Błąd usuwania terminu:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Dodawanie pacjenta (POST /api/patients)
 */
app.post('/api/patients', async (req, res) => {
  const {
    firstName,
    lastName,
    pesel,
    gender_id,
    nationality_id,
    phone,
    addressResidence,
    addressRegistration,
  } = req.body;

  if (
    !firstName ||
    !lastName ||
    !pesel ||
    !gender_id ||
    !nationality_id ||
    !addressResidence ||
    !addressRegistration
  ) {
    return res
      .status(400)
      .json({ message: 'Wymagane dane pacjenta i obu adresów' });
  }

  let connection;
  try {
    connection = await getConnection();

    // sprawdzenie, czy pacjent o tym PESEL już istnieje
    const [existingPatients] = await connection.execute(
      'SELECT id FROM patients WHERE pesel = ?',
      [pesel]
    );
    if (existingPatients.length > 0) {
      await connection.end();
      return res
        .status(400)
        .json({ message: 'Pacjent z tym numerem PESEL już istnieje' });
    }

    // Funkcja pomocnicza do wstawiania adresu
    async function insertAddress(addr) {
      const [result] = await connection.execute(
        `INSERT INTO addresses (country, city, postal_code, street, house_number, apartment_number)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          addr.country,
          addr.city,
          addr.postal_code,
          addr.street,
          addr.house_number,
          addr.apartment_number,
        ]
      );
      return result.insertId;
    }

    // wstawiamy oba adresy
    const addressResidence_id = await insertAddress(addressResidence);
    const addressRegistration_id = await insertAddress(addressRegistration);

    // wstawiamy pacjenta
    const [resultPatient] = await connection.execute(
      `INSERT INTO patients (
         firstName,
         lastName,
         pesel,
         gender_id,
         nationality_id,
         phone,
         addressResidence_id,
         addressRegistration_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        firstName,
        lastName,
        pesel,
        gender_id,
        nationality_id,
        phone || null,
        addressResidence_id,
        addressRegistration_id,
      ]
    );

    await connection.end();
    logger.info(`Dodano pacjenta: ${firstName} ${lastName}, PESEL=${pesel}.`);
    return res.status(201).json({ message: 'Dodano pacjenta', id: resultPatient.insertId });
  } catch (error) {
    logger.error('Błąd dodawania pacjenta:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie pacjentów
 */
app.get('/api/patients', async (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT p.*,
           g.name AS genderName,
           c.name AS nationalityName
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

  let connection;
  try {
    connection = await getConnection();
    const [patients] = await connection.execute(query, params);
    await connection.end();
    return res.status(200).json(patients);
  } catch (error) {
    logger.error('Błąd pobierania pacjentów:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie listy płci
 */
app.get('/api/genders', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [genders] = await connection.execute('SELECT id, name FROM genders');
    await connection.end();
    return res.status(200).json(genders);
  } catch (error) {
    logger.error('Błąd pobierania płci:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie krajów
 */
app.get('/api/countries', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [countries] = await connection.execute('SELECT id, name FROM countries');
    await connection.end();
    return res.status(200).json(countries);
  } catch (error) {
    logger.error('Błąd pobierania krajów:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Edycja terminu (zmiana start i end)
 */
app.put('/api/schedules/:id', async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ message: 'Wymagane pola: start i end' });
  }

  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ?',
      [start, end, id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono terminu' });
    }

    await connection.end();
    logger.info(`Zaktualizowano termin ID=${id}.`);
    return res.status(200).json({ message: 'Termin zaktualizowany' });
  } catch (error) {
    logger.error('Błąd edycji terminu:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Poradnie: GET /api/clinics
 */
app.get('/api/clinics', async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const [clinics] = await connection.execute('SELECT id, name FROM clinics');
    await connection.end();
    return res.status(200).json(clinics);
  } catch (error) {
    logger.error('Błąd pobierania poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Dodanie nowej poradni (POST /api/clinics)
 */
app.post('/api/clinics', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa poradni jest wymagana' });
  }

  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO clinics (name) VALUES (?)',
      [name]
    );

    await connection.end();
    logger.info(`Dodano nową poradnię: ${name}.`);
    return res.status(201).json({ message: 'Dodano poradnię', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Edycja poradni (PUT /api/clinics/:id)
 */
app.put('/api/clinics/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa poradni jest wymagana' });
  }

  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE clinics SET name = ? WHERE id = ?',
      [name, id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono poradni' });
    }

    await connection.end();
    logger.info(`Zaktualizowano poradnię o ID=${id}.`);
    return res.status(200).json({ message: 'Zaktualizowano poradnię' });
  } catch (error) {
    logger.error('Błąd edycji poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Usunięcie poradni
 */
app.delete('/api/clinics/:id', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [result] = await connection.execute(
      'DELETE FROM clinics WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ message: 'Nie znaleziono poradni' });
    }

    await connection.end();
    logger.info(`Usunięto poradnię o ID=${id}.`);
    return res.status(200).json({ message: 'Poradnia została usunięta' });
  } catch (error) {
    logger.error('Błąd usuwania poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Pobieranie lekarzy danej poradni
 */
app.get('/api/clinics/:id/doctors', async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await getConnection();
    const [doctors] = await connection.execute(
      `SELECT u.id, u.firstName, u.lastName
       FROM doctor_clinics dc
       JOIN users u ON dc.doctor_id = u.id
       WHERE dc.clinic_id = ? AND u.role = 'doctor'`,
      [id]
    );
    await connection.end();
    return res.status(200).json(doctors);
  } catch (error) {
    logger.error('Błąd pobierania lekarzy poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Ustawienie lekarzy w danej poradni
 */
app.post('/api/clinics/:id/doctors', async (req, res) => {
  const { id } = req.params;
  const { doctors } = req.body;
  if (!Array.isArray(doctors)) {
    return res.status(400).json({ message: 'Wymagana lista ID lekarzy' });
  }

  let connection;
  try {
    connection = await getConnection();
    await connection.execute('DELETE FROM doctor_clinics WHERE clinic_id = ?', [id]);

    for (const docId of doctors) {
      await connection.execute(
        'INSERT INTO doctor_clinics (doctor_id, clinic_id) VALUES (?, ?)',
        [docId, id]
      );
    }

    await connection.end();
    logger.info(`Zaktualizowano lekarzy dla poradni o ID=${id}.`);
    return res.status(200).json({ message: 'Zaktualizowano lekarzy dla poradni' });
  } catch (error) {
    logger.error('Błąd aktualizacji lekarzy poradni:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  } finally {
    if (connection) connection.end();
  }
});

/**
 * Endpoint pobierania konfiguracji systemowej (GET /api/system-config)
 */
app.get('/api/system-config', async (req, res) => {
  try {
    const cfgPath = path.join(__dirname, 'config.json');
    if (!fs.existsSync(cfgPath)) {
      return res.status(404).json({ message: 'Plik konfiguracji nie został znaleziony.' });
    }

    fs.readFile(cfgPath, 'utf8', (err, data) => {
      if (err) {
        logger.error('Błąd odczytu config.json:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas odczytu konfiguracji.' });
      }
      try {
        const config = JSON.parse(data);
        return res.status(200).json(config);
      } catch (parseError) {
        logger.error('Błąd parsowania config.json:', parseError);
        return res.status(500).json({ message: 'Błąd serwera podczas parsowania konfiguracji.' });
      }
    });
  } catch (error) {
    logger.error('Błąd pobierania konfiguracji systemowej:', error);
    return res.status(500).json({ message: 'Błąd serwera.' });
  }
});

/**
 * Endpoint aktualizacji konfiguracji systemowej (PUT /api/system-config)
 */
app.put('/api/system-config', async (req, res) => {
  try {
    const newConfig = req.body;
    if (typeof newConfig !== 'object' || Array.isArray(newConfig) || newConfig === null) {
      return res.status(400).json({ message: 'Nieprawidłowy format danych konfiguracji.' });
    }

    const cfgPath = path.join(__dirname, 'config.json');
    fs.writeFile(cfgPath, JSON.stringify(newConfig, null, 2), 'utf8', (err) => {
      if (err) {
        logger.error('Błąd zapisu do config.json:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas zapisu konfiguracji.' });
      }
      return res.status(200).json({ message: 'Konfiguracja została zaktualizowana.' });
    });
  } catch (error) {
    logger.error('Błąd aktualizacji konfiguracji systemowej:', error);
    return res.status(500).json({ message: 'Błąd serwera.' });
  }
});

/**
 * Pobieranie logów systemowych
 */
app.get('/api/system-logs', async (req, res) => {
  try {
    const logPath = path.join(__dirname, 'logs', 'system.log');
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ message: 'Plik logów nie został znaleziony.' });
    }

    fs.readFile(logPath, 'utf8', (err, data) => {
      if (err) {
        logger.error('Błąd odczytu system.log:', err);
        return res.status(500).json({ message: 'Błąd serwera podczas odczytu logów.' });
      }
      return res.status(200).send(data);
    });
  } catch (error) {
    logger.error('Błąd pobierania systemowych logów:', error);
    return res.status(500).json({ message: 'Błąd serwera.' });
  }
});

/** 
 * Przykładowe trasy do plików HTML z folderu "public".
 * Jeśli pliki html są w "public/", express.static je i tak obsłuży.
 */
app.get('/edit_patient.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit_patient.html'));
});
app.get('/add_patient.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add_patient.html'));
});
app.get('/add_user.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add_user.html'));
});
app.get('/schedule.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

/**
 * Uruchamiamy serwer
 */
app.listen(PORT, () => {
  console.log(`Serwer działa na porcie: http://localhost:${PORT}`);
});
