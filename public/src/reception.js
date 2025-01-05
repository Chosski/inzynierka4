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
      localStorage.removeItem('userRole');
      localStorage.removeItem('userLogin');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    });
  }

  // Główny przycisk "Dodaj Pacjenta" (otwarcie modala)
  const addPatientButton = document.getElementById('add-patient-button');

  // Modal + formularz w nim
  const patientModal = document.getElementById('patient-modal');
  const patientModalTitle = document.getElementById('patient-modal-title');
  const patientForm = document.getElementById('patient-form');
  const closePatientModalButton = document.getElementById('close-patient-modal');

  // Tabela listy pacjentów
  const patientList = document.getElementById('patient-list');

  // Formularz wyszukiwania
  const searchPatientForm = document.getElementById('search-patient-form');
  const resetSearchBtn = document.getElementById('reset-search');
  const searchTypeSelect = document.getElementById('search-type');
  const searchQueryInput = document.getElementById('search-query');

  // Aktualnie używany parametr wyszukiwania (by odświeżać listę po dodaniu/edycji)
  let currentSearchQuery = '';

  //-----------------------------------------------------
  // 1. Obsługa modala (Dodaj/Edycja Pacjenta)
  //-----------------------------------------------------
  if (addPatientButton) {
    addPatientButton.addEventListener('click', () => {
      openPatientModal(); // otwarcie w trybie dodawania
    });
  }

  function openPatientModal(patient = null) {
    if (!patientModal || !patientForm) return;

    if (patient) {
      // Tryb edycji pacjenta
      patientModalTitle.textContent = 'Edycja Pacjenta';
      document.getElementById('patient-id').value = patient.id;
      document.getElementById('patient-firstName').value = patient.firstName || '';
      document.getElementById('patient-lastName').value = patient.lastName || '';
      document.getElementById('patient-pesel').value = patient.pesel || '';
      document.getElementById('patient-gender').value = patient.gender_id || '';
      document.getElementById('patient-nationality').value = patient.nationality_id || '';
      document.getElementById('patient-phone').value = patient.phone || '';

      // Adres zamieszkania
      if (patient.addressResidence) {
        const ra = patient.addressResidence;
        document.getElementById('residence-country').value = ra.country || '';
        document.getElementById('residence-city').value = ra.city || '';
        document.getElementById('residence-postal_code').value = ra.postal_code || '';
        document.getElementById('residence-street').value = ra.street || '';
        document.getElementById('residence-house_number').value = ra.house_number || '';
        document.getElementById('residence-apartment_number').value = ra.apartment_number || '';
      } else {
        clearResidenceFields();
      }

      // Adres zameldowania
      if (patient.addressRegistration) {
        const rg = patient.addressRegistration;
        document.getElementById('registration-country').value = rg.country || '';
        document.getElementById('registration-city').value = rg.city || '';
        document.getElementById('registration-postal_code').value = rg.postal_code || '';
        document.getElementById('registration-street').value = rg.street || '';
        document.getElementById('registration-house_number').value = rg.house_number || '';
        document.getElementById('registration-apartment_number').value = rg.apartment_number || '';
      } else {
        clearRegistrationFields();
      }

    } else {
      // Tryb dodawania nowego pacjenta
      patientModalTitle.textContent = 'Dodaj Pacjenta';
      patientForm.reset();
      document.getElementById('patient-id').value = '';
      clearResidenceFields();
      clearRegistrationFields();
    }

    patientModal.style.display = 'block';
  }

  function closePatientModal() {
    if (!patientModal || !patientForm) return;
    patientModal.style.display = 'none';
    patientForm.reset();
  }

  if (closePatientModalButton) {
    closePatientModalButton.addEventListener('click', closePatientModal);
  }

  // Kliknięcie w tło modala – zamknięcie (opcjonalne)
  window.addEventListener('click', (event) => {
    if (event.target === patientModal) {
      closePatientModal();
    }
  });

  // Czyszczenie pól adresu zamieszkania
  function clearResidenceFields() {
    document.getElementById('residence-country').value = '';
    document.getElementById('residence-city').value = '';
    document.getElementById('residence-postal_code').value = '';
    document.getElementById('residence-street').value = '';
    document.getElementById('residence-house_number').value = '';
    document.getElementById('residence-apartment_number').value = '';
  }

  // Czyszczenie pól adresu zameldowania
  function clearRegistrationFields() {
    document.getElementById('registration-country').value = '';
    document.getElementById('registration-city').value = '';
    document.getElementById('registration-postal_code').value = '';
    document.getElementById('registration-street').value = '';
    document.getElementById('registration-house_number').value = '';
    document.getElementById('registration-apartment_number').value = '';
  }

  //-----------------------------------------------------
  // 2. Obsługa zapisu (Dodanie/Edycja) pacjenta
  //-----------------------------------------------------
  if (patientForm) {
    patientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const patientId = document.getElementById('patient-id').value.trim();
      const firstName = document.getElementById('patient-firstName').value.trim();
      const lastName = document.getElementById('patient-lastName').value.trim();
      const pesel = document.getElementById('patient-pesel').value.trim();
      const gender_id = document.getElementById('patient-gender').value;
      const nationality_id = document.getElementById('patient-nationality').value;
      const phone = document.getElementById('patient-phone').value.trim();

      // Adresy
      const addressResidence = {
        country: document.getElementById('residence-country').value.trim(),
        city: document.getElementById('residence-city').value.trim(),
        postal_code: document.getElementById('residence-postal_code').value.trim(),
        street: document.getElementById('residence-street').value.trim(),
        house_number: document.getElementById('residence-house_number').value.trim(),
        apartment_number: document.getElementById('residence-apartment_number').value.trim() || null
      };
      const addressRegistration = {
        country: document.getElementById('registration-country').value.trim(),
        city: document.getElementById('registration-city').value.trim(),
        postal_code: document.getElementById('registration-postal_code').value.trim(),
        street: document.getElementById('registration-street').value.trim(),
        house_number: document.getElementById('registration-house_number').value.trim(),
        apartment_number: document.getElementById('registration-apartment_number').value.trim() || null
      };

      // Walidacja PESEL
      if (!/^\d{11}$/.test(pesel)) {
        alert('PESEL musi składać się z 11 cyfr.');
        return;
      }

      // Budujemy obiekt pacjenta
      const patientData = {
        firstName,
        lastName,
        pesel,
        gender_id,
        nationality_id,
        phone,
        addressResidence,
        addressRegistration
      };

      try {
        let response;
        if (patientId) {
          // Edycja pacjenta
          // (zakładamy, że Twój backend ma endpoint PUT /api/patients/:id
          //  lub ewentualnie inny, np. POST /api/patients/:id)
          response = await fetch(`/api/patients/${patientId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData),
          });
        } else {
          // Dodawanie nowego pacjenta
          response = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientData),
          });
        }

        if (response.ok) {
          const message = patientId
            ? 'Dane pacjenta zostały zaktualizowane.'
            : 'Dodano nowego pacjenta.';
          alert(message);
          closePatientModal();
          loadPatients(currentSearchQuery); // odświeżenie listy
        } else {
          const errorData = await response.json();
          alert(`Błąd: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas zapisywania pacjenta:', error);
        alert('Błąd podczas zapisywania pacjenta.');
      }
    });
  }

  //-----------------------------------------------------
  // 3. Obsługa listy pacjentów (render, usuń, itp.)
  //-----------------------------------------------------
  async function loadPatients(query = '') {
    try {
      // Jeżeli query nie jest pusty, to np. "?search=Kowalski"
      const response = await fetch(`/api/patients${query}`);
      if (response.ok) {
        const patients = await response.json();
        renderPatients(patients);
      } else {
        const errorData = await response.json();
        console.error('Błąd podczas pobierania pacjentów:', errorData);
        alert('Błąd podczas pobierania listy pacjentów.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy pacjentów:', error);
      alert('Błąd podczas pobierania listy pacjentów.');
    }
  }

  function renderPatients(patients) {
    if (!patientList) return;

    if (!Array.isArray(patients) || patients.length === 0) {
      // Gdy brak pacjentów
      patientList.innerHTML = `
        <tr>
          <td colspan="6">Brak pacjentów do wyświetlenia.</td>
        </tr>
      `;
      return;
    }

    let tableHeader = `
      <tr>
        <th>Imię</th>
        <th>Nazwisko</th>
        <th>PESEL</th>
        <th>Płeć</th>
        <th>Telefon</th>
        <th>Akcje</th>
      </tr>
    `;

    let tableRows = '';

    patients.forEach((p) => {
      tableRows += `
        <tr>
          <td>${p.firstName}</td>
          <td>${p.lastName}</td>
          <td>${p.pesel}</td>
          <td>${p.genderName || ''}</td>
          <td>${p.phone || ''}</td>
          <td>
            <button class="edit-button" data-patient='${JSON.stringify(p)}'>Edytuj</button>
            <button class="delete-button" data-id="${p.id}">Usuń</button>
          </td>
        </tr>
      `;
    });

    patientList.innerHTML = tableHeader + tableRows;

    // Obsługa "Edytuj"
    document.querySelectorAll('.edit-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const patientData = JSON.parse(e.target.getAttribute('data-patient'));
        openPatientModal(patientData);
      });
    });

    // Obsługa "Usuń"
    document.querySelectorAll('.delete-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const patientId = e.target.getAttribute('data-id');
        if (!patientId) return;
        if (confirm('Czy na pewno chcesz usunąć tego pacjenta?')) {
          try {
            const resp = await fetch(`/api/patients/${patientId}`, {
              method: 'DELETE',
            });
            if (resp.ok) {
              alert('Pacjent został usunięty.');
              loadPatients(currentSearchQuery);
            } else {
              const errData = await resp.json();
              alert(`Błąd podczas usuwania pacjenta: ${errData.message}`);
            }
          } catch (error) {
            console.error('Błąd podczas usuwania pacjenta:', error);
          }
        }
      });
    });
  }

  //-----------------------------------------------------
  // 4. Pobieranie list płci i narodowości (opcjonalne)
  //-----------------------------------------------------
  async function loadGendersAndNationalities() {
    try {
      const [gendersResp, countriesResp] = await Promise.all([
        fetch('/api/genders'),
        fetch('/api/countries')
      ]);

      if (gendersResp.ok && countriesResp.ok) {
        const genders = await gendersResp.json();
        const countries = await countriesResp.json();

        populateSelect('patient-gender', genders);
        populateSelect('patient-nationality', countries);
      } else {
        alert('Błąd podczas ładowania płci lub narodowości.');
      }
    } catch (error) {
      console.error('Błąd pobierania płci/narodowości:', error);
    }
  }

  function populateSelect(selectId, items) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Wybierz...</option>'; // reset
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      sel.appendChild(opt);
    });
  }

  //-----------------------------------------------------
  // 5. Obsługa wyszukiwania
  //-----------------------------------------------------
  if (searchPatientForm) {
    searchPatientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const searchType = searchTypeSelect.value; // firstName/lastName/pesel
      const queryVal = searchQueryInput.value.trim();
      if (!queryVal) {
        alert('Wprowadź dane do wyszukania.');
        return;
      }
      // W Twoim backendzie prawdopodobnie i tak reagujesz tylko na "?search=..."
      // Możesz zignorować searchType w tym prostym przykładzie
      currentSearchQuery = `?search=${encodeURIComponent(queryVal)}`;
      loadPatients(currentSearchQuery);
    });
  }

  if (resetSearchBtn) {
    resetSearchBtn.addEventListener('click', () => {
      searchQueryInput.value = '';
      currentSearchQuery = '';
      loadPatients();
    });
  }

  //-----------------------------------------------------
  // Na koniec, startowe ładowanie płci, narodowości + pacjentów
  //-----------------------------------------------------
  loadGendersAndNationalities().then(() => {
    loadPatients();
  });
});
