

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
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Brak zdefiniowanej zmiennej DATABASE_URL w .env!');
  process.exit(1);
}


//Parsujemy URL i rozbijamy na części składowe
const parsedDbUrl = new URL(dbUrl);
const dbConfig = {
  host: parsedDbUrl.hostname,
  port: parseInt(parsedDbUrl.port, 10) || 3306,
  user: parsedDbUrl.username,
  password: parsedDbUrl.password,
  database: parsedDbUrl.pathname.replace('/', ''), // usunięcie "/" z początku ścieżki
};

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // zapis logów do pliku system.log
    new winston.transports.File({ filename: path.join(__dirname, 'logs', 'system.log') }),

  ],
});

const configFilePath = path.join(__dirname, 'config.json');

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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
        return res.status(503).send('System jest w trybie konserwacji. Proszę spróbować później.');
      }
      next();
    } catch (parseError) {
      logger.error('Błąd parsowania pliku konfiguracji:', parseError);
      return res.status(500).send('Błąd serwera');
    }
  });
});

//POST /api/change-password
app.post('/api/change-password', async (req, res) => {
  const { login, newPassword } = req.body;
  if (!login || !newPassword) {
    return res.status(400).json({ message: 'Brak loginu lub nowego hasła' });
  }

  try {
    const connection = await getConnection();
    // szukamy usera po loginie
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE login = ?',
      [login]
    );
    if (rows.length === 0) {
      connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    const userId = rows[0].id;

    // hashowanie
    const hashed = await bcrypt.hash(newPassword, 10);
    await connection.execute(
      'UPDATE users SET password = ?, temporaryPassword = 0 WHERE id = ?',
      [hashed, userId]
    );
    connection.end();

    res.status(200).json({ message: 'Hasło zostało zmienione.' });
  } catch (err) {
    console.error('Błąd zmiany hasła:', err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

//LOGOWANIE
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

        // Sprawdzamy, czy hasło jest tymczasowe (temporaryPassword == 1)
        const isTemp = (user.temporaryPassword === 1);

        // Zwracamy informację o konieczności zmiany hasła
        res.status(200).json({
          id: user.id,
          login: user.login,
          temporaryPassword: isTemp,
          forcePasswordChange: isTemp, // <-- front może to wykorzystać do przekierowania
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

//Użytkownicy
// Pobieranie listy użytkowników (z opcjonalnym filtrem login/lastName)
app.get('/api/users', async (req, res) => {
  try {
    const { login, lastName } = req.query;
    let query = 'SELECT id, login, firstName, lastName, pesel FROM users';
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

// Pobieranie konkretnego użytkownika
app.get('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [users] = await connection.execute(
      'SELECT id, login, firstName, lastName, pesel, password, temporaryPassword FROM users WHERE id = ?',
      [id]
    );
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

// Dodawanie użytkownika 
app.post('/api/users', async (req, res) => {
  const { login, firstName, lastName, pesel, password } = req.body;
  try {
    const connection = await getConnection();
    // Sprawdź, czy istnieje już użytkownik o podanym loginie lub PESEL
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE login = ? OR pesel = ?',
      [login, pesel]
    );

    if (existingUsers.length > 0) {
      connection.end();
      logger.warn(`Próba dodania istniejącego użytkownika ${login} lub PESEL ${pesel}.`);
      return res.status(400).json({ message: 'Użytkownik już istnieje' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const [result] = await connection.execute(
      'INSERT INTO users (login, firstName, lastName, pesel, password, temporaryPassword) VALUES (?, ?, ?, ?, ?, ?)',
      [login, firstName, lastName, pesel, hashedPassword, false]
    );
    connection.end();
    logger.info(`Dodano nowego użytkownika ${login}.`);
    res.status(201).json({ message: 'Dodano użytkownika', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Usuwanie użytkownika
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

// Edycja użytkownika
app.put('/api/users/:id', async (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, pesel, password } = req.body;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE users SET firstName = ?, lastName = ?, pesel = ? WHERE id = ?',
      [firstName, lastName, pesel, id]
    );

    if (result.affectedRows > 0) {
      // Jeżeli przesłano nowe hasło
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

// Resetowanie hasła użytkownika 
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
      [hashedPassword, 1, id] // ustawia temporaryPassword = 1
    );
    connection.end();

    if (result.affectedRows > 0) {
      logger.info(`Zresetowano hasło użytkownika o ID ${id}. Tymczasowe hasło: ${temporaryPassword}`);
      res.status(200).json({ message: 'Hasło zostało zresetowane' });
    } else {
      res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }
  } catch (error) {
    logger.error('Błąd resetowania hasła:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});


app.put('/api/users/:id/change-initial-password', async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ message: 'Hasło musi mieć co najmniej 6 znaków.' });
  }

  try {
    const connection = await getConnection();
    // sprawdzamy czy user wciąż ma temporaryPassword = 1
    const [rows] = await connection.execute(
      'SELECT id, temporaryPassword FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    const user = rows[0];
    if (user.temporaryPassword !== 1) {
      connection.end();
      return res.status(400).json({
        message: 'Ten użytkownik nie wymaga zmiany hasła tymczasowego.',
      });
    }

    // Ustawiamy nowe hasło i temporaryPassword = 0
    const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);
    await connection.execute(
      'UPDATE users SET password = ?, temporaryPassword = 0 WHERE id = ?',
      [hashedPassword, userId]
    );
    connection.end();

    logger.info(`Użytkownik ${userId} ustawił własne hasło (pierwsze logowanie).`);
    return res.status(200).json({
      message: 'Hasło zostało ustawione. Możesz teraz zalogować się ponownie.',
    });
  } catch (error) {
    logger.error('Błąd ustawiania hasła początkowego:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

//Widoczne poradnie dla użytkownika
app.get('/api/users/:id/visible-clinics', async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await getConnection();
    const [clinics] = await connection.execute(
      `
      SELECT c.id, c.name
      FROM user_visible_clinics uvc
      JOIN clinics c ON uvc.clinic_id = c.id
      WHERE uvc.user_id = ?
      `,
      [userId]
    );
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

//Lekarze
app.get('/api/doctors', async (req, res) => {
  const { clinicId, lastName } = req.query;

  // Zmieniony query: LEFT JOIN + check group "doctor" OR existing doctor_clinics
  let baseQuery = `
    SELECT DISTINCT u.id, u.firstName, u.lastName
    FROM users u
    LEFT JOIN doctor_clinics dc ON u.id = dc.doctor_id
    LEFT JOIN user_permission_groups upg ON upg.user_id = u.id
    LEFT JOIN permission_groups pg ON pg.id = upg.group_id
    WHERE (pg.name = 'doctor' OR dc.doctor_id IS NOT NULL)
  `;
  const params = [];

  // Opcjonalny filtr clinicId
  if (clinicId) {
    baseQuery += ' AND dc.clinic_id = ?';
    params.push(clinicId);
  }
  // Opcjonalny filtr nazwiska
  if (lastName) {
    baseQuery += ' AND u.lastName LIKE ?';
    params.push(`%${lastName}%`);
  }

  try {
    const connection = await getConnection();
    const [rows] = await connection.execute(baseQuery, params);
    connection.end();
    return res.status(200).json(rows);
  } catch (error) {
    logger.error('Błąd pobierania lekarzy:', error);
    return res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/doctors/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute(
      `
      SELECT u.id, u.firstName, u.lastName
      FROM users u
      JOIN doctor_clinics dc ON u.id = dc.doctor_id
      WHERE u.id = ?
    `,
      [id]
    );
    connection.end();
    if (rows.length > 0) {
      res.status(200).json(rows[0]);
    } else {
      res.status(404).json({ message: 'Nie znaleziono lekarza' });
    }
  } catch (error) {
    logger.error('Błąd pobierania lekarza:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

//Terminarz
// Pobieranie liczby dzisiejszych wizyt
app.get('/api/schedules/today', async (req, res) => {
  const { doctorId } = req.query;

  if (!doctorId) {
    return res.status(400).json({ message: 'doctorId jest wymagany' });
  }

  try {
    const connection = await getConnection();
    const query = `
      SELECT COUNT(*) AS count
      FROM schedules
      WHERE doctor_id = ? AND DATE(start_time) = CURDATE()
    `;
    const [rows] = await connection.execute(query, [doctorId]);
    connection.end();

    res.status(200).json({ count: rows[0].count });
  } catch (error) {
    logger.error('Błąd pobierania dzisiejszych wizyt:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Dodawanie terminu
app.post('/api/schedules', async (req, res) => {
  const { doctorId, patientId, start, end, clinicId } = req.body;

  if (!doctorId || !patientId || !start || !clinicId) {
    return res.status(400).json({ message: 'Wymagane: doctorId, patientId, start, clinicId' });
  }

  let endTime = end;
  if (!endTime) {
    const startDate = new Date(start);
    const endDate = new Date(startDate.getTime() + 30 * 60000);
    endTime = endDate.toISOString().slice(0, 19).replace('T', ' ');
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
      SELECT s.*,
             p.firstName AS patientFirstName,
             p.lastName AS patientLastName,
             p.pesel AS patientPesel,
             c.name AS clinicName
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
      const [clinicRows] = await connection.execute(
        'SELECT clinic_id FROM doctor_clinics WHERE doctor_id = ?',
        [doctorId]
      );

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

    const events = rows.map((sch) => ({
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

//Pacjenci
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
      `INSERT INTO patients (firstName, lastName, pesel, gender_id, nationality_id, phone,
        addressResidence_id, addressRegistration_id)
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

//Poradnie
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

// Pobieranie lekarzy przypisanych do poradni
app.get('/api/clinics/:id/doctors', async (req, res) => {
  const id = req.params.id;
  try {
    const connection = await getConnection();
    const [doctors] = await connection.execute(
      `
      SELECT u.id, u.firstName, u.lastName
      FROM doctor_clinics dc
      JOIN users u ON dc.doctor_id = u.id
      WHERE dc.clinic_id = ?
    `,
      [id]
    );
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

//Konfiguracja logów
// Odczyt konfiguracji systemu
app.get('/api/system-config', async (req, res) => {
  try {
    if (!fs.existsSync(configFilePath)) {
      return res.status(404).json({ message: 'Plik konfiguracji nie został znaleziony.' });
    }

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

// Aktualizacja konfiguracji systemu
app.put('/api/system-config', async (req, res) => {
  try {
    const newConfig = req.body; // Zakładamy, że ciało żądania zawiera nową konfigurację jako JSON

    if (typeof newConfig !== 'object' || Array.isArray(newConfig) || newConfig === null) {
      return res.status(400).json({ message: 'Nieprawidłowy format danych konfiguracji.' });
    }

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

// Podgląd logów systemowych
app.get('/api/system-logs', async (req, res) => {
  try {
    const logFilePath = path.join(__dirname, 'logs', 'system.log');

    if (!fs.existsSync(logFilePath)) {
      return res.status(404).json({ message: 'Plik logów nie został znaleziony.' });
    }

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

//Strony statyczne 
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



app.get('/api/permissions', async (req, res) => {
  try {
    const connection = await getConnection();
    const [permissions] = await connection.query('SELECT * FROM permissions');
    connection.end();
    res.status(200).json(permissions);
  } catch (error) {
    logger.error('Błąd pobierania uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/permissions', async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa uprawnienia jest wymagana' });
  }
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO permissions (name, description) VALUES (?, ?)',
      [name, description || '']
    );
    connection.end();
    logger.info(`Dodano nowe uprawnienie: ${name}.`);
    res.status(201).json({ message: 'Dodano uprawnienie', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania uprawnienia:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/permissions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    const [rows] = await connection.execute('SELECT * FROM permissions WHERE id = ?', [id]);
    connection.end();
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono uprawnienia' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    logger.error('Błąd pobierania szczegółów uprawnienia:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.put('/api/permissions/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa uprawnienia jest wymagana' });
  }
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE permissions SET name = ?, description = ? WHERE id = ?',
      [name, description || '', id]
    );
    connection.end();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nie znaleziono uprawnienia' });
    }
    logger.info(`Zaktualizowano uprawnienie ID ${id}.`);
    res.status(200).json({ message: 'Uprawnienie zaktualizowane' });
  } catch (error) {
    logger.error('Błąd aktualizacji uprawnienia:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.delete('/api/permissions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    const [result] = await connection.execute('DELETE FROM permissions WHERE id = ?', [id]);
    connection.end();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nie znaleziono uprawnienia' });
    }
    logger.info(`Usunięto uprawnienie ID ${id}.`);
    res.status(200).json({ message: 'Uprawnienie zostało usunięte' });
  } catch (error) {
    logger.error('Błąd usuwania uprawnienia:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});


app.get('/api/permission-groups', async (req, res) => {
  try {
    const connection = await getConnection();
    const [groups] = await connection.query('SELECT * FROM permission_groups');
    connection.end();
    res.status(200).json(groups);
  } catch (error) {
    logger.error('Błąd pobierania grup uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/permission-groups', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa grupy jest wymagana' });
  }
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'INSERT INTO permission_groups (name) VALUES (?)',
      [name]
    );
    connection.end();
    logger.info(`Dodano nową grupę uprawnień: ${name}.`);
    res.status(201).json({ message: 'Dodano grupę uprawnień', id: result.insertId });
  } catch (error) {
    logger.error('Błąd dodawania grupy uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.get('/api/permission-groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    const [groups] = await connection.execute('SELECT * FROM permission_groups WHERE id = ?', [id]);
    if (groups.length === 0) {
      connection.end();
      return res.status(404).json({ message: 'Nie znaleziono grupy' });
    }

    // pobierz listę uprawnień przypisanych do tej grupy
    const [perms] = await connection.execute(
      `SELECT p.*
       FROM permission_group_permissions pgp
       JOIN permissions p ON pgp.permission_id = p.id
       WHERE pgp.group_id = ?`,
      [id]
    );

    connection.end();
    res.status(200).json({
      id: groups[0].id,
      name: groups[0].name,
      permissions: perms,
    });
  } catch (error) {
    logger.error('Błąd pobierania grupy uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.put('/api/permission-groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Nazwa grupy jest wymagana' });
  }
  try {
    const connection = await getConnection();
    const [result] = await connection.execute(
      'UPDATE permission_groups SET name = ? WHERE id = ?',
      [name, id]
    );
    connection.end();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nie znaleziono grupy' });
    }
    logger.info(`Zaktualizowano grupę uprawnień ID ${id}.`);
    res.status(200).json({ message: 'Grupa zaktualizowana' });
  } catch (error) {
    logger.error('Błąd aktualizacji grupy uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.delete('/api/permission-groups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();
    // Najpierw usuń powiązania
    await connection.execute('DELETE FROM permission_group_permissions WHERE group_id = ?', [id]);

    // Następnie usuń samą grupę
    const [result] = await connection.execute('DELETE FROM permission_groups WHERE id = ?', [id]);
    connection.end();
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nie znaleziono grupy' });
    }
    logger.info(`Usunięto grupę uprawnień ID ${id}.`);
    res.status(200).json({ message: 'Grupa uprawnień została usunięta' });
  } catch (error) {
    logger.error('Błąd usuwania grupy uprawnień:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Przypisywanie uprawnień do grupy (nadpisywanie listy)
app.post('/api/permission-groups/:id/permissions', async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body; // Tablica ID uprawnień
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'Oczekiwano tablicy ID uprawnień' });
  }
  try {
    const connection = await getConnection();

    // Czy istnieje taka grupa?
    const [gr] = await connection.execute('SELECT id FROM permission_groups WHERE id = ?', [id]);
    if (gr.length === 0) {
      connection.end();
      return res.status(404).json({ message: 'Nie znaleziono grupy' });
    }

    // Usuń poprzednie powiązania
    await connection.execute('DELETE FROM permission_group_permissions WHERE group_id = ?', [id]);

    // Dodaj nowe
    for (const permId of permissions) {
      await connection.execute(
        'INSERT INTO permission_group_permissions (group_id, permission_id) VALUES (?, ?)',
        [id, permId]
      );
    }
    connection.end();
    logger.info(`Zaktualizowano uprawnienia grupy ID ${id}.`);
    res.status(200).json({ message: 'Zaktualizowano uprawnienia w grupie' });
  } catch (error) {
    logger.error('Błąd przypisywania uprawnień do grupy:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});


app.get('/api/users/:id/all-permissions', async (req, res) => {
  const { id } = req.params;
  try {
    const connection = await getConnection();

    // Pojedyncze uprawnienia usera
    const [userPerms] = await connection.execute(
      `SELECT p.*
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = ?`,
      [id]
    );

    // Grupy uprawnień usera
    const [userGroups] = await connection.execute(
      `SELECT g.*
       FROM user_permission_groups ug
       JOIN permission_groups g ON ug.group_id = g.id
       WHERE ug.user_id = ?`,
      [id]
    );

    connection.end();
    res.status(200).json({
      permissions: userPerms,
      groups: userGroups,
    });
  } catch (error) {
    logger.error('Błąd pobierania uprawnień użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Nadpisanie wszystkich uprawnień i grup użytkownika
app.post('/api/users/:id/all-permissions', async (req, res) => {
  const { id } = req.params;
  const { permissions, groups } = req.body; 
  // Oczekujemy np. { permissions: [1,2], groups: [3] }

  if (!Array.isArray(permissions) || !Array.isArray(groups)) {
    return res.status(400).json({ message: 'Pole permissions i/lub groups musi być tablicą' });
  }

  try {
    const connection = await getConnection();

    // Czy istnieje taki user?
    const [usr] = await connection.execute('SELECT id FROM users WHERE id = ?', [id]);
    if (usr.length === 0) {
      connection.end();
      return res.status(404).json({ message: 'Nie znaleziono użytkownika' });
    }

    // Usuń poprzednie powiązania
    await connection.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    await connection.execute('DELETE FROM user_permission_groups WHERE user_id = ?', [id]);

    // Dodaj nowe pojedyncze uprawnienia
    for (const permId of permissions) {
      await connection.execute(
        'INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)',
        [id, permId]
      );
    }

    // Dodaj nowe grupy
    for (const grpId of groups) {
      await connection.execute(
        'INSERT INTO user_permission_groups (user_id, group_id) VALUES (?, ?)',
        [id, grpId]
      );
    }

    connection.end();
    logger.info(`Zaktualizowano uprawnienia/grupy użytkownika ID ${id}.`);
    res.status(200).json({ message: 'Zaktualizowano uprawnienia użytkownika' });
  } catch (error) {
    logger.error('Błąd przypisywania uprawnień/grup do użytkownika:', error);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

//Uruchomienie serwera 
app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});

module.exports = app;
