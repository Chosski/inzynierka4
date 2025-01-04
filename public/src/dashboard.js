document.addEventListener('DOMContentLoaded', async () => {
  // Pobierz rolę, login oraz ID użytkownika z localStorage
  const userRole = localStorage.getItem('userRole');
  const userLogin = localStorage.getItem('userLogin');
  const userId = localStorage.getItem('userId');

  // Jeśli brak danych użytkownika, przekieruj na stronę logowania
  if (!userRole || !userLogin || !userId) {
    window.location.href = 'index.html';
    return;
  }

  // Elementy nawigacji
  const adminPanelLink = document.getElementById('admin-panel');
  const receptionScheduleLink = document.getElementById('reception-schedule');
  const doctorScheduleLink = document.getElementById('doctor-schedule');
  const receptionButton = document.getElementById('reception-button');

  // Funkcja wylogowania
  function logout() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  }

  // Przycisk wylogowania
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  // Przycisk do ewidencji pacjentów
  if (receptionButton) {
    receptionButton.addEventListener('click', () => {
      window.location.href = 'reception.html';
    });
  }

  // Obsługa linków panelu administratora / rejestracji / lekarza
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

  // Asynchroniczne pobranie danych użytkownika (imię, nazwisko) z bazy
  let userFirstName = '';
  let userLastName = '';

  try {
    const response = await fetch(`/api/users/${userId}`);
    if (response.ok) {
      const userData = await response.json();
      userFirstName = userData.firstName || '';
      userLastName = userData.lastName || '';
    }
  } catch (err) {
    console.error('Błąd podczas pobierania danych użytkownika:', err);
  }

  // Wyświetl imię i nazwisko w powitaniu
  const userLoginSpan = document.getElementById('user-login-span');
  if (userLoginSpan) {
    userLoginSpan.textContent = `${userFirstName} ${userLastName}`.trim() || userLogin;
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

  // Pobranie i wyświetlenie liczby dzisiejszych wizyt (tylko dla roli lekarz)
  async function loadTodaySchedules() {
    // Elementy kafli
    const tileUsers = document.querySelector('.tile:nth-of-type(1)');   // Liczba użytkowników
    const tileClinics = document.querySelector('.tile:nth-of-type(2)'); // Liczba poradni
    const tileVisits = document.querySelector('.tile:nth-of-type(3)');  // Zaplanowane wizyty (dziś)
    const tileSystem = document.querySelector('.tile:nth-of-type(4)');  // Status systemu

    if (userRole === 'doctor') {
      // Pokaż tylko kaflę z wizytami (3) i status systemu (4)
      if (tileUsers) tileUsers.style.display = 'none';
      if (tileClinics) tileClinics.style.display = 'none';
      if (tileVisits) tileVisits.style.display = 'block';
      if (tileSystem) tileSystem.style.display = 'block';

      // Pobierz liczbę wizyt na dziś
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
    } else {
      // Użytkownik nie jest lekarzem
      // Pokaż tylko kaflę ze statusem systemu (4), resztę ukryj
      if (tileUsers) tileUsers.style.display = 'none';
      if (tileClinics) tileClinics.style.display = 'none';
      if (tileVisits) tileVisits.style.display = 'none';
      if (tileSystem) tileSystem.style.display = 'block';
    }
  }
  loadTodaySchedules();
});
