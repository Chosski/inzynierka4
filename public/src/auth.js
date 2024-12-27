// auth.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorMessage = document.getElementById('error-message');

  if (!loginForm) {
    console.error('Nie znaleziono formularza #login-form w HTML.');
    return; // Wyjdź, bo nie ma formularza
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST', // ważne, aby POST
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ login, password }),
      });

      if (response.ok) {
        // Logowanie udane
        const data = await response.json();
        localStorage.setItem('userId', data.id);
        localStorage.setItem('userRole', data.role);
        localStorage.setItem('userLogin', data.login);

        if (data.temporaryPassword) {
          window.location.href = 'change-password.html';
        } else {
          window.location.href = 'dashboard.html';
        }
      } else {
        // Błąd 401 albo inny
        errorMessage.style.display = 'block'; 
        console.warn('Nieudane logowanie. Status HTTP:', response.status);
      }
    } catch (error) {
      console.error('Błąd podczas logowania:', error);
    }
  });
});
