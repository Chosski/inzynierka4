// registration.js

document.addEventListener('DOMContentLoaded', () => {
  // Sprawdzenie roli użytkownika
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'registration' && userRole !== 'admin') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  // Obsługa przycisku "Powrót do Menu Głównego"
  const backButton = document.getElementById('back-to-dashboard');
  backButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  // Obsługa wylogowania
  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    window.location.href = 'index.html';
  });

  const addPatientForm = document.getElementById('add-patient-form');
  const patientList = document.getElementById('patient-list');

  // Funkcja do dodawania pacjenta
  addPatientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('patient-first-name').value;
    const lastName = document.getElementById('patient-last-name').value;
    const pesel = document.getElementById('patient-pesel').value;

    // Walidacja PESEL
    if (!/^\d{11}$/.test(pesel)) {
      alert('Nieprawidłowy PESEL.');
      return;
    }

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, pesel }),
      });

      if (response.ok) {
        alert('Dodano nowego pacjenta.');
        addPatientForm.reset();
        loadPatients();
      } else {
        const errorData = await response.json();
        alert(`Błąd podczas dodawania pacjenta: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas dodawania pacjenta:', error);
    }
  });

  // Funkcja do załadowania listy pacjentów
  async function loadPatients() {
    try {
      const response = await fetch('/api/patients');
      const patients = await response.json();

      patientList.innerHTML = `
        <tr>
          <th>Imię</th>
          <th>Nazwisko</th>
          <th>PESEL</th>
          <th>Akcje</th>
        </tr>
      `;

      patients.forEach((patient) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${patient.firstName}</td>
          <td>${patient.lastName}</td>
          <td>${patient.pesel}</td>
          <td>
            <button class="btn-delete" data-id="${patient.id}">Usuń</button>
          </td>
        `;
        patientList.appendChild(row);
      });

      // Obsługa przycisków "Usuń"
      document.querySelectorAll('.btn-delete').forEach((button) => {
        button.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          await deletePatient(id);
          loadPatients();
        });
      });
    } catch (error) {
      console.error('Błąd podczas ładowania pacjentów:', error);
    }
  }

  // Funkcja do usuwania pacjenta
  async function deletePatient(id) {
    if (confirm('Czy na pewno chcesz usunąć tego pacjenta?')) {
      try {
        const response = await fetch(`/api/patients/${id}`, { method: 'DELETE' });
        if (response.ok) {
          alert('Pacjent został usunięty.');
        } else {
          const errorData = await response.json();
          alert(`Błąd podczas usuwania pacjenta: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas usuwania pacjenta:', error);
      }
    }
  }

  // Załaduj listę pacjentów przy starcie
  loadPatients();
});
