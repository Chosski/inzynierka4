document.addEventListener('DOMContentLoaded', async () => {
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('Musisz być zalogowany, aby uzyskać dostęp do tej strony.');
    window.location.href = 'index.html';
  }

  // Referencje do linków/nawigacji
  const adminPanelLink = document.getElementById('admin-panel');
  const receptionScheduleLink = document.getElementById('reception-schedule');
  const doctorScheduleLink = document.getElementById('doctor-schedule');
  const receptionButton = document.getElementById('reception-button');

  // Funkcja wylogowania
  function logout() {
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  }
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  if (receptionButton) {
    receptionButton.addEventListener('click', () => {
      window.location.href = 'reception.html';
    });
  }
  if (adminPanelLink) {
    adminPanelLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'admin.html';
    });
  }
  if (receptionScheduleLink) {
    receptionScheduleLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'schedule.html';
    });
  }
  if (doctorScheduleLink) {
    doctorScheduleLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'doctor.html';
    });
  }

  // Pobranie imienia i nazwiska
  let userFirstName = '';
  let userLastName = '';
  try {
    const resp = await fetch(`/api/users/${userId}`);
    if (resp.ok) {
      const userData = await resp.json();
      userFirstName = userData.firstName || '';
      userLastName = userData.lastName || '';
    }
  } catch (err) {
    console.error('Błąd podczas pobierania danych użytkownika:', err);
  }

  // Wyświetl w #user-login-span
  const userLoginSpan = document.getElementById('user-login-span');
  if (userLoginSpan) {
    const fullName = `${userFirstName} ${userLastName}`.trim();
    userLoginSpan.textContent = fullName || 'Użytkowniku';
  }

  // Data i godzina
  function updateDateTime() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
      const now = new Date();
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      dateElement.textContent = `Dziś jest: ${now.toLocaleDateString('pl-PL', options)}`;
    }
  }
  updateDateTime();
  setInterval(updateDateTime, 30000);

  // Sprawdź grupy usera
  let userGroups = [];
  try {
    const resp = await fetch(`/api/users/${userId}/all-permissions`);
    if (resp.ok) {
      const data = await resp.json();
      userGroups = data.groups || [];
    }
  } catch (err) {
    console.error('Błąd pobierania uprawnień/grup użytkownika:', err);
  }

  // Zmienna do sprawdzenia, czy user jest "doctor" czy "admin" itp.
  const isDoctor = userGroups.some(g => g.name === 'doctor');
  const isAdmin  = userGroups.some(g => g.name === 'admin');

  // Referencje do kafli
  const tileUsers   = document.querySelector('.tile:nth-of-type(1)'); // Liczba użytkowników
  const tileClinics = document.querySelector('.tile:nth-of-type(2)'); // Liczba poradni
  const tileVisits  = document.querySelector('.tile:nth-of-type(3)'); // Wizyty (dziś)
  const tileSystem  = document.querySelector('.tile:nth-of-type(4)'); // Status systemu

  // Domyślnie ukrywamy wszystkie
  if (tileUsers)   tileUsers.style.display = 'none';
  if (tileClinics) tileClinics.style.display = 'none';
  if (tileVisits)  tileVisits.style.display = 'none';
  if (tileSystem)  tileSystem.style.display = 'none';

  // 1) Administrator: widzi liczbę użytkowników, liczbę poradni i status systemu
  if (isAdmin) {
    if (tileUsers)   tileUsers.style.display = 'block';
    if (tileClinics) tileClinics.style.display = 'block';
    if (tileSystem)  tileSystem.style.display = 'block';
    // (opcjonalnie załaduj fetch /api/users i /api/clinics aby wypełnić #users-count, #clinics-count)

    // Ewentualnie, jeśli chcesz żeby admin też widział liczbę wizyt jak lekarz, to odkomentuj:
    // if (tileVisits) tileVisits.style.display = 'block';
    // i zrób fetch `/api/schedules/today?doctorId=...` o ile ma sens

    // Załaduj liczbę users
    try {
      const respUsers = await fetch('/api/users');
      if (respUsers.ok) {
        const allUsers = await respUsers.json();
        document.getElementById('users-count').textContent = allUsers.length;
      }
    } catch (e) {
      console.error('Błąd pobierania liczby użytkowników:', e);
    }

    // Załaduj liczbę clinics
    try {
      const respClinics = await fetch('/api/clinics');
      if (respClinics.ok) {
        const allClinics = await respClinics.json();
        document.getElementById('clinics-count').textContent = allClinics.length;
      }
    } catch (e) {
      console.error('Błąd pobierania liczby poradni:', e);
    }
  }
  // 2) Lekarz: widzi tylko dzisiejsze wizyty (3) i status systemu (4)
  else if (isDoctor) {
    if (tileVisits)  tileVisits.style.display = 'block';
    if (tileSystem)  tileSystem.style.display = 'block';

    // Pobierz liczbę dzisiejszych wizyt
    try {
      const res = await fetch(`/api/schedules/today?doctorId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        document.getElementById('todays-schedules').textContent = data.count;
      } else {
        document.getElementById('todays-schedules').textContent = 'Błąd!';
      }
    } catch (err) {
      console.error('Błąd pobierania dzisiejszych wizyt:', err);
      document.getElementById('todays-schedules').textContent = 'Błąd!';
    }
  }
  // 3) Wszyscy inni (reception, itp.): widzą tylko panel statusu systemu
  else {
    if (tileSystem) tileSystem.style.display = 'block';
  }
});
