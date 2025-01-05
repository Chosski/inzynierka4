document.addEventListener('DOMContentLoaded', async () => {
  // Sprawdź, czy userId w localStorage istnieje
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('Musisz być zalogowany, aby uzyskać dostęp do tej strony.');
    window.location.href = 'index.html';
    return;
  }

  // Referencje do linków / przycisków
  const adminPanelLink = document.getElementById('admin-panel');
  const receptionScheduleLink = document.getElementById('reception-schedule');
  const doctorScheduleLink = document.getElementById('doctor-schedule');
  const receptionButton = document.getElementById('reception-button');
  const logoutButton = document.getElementById('logout-button');

  // Funkcja wylogowania
  function logout() {
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  }

  // Obsługa kliknięcia logout
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  // Linki w nawigacji
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

  // Pobierz dane użytkownika (imię i nazwisko)
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

  // Wyświetlenie w #user-login-span
  const userLoginSpan = document.getElementById('user-login-span');
  if (userLoginSpan) {
    const fullName = `${userFirstName} ${userLastName}`.trim();
    userLoginSpan.textContent = fullName || 'Użytkowniku';
  }

  // Wyświetlanie daty i godziny
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

  // Sprawdzenie grup użytkownika
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

  // Czy user jest admin, czy doctor, itp.
  const isAdmin = userGroups.some(g => g.name === 'admin');
  const isDoctor = userGroups.some(g => g.name === 'doctor');
  // (Jeśli potrzebujesz, możesz sprawdzić też 'reception' itp.)

  // Referencje do kafli
  const tileUsers   = document.querySelector('.tile:nth-of-type(1)'); // Liczba użytkowników
  const tileClinics = document.querySelector('.tile:nth-of-type(2)'); // Liczba poradni
  const tileVisits  = document.querySelector('.tile:nth-of-type(3)'); // Wizyty (dziś)
  const tileSystem  = document.querySelector('.tile:nth-of-type(4)'); // Status systemu

  // Domyślnie ukryj wszystkie kafle
  if (tileUsers)   tileUsers.style.display = 'none';
  if (tileClinics) tileClinics.style.display = 'none';
  if (tileVisits)  tileVisits.style.display = 'none';
  if (tileSystem)  tileSystem.style.display = 'none';

  // Logika widoczności kafli:
  // 1) Admin widzi kafle 1,2,4 (ew. 3 też, jeśli chcesz)
  if (isAdmin) {
    if (tileUsers)   tileUsers.style.display = 'block';
    if (tileClinics) tileClinics.style.display = 'block';
    if (tileSystem)  tileSystem.style.display = 'block';

    // Pobranie liczby userów
    try {
      const respUsers = await fetch('/api/users');
      if (respUsers.ok) {
        const allUsers = await respUsers.json();
        document.getElementById('users-count').textContent = allUsers.length;
      }
    } catch (e) {
      console.error('Błąd pobierania listy użytkowników:', e);
    }

    // Pobranie liczby poradni
    try {
      const respClinics = await fetch('/api/clinics');
      if (respClinics.ok) {
        const allClinics = await respClinics.json();
        document.getElementById('clinics-count').textContent = allClinics.length;
      }
    } catch (e) {
      console.error('Błąd pobierania listy poradni:', e);
    }

    // (Jeśli chcesz też wczytać liczbę wizyt: 
    //   tileVisits.style.display = 'block'; 
    //   fetch /api/schedules/today?doctorId=..., itp.)
  }
  // 2) Doktor widzi kafle (3) wizyty dziś i (4) status
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
  // 3) Każdy inny (np. reception) widzi tylko kafel (4) status systemu
  else {
    if (tileSystem) tileSystem.style.display = 'block';
  }
});
