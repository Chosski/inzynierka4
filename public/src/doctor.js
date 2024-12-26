// doctor.js
document.addEventListener('DOMContentLoaded', () => {
  // Tutaj sprawdzenie może być opcjonalne, bo już jest w doctor.html, ale można je zostawić
  const userRole = localStorage.getItem('userRole');
  const userId = localStorage.getItem('userId');

  // Sprawdzenie uprawnień użytkownika (opcjonalne, bo sprawdzamy już w HTML)
  if (userRole !== 'doctor') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  if (!userId) {
    alert('Brak ID lekarza. Zaloguj się ponownie.');
    window.location.href = 'index.html';
    return;
  }

  const backButton = document.getElementById('back-to-dashboard');
  backButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });

  const clinicSelect = document.getElementById('clinic-select');

  async function loadClinicsForDoctor(doctorId) {
    try {
      const response = await fetch(`/api/users/${doctorId}/visible-clinics`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Błąd sieci: ${response.status}`);
      }
      const clinics = await response.json();

      clinicSelect.innerHTML = '<option value="">Wszystkie Poradnie</option>';
      clinics.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        clinicSelect.appendChild(opt);
      });
    } catch (error) {
      console.error('Błąd podczas pobierania przypisanych poradni:', error);
      alert('Nie udało się pobrać przypisanych poradni.');
    }
  }

  let calendar = null;

  function loadCalendar() {
    if (calendar) {
      calendar.destroy();
    }

    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      locale: 'pl',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      },
      editable: false,
      eventStartEditable: false,
      eventDurationEditable: false,
      events: fetchEvents,
      eventColor: '#378006',
    });

    calendar.render();
  }

  function fetchEvents(fetchInfo, successCallback, failureCallback) {
    let url = `/api/schedules?doctorId=${userId}`;
    const selectedClinicId = clinicSelect.value;
    if (selectedClinicId) {
      url += `&clinicId=${selectedClinicId}`;
    }

    fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Błąd sieci: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) {
        throw new Error('Oczekiwano tablicy wydarzeń');
      }
      successCallback(data);
    })
    .catch(error => {
      console.error('Błąd podczas pobierania terminarzy:', error);
      alert('Nie udało się pobrać terminarzy. Spróbuj ponownie później.');
      failureCallback(error);
    });
  }

  clinicSelect.addEventListener('change', () => {
    if (calendar) {
      calendar.refetchEvents();
    }
  });

  loadClinicsForDoctor(userId).then(() => {
    loadCalendar();
  });
});
