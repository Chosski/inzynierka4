// doctor.js

document.addEventListener('DOMContentLoaded', () => {
  // *** NAJWAŻNIEJSZA RZECZ: wczytujemy userId z localStorage ***
  const userId = localStorage.getItem('userId');

  // Walidacja - jeżeli nie mamy userId w localStorage, to przekierowujemy
  if (!userId) {
    alert('Brak ID lekarza. Zaloguj się ponownie.');
    window.location.href = 'index.html';
    return;
  }

  // Przycisk powrotu do dashboard
  const backButton = document.getElementById('back-to-dashboard');
  backButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  // Przycisk wylogowania
  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');   // jeżeli nieużywane, można pominąć
    localStorage.removeItem('userLogin');
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
  });

  // Select do wyboru poradni (widocznej dla lekarza)
  const clinicSelect = document.getElementById('clinic-select');

  // -------------------------------------------------
  // Funkcja ładująca poradnie przypisane do lekarza
  // -------------------------------------------------
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

      // Dodaj opcję "Wszystkie Poradnie"
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

  // Referencja do kalendarza
  let calendar = null;

  // -------------------------------------------------
  // Inicjalizacja kalendarza FullCalendar
  // -------------------------------------------------
  function loadCalendar() {
    // Jeśli mamy już kalendarz, to go najpierw niszczymy, by stworzyć od nowa
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
      editable: false,             // lekarz może mieć uprawnienia do edycji, zależnie od potrzeb
      eventStartEditable: false,
      eventDurationEditable: false,
      events: fetchEvents,         // funkcja fetchEvents pobierze eventy z /api/schedules
      eventColor: '#378006',
    });

    calendar.render();
  }

  // -------------------------------------------------
  // Funkcja pobierająca listę eventów (wizyt) z backendu
  // -------------------------------------------------
  function fetchEvents(fetchInfo, successCallback, failureCallback) {
    // Budujemy endpoint
    let url = `/api/schedules?doctorId=${userId}`;
    const selectedClinicId = clinicSelect.value;
    if (selectedClinicId) {
      url += `&clinicId=${selectedClinicId}`;
    }

    // Wywołanie fetch
    fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) {
        // Np. 404, 500, itp.
        throw new Error(`Błąd sieci: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Powinna to być tablica eventów
      if (!Array.isArray(data)) {
        throw new Error('Oczekiwano tablicy wydarzeń (terminów).');
      }
      // Przekazujemy dane do FullCalendar
      successCallback(data);
    })
    .catch(error => {
      console.error('Błąd podczas pobierania terminarzy:', error);
      alert('Nie udało się pobrać terminarzy. Spróbuj ponownie później.');
      failureCallback(error);
    });
  }

  // Zmiana wartości w select -> odświeżenie listy eventów w kalendarzu
  clinicSelect.addEventListener('change', () => {
    if (calendar) {
      calendar.refetchEvents();
    }
  });

  // Na zakończenie:
  // 1) Ładujemy widoczne poradnie dla tego lekarza
  // 2) Inicjujemy kalendarz
  loadClinicsForDoctor(userId).then(() => {
    loadCalendar();
  });
});
