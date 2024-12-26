// schedule.js

document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin' && userRole !== 'reception') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  const backButton = document.getElementById('back-to-dashboard');
  const logoutButton = document.getElementById('logout-button');
  const clinicSelect = document.getElementById('clinic-select');
  const doctorSelect = document.getElementById('doctor-select');
  const loadCalendarButton = document.getElementById('load-calendar-button');

  let calendar = null;
  let selectedClinicId = null;
  let selectedDoctorId = null;

  backButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    window.location.href = 'index.html';
  });

  async function loadClinics() {
    try {
      const response = await fetch('/api/clinics');
      if (response.ok) {
        const clinics = await response.json();
        clinicSelect.innerHTML = '<option value="">Wybierz Poradnię</option>';
        clinics.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          clinicSelect.appendChild(opt);
        });
      } else {
        alert('Błąd podczas pobierania listy poradni.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania poradni:', error);
    }
  }

  clinicSelect.addEventListener('change', async () => {
    selectedClinicId = clinicSelect.value;
    if (!selectedClinicId) {
      doctorSelect.innerHTML = '<option value="">Najpierw wybierz poradnię</option>';
      return;
    }

    try {
      const response = await fetch(`/api/doctors?clinicId=${selectedClinicId}`);
      if (response.ok) {
        const doctors = await response.json();
        doctorSelect.innerHTML = '<option value="">Wybierz Lekarza</option>';
        doctors.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `${d.firstName} ${d.lastName}`;
          doctorSelect.appendChild(opt);
        });
      } else {
        alert('Błąd podczas pobierania lekarzy.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania lekarzy:', error);
    }
  });

  loadCalendarButton.addEventListener('click', () => {
    selectedClinicId = clinicSelect.value;
    selectedDoctorId = doctorSelect.value;

    if (!selectedClinicId || !selectedDoctorId) {
      alert('Wybierz poradnię i lekarza aby załadować terminarz.');
      return;
    }

    loadCalendar(selectedClinicId, selectedDoctorId);
  });

  let selectedDate = null;

  // Modal pacjentów
  const patientModal = document.getElementById('patient-modal');
  const closePatientModalButton = document.getElementById('close-patient-modal');
  const patientSearchInput = document.getElementById('patient-search-input');
  const patientSearchButton = document.getElementById('patient-search-button');
  const patientList = document.getElementById('patient-list');

  function openPatientModal(dateStr) {
    selectedDate = dateStr;
    patientModal.style.display = 'block';
    loadPatients();
  }

  function closePatientModal() {
    patientModal.style.display = 'none';
    patientList.innerHTML = '';
    patientSearchInput.value = '';
  }

  closePatientModalButton.addEventListener('click', closePatientModal);

  window.addEventListener('click', (event) => {
    if (event.target == patientModal) {
      closePatientModal();
    }
  });

  patientSearchButton.addEventListener('click', () => {
    const search = patientSearchInput.value.trim();
    loadPatients(search);
  });

  async function loadPatients(searchQuery = '') {
    let url = '/api/patients';
    if (searchQuery) {
      url += `?search=${encodeURIComponent(searchQuery)}`;
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        const patients = await response.json();
        renderPatientList(patients);
      } else {
        alert('Błąd podczas pobierania listy pacjentów.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania pacjentów:', error);
    }
  }

  function renderPatientList(patients) {
    patientList.innerHTML = '';
    if (patients.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak pacjentów do wyświetlenia.';
      patientList.appendChild(li);
      return;
    }
    patients.forEach(p => {
      const li = document.createElement('li');
      li.textContent = `${p.firstName} ${p.lastName} (PESEL: ${p.pesel})`;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        addEventToCalendar(p);
      });
      patientList.appendChild(li);
    });
  }

  async function addEventToCalendar(patient) {
    // Domyślnie 30 minut wizyty
    const startDate = new Date(selectedDate);
    const endDate = new Date(startDate.getTime() + 30*60000);
    const endStr = endDate.toISOString().slice(0,19).replace('T',' ');

    const newEvent = {
      title: `${patient.firstName} ${patient.lastName} (PESEL: ${patient.pesel})`,
      start: selectedDate,
      end: endStr,
      doctorId: selectedDoctorId,
      patientId: patient.id,
      clinicId: selectedClinicId
    };

    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      });

      if (response.ok) {
        alert('Termin został dodany.');
        closePatientModal();
        calendar.refetchEvents();
      } else {
        const errorData = await response.json();
        alert(`Błąd podczas dodawania terminu: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas dodawania terminu:', error);
    }
  }

  // Modal edycji terminu
  const eventModal = document.createElement('div');
  eventModal.className = 'modal';
  eventModal.style.display = 'none';
  eventModal.innerHTML = `
    <div class="modal-content">
      <span class="close-button" id="close-event-modal">&times;</span>
      <h2>Edytuj Termin</h2>
      <div class="form-group">
        <label>Pacjent:</label>
        <p id="event-patient-data"></p>
      </div>
      <div class="form-group">
        <label for="event-start">Początek (data i godzina):</label>
        <input type="datetime-local" id="event-start">
      </div>
      <div class="form-group">
        <label for="event-end">Koniec (data i godzina):</label>
        <input type="datetime-local" id="event-end">
      </div>
      <button id="save-event-button">Zapisz zmiany</button>
    </div>
  `;
  document.body.appendChild(eventModal);

  const closeEventModalButton = document.getElementById('close-event-modal');
  const saveEventButton = document.getElementById('save-event-button');
  const eventPatientData = document.getElementById('event-patient-data');
  const eventStartInput = document.getElementById('event-start');
  const eventEndInput = document.getElementById('event-end');

  let currentEvent = null;

  closeEventModalButton.addEventListener('click', closeEventModal);
  window.addEventListener('click', (event) => {
    if (event.target == eventModal) {
      closeEventModal();
    }
  });

  function closeEventModal() {
    eventModal.style.display = 'none';
    currentEvent = null;
  }

  saveEventButton.addEventListener('click', async () => {
    if (!currentEvent) return;

    const startVal = eventStartInput.value;
    const endVal = eventEndInput.value;

    if (!startVal || !endVal) {
      alert('Wprowadź daty początkowe i końcowe.');
      return;
    }

    // Zamiana datetime-local na format YYYY-MM-DD HH:MM:SS
    const startISO = new Date(startVal).toISOString().slice(0,19).replace('T',' ');
    const endISO = new Date(endVal).toISOString().slice(0,19).replace('T',' ');

    try {
      const response = await fetch(`/api/schedules/${currentEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startISO, end: endISO }),
      });
      if (response.ok) {
        alert('Zaktualizowano termin.');
        closeEventModal();
        calendar.refetchEvents();
      } else {
        const errorData = await response.json();
        alert(`Błąd aktualizacji terminu: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd aktualizacji terminu:', error);
    }
  });

  function loadCalendar(clinicId, doctorId) {
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
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      events: `/api/schedules?doctorId=${doctorId}&clinicId=${clinicId}`,
      dateClick: function(info) {
        openPatientModal(info.dateStr);
      },
      eventClick: function(info) {
        currentEvent = info.event;
        // Ustaw dane do edycji
        const { patientFirstName, patientLastName, patientPesel } = currentEvent.extendedProps;
        eventPatientData.textContent = `${patientFirstName} ${patientLastName} (PESEL: ${patientPesel})`;

        // Format datetime dla input
        const startLocal = new Date(currentEvent.start).toISOString().slice(0,16);
        eventStartInput.value = startLocal;

        const endLocal = currentEvent.end ? new Date(currentEvent.end).toISOString().slice(0,16) : startLocal;
        eventEndInput.value = endLocal;

        eventModal.style.display = 'block';
      },
      eventDrop: async function(info) {
        // Zmiana terminu przez przeciągnięcie
        await updateEventDates(info.event);
      },
      eventResize: async function(info) {
        // Zmiana czasu trwania przez rozszerzanie
        await updateEventDates(info.event);
      },
      eventColor: '#378006',
    });

    calendar.render();
  }

  async function updateEventDates(event) {
    const startISO = event.start.toISOString().slice(0,19).replace('T',' ');
    const endISO = event.end ? event.end.toISOString().slice(0,19).replace('T',' ') : startISO;

    try {
      const response = await fetch(`/api/schedules/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startISO, end: endISO }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        alert(`Błąd aktualizacji terminu: ${errorData.message}`);
        event.revert();
      }
    } catch (error) {
      console.error('Błąd aktualizacji terminu:', error);
      event.revert();
    }
  }

  loadClinics();
});
