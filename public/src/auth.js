// auth.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorMessage = document.getElementById('error-message');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      if (response.ok) {
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
        errorMessage.style.display = 'block';
      }
    } catch (error) {
      console.error('Błąd podczas logowania:', error);
    }
  });
});

