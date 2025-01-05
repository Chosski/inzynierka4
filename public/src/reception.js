// reception.js

document.addEventListener('DOMContentLoaded', () => {
  // Sprawdzamy, czy istnieje userId w localStorage
  const userId = localStorage.getItem('userId');
  if (!userId) {
    alert('Musisz być zalogowany, aby uzyskać dostęp do tej strony.');
    window.location.href = 'index.html';
    return;
  }

  // Przyciski w nagłówku
  const backButton = document.getElementById('back-to-dashboard');
  const logoutButton = document.getElementById('logout-button');

  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('userRole');   // jeśli nieużywane, można pominąć
      localStorage.removeItem('userLogin');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    });
  }

  // Elementy obsługujące wyszukiwanie pacjentów
  const searchForm = document.getElementById('search-patient-form');
  const searchTypeSelect = document.getElementById('search-type');
  const searchQueryInput = document.getElementById('search-query');
  const resetSearchButton = document.getElementById('reset-search');

  // Przycisk / Modal "Dodaj Pacjenta" (jeśli takowy jest w HTML)
  const addPatientButton = document.getElementById('add-patient-button');
  const patientModal = document.getElementById('patient-modal');
  const patientForm = document.getElementById('patient-form');
  const closePatientModalButton = document.getElementById('close-patient-modal');

  // Tabela z listą pacjentów
  const patientList = document.getElementById('patient-list');

  // -------------------------------------------------
  // Funkcja otwarcia modala "Dodaj Pacjenta"
  // -------------------------------------------------
  function openAddPatientModal() {
    if (!patientModal || !patientForm) return;
    patientModal.style.display = 'block';
    patientForm.reset(); // czyść poprzednie dane
    const modalTitle = document.getElementById('patient-modal-title');
    if (modalTitle) {
      modalTitle.textContent = 'Dodaj Pacjenta';
    }
  }

  // -------------------------------------------------
  // Funkcja zamykająca modal "Dodaj Pacjenta"
  // -------------------------------------------------
  function closePatientModal() {
    if (patientModal) {
      patientModal.style.display = 'none';
    }
  }

  // Nasłuch na przycisk w rogu modala
  if (closePatientModalButton) {
    closePatientModalButton.addEventListener('click', closePatientModal);
  }

  // Klik poza modalem – zamknij modal (opcjonalne)
  window.addEventListener('click', (event) => {
    if (event.target === patientModal) {
      closePatientModal();
    }
  });

  // -------------------------------------------------
  // Klik w "Dodaj Pacjenta" -> otwiera modal
  // -------------------------------------------------
  if (addPatientButton) {
    addPatientButton.addEventListener('click', openAddPatientModal);
  }

  // -------------------------------------------------
  // Funkcja pobierająca listę pacjentów z API
  // (opcjonalnie uwzględnia parametry wyszukiwania)
  // -------------------------------------------------
  async function loadPatients(searchType = '', searchQuery = '') {
    try {
      let url = '/api/patients'; // Endpoint do pobrania pacjentów
      if (searchQuery) {
        // np. backend obsługuje "?search=..." i w nim łączy się firstName/lastName/pesel
        // Ty możesz rozdzielić to logiką "searchType" -> "firstName=..." itd. 
        // Dla uproszczenia łączymy w 1 param: ?search=...
        url += `?search=${encodeURIComponent(searchQuery)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Błąd sieci: ${response.status}`);
      }
      const patients = await response.json();
      renderPatientList(patients);
    } catch (error) {
      console.error('Błąd podczas ładowania pacjentów:', error);
      alert('Nie udało się pobrać listy pacjentów.');
    }
  }

  // -------------------------------------------------
  // Funkcja wyświetlająca listę pacjentów w <table>
  // -------------------------------------------------
  function renderPatientList(patients) {
    if (!patientList) return;

    // Nagłówek
    patientList.innerHTML = `
      <tr>
        <th>Imię</th>
        <th>Nazwisko</th>
        <th>PESEL</th>
        <th>Akcje</th>
      </tr>
    `;

    if (!patients || patients.length === 0) {
      // Brak pacjentów
      const noRow = document.createElement('tr');
      noRow.innerHTML = `
        <td colspan="4">Brak pacjentów do wyświetlenia.</td>
      `;
      patientList.appendChild(noRow);
      return;
    }

    // Wypełnienie danymi
    patients.forEach((pat) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${pat.firstName}</td>
        <td>${pat.lastName}</td>
        <td>${pat.pesel}</td>
        <td>
          <button class="btn-delete" data-id="${pat.id}">Usuń</button>
        </td>
      `;
      patientList.appendChild(row);
    });

    // Obsługa "Usuń"
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        await deletePatient(id);
        loadPatients(); // odśwież listę
      });
    });
  }

  // -------------------------------------------------
  // Funkcja usuwająca pacjenta (po ID)
  // -------------------------------------------------
  async function deletePatient(id) {
    if (!id) return;
    if (!confirm('Czy na pewno chcesz usunąć tego pacjenta?')) return;

    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('Pacjent został usunięty.');
      } else {
        const errorData = await response.json();
        alert(`Błąd podczas usuwania pacjenta: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas usuwania pacjenta:', error);
      alert('Nie udało się usunąć pacjenta.');
    }
  }

  // -------------------------------------------------
  // Obsługa formularza (w modalu) dodawania pacjenta
  // (jeśli w HTML są pola #patient-first-name, #patient-last-name, #patient-pesel, itp.)
  // -------------------------------------------------
  if (patientForm) {
    patientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const firstName = document.getElementById('patient-firstName')?.value.trim() || '';
      const lastName = document.getElementById('patient-lastName')?.value.trim() || '';
      const pesel = document.getElementById('patient-pesel')?.value.trim() || '';

      // Tutaj można by obsłużyć płeć / narodowość / adresy, itp.
      // Tylko minimalny przykład
      if (!/^\d{11}$/.test(pesel)) {
        alert('Nieprawidłowy PESEL (musi mieć 11 cyfr).');
        return;
      }

      try {
        const response = await fetch('/api/patients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            pesel
            // ewentualnie: gender_id, nationality_id, addressResidence, addressRegistration
          }),
        });

        if (response.ok) {
          alert('Dodano nowego pacjenta.');
          closePatientModal();
          loadPatients();
        } else {
          const errorData = await response.json();
          alert(`Błąd podczas dodawania pacjenta: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas dodawania pacjenta:', error);
      }
    });
  }

  // -------------------------------------------------
  // Obsługa wyszukiwania pacjentów
  // -------------------------------------------------
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const searchType = searchTypeSelect.value;  // np. firstName / lastName / pesel
      const searchQuery = searchQueryInput.value.trim();
      // W tym przykładzie nasz backend reaguje tylko na "?search=..."
      // Np. "searchType" można też przesłać, ale w tym uproszczeniu nie robimy tego.
      loadPatients(searchType, searchQuery);
    });
  }

  // Obsługa resetowania wyszukiwania
  if (resetSearchButton) {
    resetSearchButton.addEventListener('click', () => {
      searchQueryInput.value = '';
      loadPatients();
    });
  }

  // -------------------------------------------------
  // Na koniec: Ładujemy listę pacjentów domyślnie
  // -------------------------------------------------
  loadPatients();
});
