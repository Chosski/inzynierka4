document.addEventListener('DOMContentLoaded', () => {
  // Pobierz rolę i login użytkownika z localStorage
  const userRole = localStorage.getItem('userRole');
  const userLogin = localStorage.getItem('userLogin');

  if (!userRole || !userLogin) {
    // Jeśli brak danych użytkownika, przekieruj na stronę logowania
    window.location.href = 'index.html';
    return;
  }

  // Pobierz elementy nawigacji
  const adminPanelLink = document.getElementById('admin-panel');
  const receptionScheduleLink = document.getElementById('reception-schedule');
  const doctorScheduleLink = document.getElementById('doctor-schedule');
  const receptionButton = document.getElementById('reception-button');

  // Kontroluj dostęp do modułów na podstawie roli
  if (userRole === 'admin') {
    // Administrator ma dostęp do wszystkich modułów
  } else if (userRole === 'registration') {
    adminPanelLink.style.display = 'none';
    doctorScheduleLink.style.display = 'none';
  } else if (userRole === 'doctor') {
    adminPanelLink.style.display = 'none';
    receptionScheduleLink.style.display = 'none';
  } else {
    // Nieznana rola – wyloguj użytkownika
    logout();
  }

 // Wyświetl login użytkownika
  const userLoginSpan = document.getElementById('user-login-span');
  if (userLoginSpan) {
    userLoginSpan.textContent = userLogin;
  }

  // Wyświetl datę i godzinę
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
        minute: '2-digit' 
      };
      dateElement.textContent = `Dziś jest: ${now.toLocaleDateString('pl-PL', options)}`;
    }
  }
  updateDateTime();
  setInterval(updateDateTime, 30000);

  // Pobierz liczbę dzisiejszych wizyt
  async function loadTodaySchedules() {
    if (userRole === 'doctor') {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      try {
        const res = await fetch(`/api/schedules?doctorId=${userId}&date=${today}`);
        if (res.ok) {
          const schedules = await res.json();
          document.getElementById('todays-schedules').textContent = schedules.length;
        } else {
          document.getElementById('todays-schedules').textContent = 'Błąd!';
        }
      } catch (err) {
        console.error('Błąd pobierania dzisiejszych wizyt:', err);
        document.getElementById('todays-schedules').textContent = 'Błąd!';
      }
    } else {
      document.querySelector('.tile').style.display = 'none'; // Ukryj kafel, jeśli nie lekarz
    }
  }
  loadTodaySchedules();
});
  
  // Dodaj obsługę kliknięć w linki
  adminPanelLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'admin.html';
  });

  receptionScheduleLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'schedule.html';
  });

  doctorScheduleLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Przekierowujemy do widoku doktora
    window.location.href = 'doctor.html';
  });

  // Obsługa wylogowania
  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', logout);

  function logout() {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId'); // na wszelki wypadek usuwamy również userId
    window.location.href = 'index.html';
  }

  if (receptionButton) {
    receptionButton.addEventListener('click', () => {
      window.location.href = 'reception.html';
    });
  }

  
});
