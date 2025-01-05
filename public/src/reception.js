// reception.js

document.addEventListener('DOMContentLoaded', () => {
  // Sprawdzenie roli użytkownika
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'reception' && userRole !== 'admin' && userRole !== 'doctor') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  const backButton = document.getElementById('back-to-dashboard');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }

  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userLogin');
      localStorage.removeItem('userId');
      window.location.href = 'index.html';
    });
  }

  const addPatientButton = document.getElementById('add-patient-button');
  if (addPatientButton) {
    addPatientButton.addEventListener('click', () => {
      openPatientModal(); // Otwarcie modala w trybie dodawania
    });
  }

  const patientForm = document.getElementById('patient-form');
  let currentSearchQuery = '';
  const patientList = document.getElementById('patient-list');
  const patientModal = document.getElementById('patient-modal');
  const closePatientModalButton = document.getElementById('close-patient-modal');
  const patientModalTitle = document.getElementById('patient-modal-title');

  if (!patientList) {
    console.error('Brak elementu o id "patient-list"');
    return;
  }

  if (patientForm) {
    patientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const patientId = document.getElementById('patient-id').value;
      const firstName = document.getElementById('patient-firstName').value.trim();
      const lastName = document.getElementById('patient-lastName').value.trim();
      const pesel = document.getElementById('patient-pesel').value.trim();
      const gender_id = document.getElementById('patient-gender').value;
      const nationality_id = document.getElementById('patient-nationality').value;
      const phone = document.getElementById('patient-phone').value.trim();

      // Pobranie danych adresów zamieszkania
      const residenceAddress = {
        country: document.getElementById('residence-country').value.trim(),
        city: document.getElementById('residence-city').value.trim(),
        postal_code: document.getElementById('residence-postal_code').value.trim(),
        street: document.getElementById('residence-street').value.trim(),
        house_number: document.getElementById('residence-house_number').value.trim(),
        apartment_number: document.getElementById('residence-apartment_number').value.trim() || null
      };

      // Pobranie danych adresów zameldowania
      const registrationAddress = {
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

      const patientData = {
        firstName,
        lastName,
        pesel,
        gender_id,
        nationality_id,
        phone,
        addressResidence: residenceAddress,
        addressRegistration: registrationAddress
      };

      try {
        let response;
        if (patientId) {
          // Edycja pacjenta
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
          const message = patientId ? 'Dane pacjenta zostały zaktualizowane.' : 'Dodano nowego pacjenta.';
          alert(message);
          closePatientModal();
          loadPatients(currentSearchQuery); // Odśwież listę pacjentów
        } else {
          const errorData = await response.json();
          alert(`Błąd: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas zapisywania pacjenta:', error);
        alert('Błąd podczas zapisywania pacjenta.');
      }
    });
  } else {
    console.error('Brak elementu o id "patient-form"');
  }

  if (closePatientModalButton) {
    closePatientModalButton.addEventListener('click', closePatientModal);
  } else {
    console.error('Brak elementu o id "close-patient-modal"');
  }

  window.addEventListener('click', (event) => {
    if (event.target == patientModal) {
      closePatientModal();
    }
  });

  function openPatientModal(patient = null) {
    if (patient) {
      // Tryb edycji
      patientModalTitle.textContent = 'Edycja Pacjenta';
      document.getElementById('patient-id').value = patient.id;
      document.getElementById('patient-firstName').value = patient.firstName;
      document.getElementById('patient-lastName').value = patient.lastName;
      document.getElementById('patient-pesel').value = patient.pesel;
      document.getElementById('patient-gender').value = patient.gender_id;
      document.getElementById('patient-nationality').value = patient.nationality_id;
      document.getElementById('patient-phone').value = patient.phone || '';

      // Ustawianie adresów (zakładamy że backend zwraca je w postaci obiektów)
      if (patient.addressResidence) {
        document.getElementById('residence-country').value = patient.addressResidence.country;
        document.getElementById('residence-city').value = patient.addressResidence.city;
        document.getElementById('residence-postal_code').value = patient.addressResidence.postal_code;
        document.getElementById('residence-street').value = patient.addressResidence.street;
        document.getElementById('residence-house_number').value = patient.addressResidence.house_number;
        document.getElementById('residence-apartment_number').value = patient.addressResidence.apartment_number || '';
      } else {
        // Jeśli brak danych adresowych, wyczyść pola
        clearResidenceFields();
      }

      if (patient.addressRegistration) {
        document.getElementById('registration-country').value = patient.addressRegistration.country;
        document.getElementById('registration-city').value = patient.addressRegistration.city;
        document.getElementById('registration-postal_code').value = patient.addressRegistration.postal_code;
        document.getElementById('registration-street').value = patient.addressRegistration.street;
        document.getElementById('registration-house_number').value = patient.addressRegistration.house_number;
        document.getElementById('registration-apartment_number').value = patient.addressRegistration.apartment_number || '';
      } else {
        // Jeśli brak danych adresowych, wyczyść pola
        clearRegistrationFields();
      }

    } else {
      // Tryb dodawania
      patientModalTitle.textContent = 'Dodaj Pacjenta';
      patientForm.reset();
      document.getElementById('patient-id').value = '';
      clearResidenceFields();
      clearRegistrationFields();
    }
    patientModal.style.display = 'block';
  }

  function clearResidenceFields() {
    document.getElementById('residence-country').value = '';
    document.getElementById('residence-city').value = '';
    document.getElementById('residence-postal_code').value = '';
    document.getElementById('residence-street').value = '';
    document.getElementById('residence-house_number').value = '';
    document.getElementById('residence-apartment_number').value = '';
  }

  function clearRegistrationFields() {
    document.getElementById('registration-country').value = '';
    document.getElementById('registration-city').value = '';
    document.getElementById('registration-postal_code').value = '';
    document.getElementById('registration-street').value = '';
    document.getElementById('registration-house_number').value = '';
    document.getElementById('registration-apartment_number').value = '';
  }

  function closePatientModal() {
    patientModal.style.display = 'none';
    patientForm.reset();
    document.getElementById('patient-id').value = '';
    patientModalTitle.textContent = 'Dodaj Pacjenta';
  }

  async function loadPatients(query = '') {
    try {
      const response = await fetch(`/api/patients${query}`);
      if (response.ok) {
        const patients = await response.json();
        renderPatientList(patients);
      } else {
        const errorData = await response.json();
        console.error('Błąd podczas pobierania pacjentów:', errorData);
        alert('Błąd podczas pobierania listy pacjentów.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy pacjentów:', error);
    }
  }

  function renderPatientList(patients) {
    if (patients.length === 0) {
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

    patients.forEach((patient) => {
      tableRows += `
        <tr>
          <td>${patient.firstName}</td>
          <td>${patient.lastName}</td>
          <td>${patient.pesel}</td>
          <td>${patient.genderName || ''}</td>
          <td>${patient.phone || ''}</td>
          <td>
            <button class="edit-button" data-patient='${JSON.stringify(patient)}'>Edytuj</button>
            <button class="delete-button" data-id="${patient.id}">Usuń</button>
          </td>
        </tr>
      `;
    });

    patientList.innerHTML = tableHeader + tableRows;

    document.querySelectorAll('.edit-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const patientData = JSON.parse(e.target.getAttribute('data-patient'));
        openPatientModal(patientData);
      });
    });

    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        const patientId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć tego pacjenta?')) {
          try {
            const response = await fetch(`/api/patients/${patientId}`, {
              method: 'DELETE',
            });

            if (response.ok) {
              alert('Pacjent został usunięty.');
              loadPatients(currentSearchQuery);
            } else {
              const errorData = await response.json();
              alert(`Błąd podczas usuwania pacjenta: ${errorData.message}`);
            }
          } catch (error) {
            console.error('Błąd podczas usuwania pacjenta:', error);
          }
        }
      });
    });
  }

  async function loadGendersAndNationalities() {
    try {
      const [gendersResponse, nationalitiesResponse] = await Promise.all([
        fetch('/api/genders'),
        fetch('/api/countries')
      ]);

      if (gendersResponse.ok && nationalitiesResponse.ok) {
        const genders = await gendersResponse.json();
        const nationalities = await nationalitiesResponse.json();

        populateSelect('patient-gender', genders);
        populateSelect('patient-nationality', nationalities);
      } else {
        alert('Błąd podczas ładowania płci i narodowości.');
      }
    } catch (error) {
      console.error('Błąd podczas ładowania płci i narodowości:', error);
    }
  }

  function populateSelect(elementId, items) {
    const select = document.getElementById(elementId);
    select.innerHTML = '<option value="">Wybierz...</option>'; // reset opcji
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  const searchPatientForm = document.getElementById('search-patient-form');
  const resetSearchButton = document.getElementById('reset-search');

  if (searchPatientForm) {
    searchPatientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const searchType = document.getElementById('search-type').value;
      const searchQuery = document.getElementById('search-query').value.trim();

      if (!searchQuery) {
        alert('Proszę wprowadzić wartość do wyszukania.');
        return;
      }

      // używamy parametru "search"
      currentSearchQuery = `?search=${encodeURIComponent(searchQuery)}`;
      loadPatients(currentSearchQuery);
    });
  }

  if (resetSearchButton) {
    resetSearchButton.addEventListener('click', () => {
      document.getElementById('search-query').value = '';
      currentSearchQuery = '';
      loadPatients();
    });
  }

  loadGendersAndNationalities().then(() => {
    loadPatients();
  });
});
