document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  const userLogin = localStorage.getItem('userLogin');
  const userId = localStorage.getItem('userId');

  if (!userRole || !userLogin || !userId) {
    window.location.href = 'index.html';
    return;
  }

  const userLoginSpan = document.getElementById('user-login-span');
  if (userLoginSpan) {
    userLoginSpan.textContent = userLogin;
  }

  function updateDateTime() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
      const now = new Date();
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      };
      dateElement.textContent = `Dziś jest: ${now.toLocaleDateString('pl-PL', options)}`;
    }
  }
  updateDateTime();
  setInterval(updateDateTime, 30000);

  async function loadTodaySchedules() {
    if (userRole === 'doctor') {
      const today = new Date().toISOString().split('T')[0];
      try {
        const res = await fetch(`/api/schedules?doctorId=${userId}&date=${today}`);
        if (res.ok) {
          const schedules = await res.json();
          document.getElementById('todays-schedules').textContent = schedules.length;
        } else {
          document.getElementById('todays-schedules').textContent = 'Błąd!';
        }
      } catch (err) {
        console.error('Błąd pobierania dzisiejszych wizyt:', err);
        document.getElementById('todays-schedules').textContent = 'Błąd!';
      }
    } else {
      document.querySelector('.tile').style.display = 'none';
    }
  }
  loadTodaySchedules();
});
