// add_patient.js

document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'reception' && userRole !== 'admin') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  const backButton = document.getElementById('back-to-patients');
  const logoutButton = document.getElementById('logout-button');
  const addPatientForm = document.getElementById('add-patient-form');

  backButton.addEventListener('click', () => {
    window.location.href = 'reception.html';
  });

  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    window.location.href = 'index.html';
  });

  async function loadGendersAndNationalities() {
    try {
      const [gendersResponse, nationalitiesResponse] = await Promise.all([
        fetch('/api/genders'),
        fetch('/api/countries')
      ]);

      if (gendersResponse.ok && nationalitiesResponse.ok) {
        const genders = await gendersResponse.json();
        const nationalities = await nationalitiesResponse.json();

        populateSelect('gender', genders);
        populateSelect('nationality', nationalities);
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

  addPatientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const pesel = document.getElementById('pesel').value.trim();
    const gender_id = document.getElementById('gender').value;
    const nationality_id = document.getElementById('nationality').value;
    const phone = document.getElementById('phone').value.trim();

    const residenceAddress = {
      country: document.getElementById('residence-country').value.trim(),
      city: document.getElementById('residence-city').value.trim(),
      postal_code: document.getElementById('residence-postal_code').value.trim(),
      street: document.getElementById('residence-street').value.trim(),
      house_number: document.getElementById('residence-house_number').value.trim(),
      apartment_number: document.getElementById('residence-apartment_number').value.trim() || null
    };

    const registrationAddress = {
      country: document.getElementById('registration-country').value.trim(),
      city: document.getElementById('registration-city').value.trim(),
      postal_code: document.getElementById('registration-postal_code').value.trim(),
      street: document.getElementById('registration-street').value.trim(),
      house_number: document.getElementById('registration-house_number').value.trim(),
      apartment_number: document.getElementById('registration-apartment_number').value.trim() || null
    };

    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          pesel,
          gender_id,
          nationality_id,
          phone,
          addressResidence: residenceAddress,
          addressRegistration: registrationAddress
        }),
      });

      if (response.ok) {
        alert('Pacjent został dodany.');
        addPatientForm.reset();
      } else {
        const errorData = await response.json();
        alert(`Błąd podczas dodawania pacjenta: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas dodawania pacjenta:', error);
    }
  });

  loadGendersAndNationalities();
});
