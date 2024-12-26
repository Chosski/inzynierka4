// change-password.js

document.addEventListener('DOMContentLoaded', () => {
  const userLogin = localStorage.getItem('userLogin');

  if (!userLogin) {
    alert('Nie jesteś zalogowany.');
    window.location.href = 'index.html';
    return;
  }

  const changePasswordForm = document.getElementById('change-password-form');
  const passwordError = document.getElementById('password-error');

  changePasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      passwordError.style.display = 'block';
      return;
    } else {
      passwordError.style.display = 'none';
    }

    try {
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: userLogin,
          newPassword: newPassword,
        }),
      });

      if (response.ok) {
        alert('Hasło zostało zmienione.');
        // Wyloguj użytkownika i przekieruj na stronę logowania
        localStorage.removeItem('userRole');
        localStorage.removeItem('userLogin');
        window.location.href = 'index.html';
      } else {
        const errorData = await response.json();
        alert(`Błąd podczas zmiany hasła: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas zmiany hasła:', error);
    }
  });
});
