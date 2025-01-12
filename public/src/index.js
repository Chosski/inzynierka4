// login.js
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const login = document.getElementById('login-input').value.trim();
  const password = document.getElementById('password-input').value.trim();

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ login, password })
    });

    if (!resp.ok) {
      // Błąd logowania
      const errData = await resp.json();
      alert(`Błąd: ${errData.message}`);
      return;
    }

    const data = await resp.json();
    // data => { id, login, temporaryPassword: bool, forcePasswordChange: bool }

    localStorage.setItem('userId', data.id);
    localStorage.setItem('userLogin', data.login);

    if (data.forcePasswordChange === true) {
      // przekierowanie do change_password.html
      window.location.href = 'change_password.html';
    } else {
      // normalnie do dashboard
      window.location.href = 'dashboard.html';
    }

  } catch (error) {
    console.error('Błąd logowania:', error);
    alert('Błąd serwera podczas logowania.');
  }
});
