// edit_patient.js

document.addEventListener('DOMContentLoaded', () => {
    // Sprawdzenie roli użytkownika
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'reception' && userRole !== 'admin') {
      alert('Brak dostępu do tej strony.');
      window.location.href = 'dashboard.html';
      return;
    }
  
    // Pobierz ID pacjenta z URL
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('id');
  
    if (!patientId) {
      alert('Brak identyfikatora pacjenta.');
      window.location.href = 'reception.html';
      return;
    }
  
    // Elementy DOM
    const backButton = document.getElementById('back-to-reception');
    const logoutButton = document.getElementById('logout-button');
    const editPatientForm = document.getElementById('edit-patient-form');
  
    // Obsługa przycisku "Powrót do Panelu Rejestracji"
    backButton.addEventListener('click', () => {
      window.location.href = 'reception.html';
    });
  
    // Obsługa wylogowania
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userLogin');
      window.location.href = 'index.html';
    });
  
    // Funkcja pobierająca dane pacjenta i wypełniająca formularz
    async function loadPatientData() {
      try {
        const response = await fetch(`/api/patients/${patientId}`);
        if (response.ok) {
          const patient = await response.json();
          document.getElementById('edit-firstName').value = patient.firstName;
          document.getElementById('edit-lastName').value = patient.lastName;
          document.getElementById('edit-pesel').value = patient.pesel;
          document.getElementById('edit-gender').value = patient.gender_id;
          document.getElementById('edit-nationality').value = patient.nationality_id;
          document.getElementById('edit-phone').value = patient.phone || '';
          document.getElementById('edit-addressResidence').value = patient.addressResidence || '';
          document.getElementById('edit-addressRegistration').value = patient.addressRegistration || '';
        } else {
          alert('Nie znaleziono pacjenta.');
          window.location.href = 'reception.html';
        }
      } catch (error) {
        console.error('Błąd podczas pobierania danych pacjenta:', error);
        alert('Błąd podczas pobierania danych pacjenta.');
        window.location.href = 'reception.html';
      }
    }
  
    // Pobierz listę płci i narodowości
    async function loadGendersAndNationalities() {
      try {
        const [gendersResponse, nationalitiesResponse] = await Promise.all([
          fetch('/api/genders'),
          fetch('/api/countries')
        ]);
  
        if (gendersResponse.ok && nationalitiesResponse.ok) {
          const genders = await gendersResponse.json();
          const nationalities = await nationalitiesResponse.json();
  
          populateSelect('edit-gender', genders);
          populateSelect('edit-nationality', nationalities);
        } else {
          alert('Błąd podczas ładowania płci i narodowości.');
        }
      } catch (error) {
        console.error('Błąd podczas ładowania płci i narodowości:', error);
      }
    }
  
    function populateSelect(elementId, items) {
      const select = document.getElementById(elementId);
      items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
      });
    }
  
    // Obsługa formularza edycji pacjenta
    editPatientForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const firstName = document.getElementById('edit-firstName').value.trim();
      const lastName = document.getElementById('edit-lastName').value.trim();
      const pesel = document.getElementById('edit-pesel').value.trim();
      const gender_id = document.getElementById('edit-gender').value;
      const nationality_id = document.getElementById('edit-nationality').value;
      const phone = document.getElementById('edit-phone').value.trim();
      const addressResidence = document.getElementById('edit-addressResidence').value.trim();
      const addressRegistration = document.getElementById('edit-addressRegistration').value.trim();
  
      try {
        const response = await fetch(`/api/patients/${patientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            pesel,
            gender_id,
            nationality_id,
            phone,
            addressResidence,
            addressRegistration
          }),
        });
  
        if (response.ok) {
          alert('Dane pacjenta zostały zaktualizowane.');
          window.location.href = 'reception.html';
        } else {
          const errorData = await response.json();
          alert(`Błąd podczas edycji pacjenta: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas edycji pacjenta:', error);
        alert('Błąd podczas edycji pacjenta.');
      }
    });
  
    // Inicjalizacja
    loadGendersAndNationalities().then(loadPatientData);
  });
  