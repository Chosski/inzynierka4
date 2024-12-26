// add_user.js

document.addEventListener('DOMContentLoaded', () => {
    // Sprawdzenie roli użytkownika
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      alert('Brak dostępu do tej strony.');
      window.location.href = 'dashboard.html';
      return;
    }
  
    const backButton = document.getElementById('back-to-dashboard');
    const logoutButton = document.getElementById('logout-button');
    const addUserForm = document.getElementById('add-user-form');
  
    // Obsługa przycisku "Powrót do Listy Użytkowników"
    backButton.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  
    // Obsługa wylogowania
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userLogin');
      window.location.href = 'index.html';
    });
  
    // Obsługa formularza dodawania użytkownika
    addUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const login = document.getElementById('login').value.trim();
      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const pesel = document.getElementById('pesel').value.trim();
      const role = document.getElementById('role').value;
      const password = document.getElementById('password').value;
  
      try {
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            login,
            firstName,
            lastName,
            pesel,
            role,
            password,
          }),
        });
  
        if (response.ok) {
          alert('Użytkownik został dodany.');
          addUserForm.reset();
        } else {
          const errorData = await response.json();
          alert(`Błąd podczas dodawania użytkownika: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd podczas dodawania użytkownika:', error);
      }
    });
  });
  