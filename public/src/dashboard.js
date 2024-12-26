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
