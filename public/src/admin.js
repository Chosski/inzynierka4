// admin.js

document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  const manageUsersTab = document.getElementById('manage-users-tab');
  const systemLogsTab = document.getElementById('system-logs-tab');
  const systemConfigTab = document.getElementById('system-config-tab');
  const manageClinicsTab = document.getElementById('manage-clinics-tab');

  const manageUsersSection = document.getElementById('manage-users-section');
  const systemLogsSection = document.getElementById('system-logs-section');
  const systemConfigSection = document.getElementById('system-config-section');
  const manageClinicsSection = document.getElementById('manage-clinics-section');

  manageUsersTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-users');
  });

  systemLogsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('system-logs');
    loadSystemLogs();
  });

  systemConfigTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('system-config');
    loadSystemConfig();
  });

  manageClinicsTab.addEventListener('click', (e)=>{
    e.preventDefault();
    showSection('manage-clinics');
    loadClinics();
  });

  function showSection(section) {
    manageUsersSection.style.display = 'none';
    systemLogsSection.style.display = 'none';
    systemConfigSection.style.display = 'none';
    manageClinicsSection.style.display = 'none';

    if (section === 'manage-users') {
      manageUsersSection.style.display = 'block';
    } else if (section === 'system-logs') {
      systemLogsSection.style.display = 'block';
    } else if (section === 'system-config') {
      systemConfigSection.style.display = 'block';
    } else if (section === 'manage-clinics') {
      manageClinicsSection.style.display = 'block';
    }
  }

  showSection('manage-users');

  const backButton = document.getElementById('back-to-dashboard');
  backButton.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userLogin');
    window.location.href = 'index.html';
  });

  // Zarządzanie Użytkownikami
  const addUserButton = document.getElementById('add-user-button');
  const searchUserForm = document.getElementById('search-user-form');
  const resetSearchButton = document.getElementById('reset-search');
  const userList = document.getElementById('user-list');
  const userModal = document.getElementById('user-modal');
  const closeUserModalButton = document.getElementById('close-user-modal');
  const userModalTitle = document.getElementById('user-modal-title');
  const userForm = document.getElementById('user-form');
  let currentUserSearchQuery = '';

  const userIdField = document.getElementById('user-id');
  const userLoginField = document.getElementById('user-login');
  const userFirstNameField = document.getElementById('user-firstName');
  const userLastNameField = document.getElementById('user-lastName');
  const userPeselField = document.getElementById('user-pesel');
  const userRoleField = document.getElementById('user-role');
  const userPasswordField = document.getElementById('user-password');
  const userPasswordConfirmField = document.getElementById('user-password-confirm');
  const userClinicsContainer = document.getElementById('user-clinics-container');

  addUserButton.addEventListener('click', () => {
    openUserModal();
  });

  function openUserModal(user = null) {
    if (user) {
      userModalTitle.textContent = 'Edycja Użytkownika';
      userIdField.value = user.id;
      userLoginField.value = user.login;
      userFirstNameField.value = user.firstName;
      userLastNameField.value = user.lastName;
      userPeselField.value = user.pesel;
      userRoleField.value = user.role;
      userPasswordField.value = '';
      userPasswordConfirmField.value = '';
      loadUserVisibleClinics(user.id);
    } else {
      userModalTitle.textContent = 'Dodaj Użytkownika';
      userForm.reset();
      userIdField.value = '';
      loadAllClinicsForUserForm([]); 
    }

    userModal.style.display = 'block';
  }

  function closeUserModal() {
    userModal.style.display = 'none';
    userForm.reset();
    userIdField.value = '';
  }

  if (closeUserModalButton) {
    closeUserModalButton.addEventListener('click', closeUserModal);
  }

  window.addEventListener('click', (event) => {
    if (event.target == userModal) {
      closeUserModal();
    }
  });

  async function loadUsers(query = '') {
    try {
      const response = await fetch(`/api/users${query}`);
      if (response.ok) {
        const users = await response.json();
        renderUserList(users);
      } else {
        const errorData = await response.json();
        console.error('Błąd pobierania użytkowników:', errorData);
        alert('Błąd podczas pobierania listy użytkowników.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy użytkowników:', error);
    }
  }

  function renderUserList(users) {
    if (users.length === 0) {
      userList.innerHTML = `
        <tr>
          <td colspan="5">Brak użytkowników do wyświetlenia.</td>
        </tr>
      `;
      return;
    }

    let tableHeader = `
      <tr>
        <th>Login</th>
        <th>Imię</th>
        <th>Nazwisko</th>
        <th>Rola</th>
        <th>Akcje</th>
      </tr>
    `;

    let tableRows = '';

    users.forEach((user) => {
      tableRows += `
        <tr>
          <td>${user.login}</td>
          <td>${user.firstName}</td>
          <td>${user.lastName}</td>
          <td>${user.role}</td>
          <td>
            <button class="edit-button" data-user='${JSON.stringify(user)}'>Edytuj</button>
            <button class="delete-button" data-id="${user.id}">Usuń</button>
            <button onclick="resetPassword(${user.id})">Resetuj Hasło</button>
          </td>
        </tr>
      `;
    });

    userList.innerHTML = tableHeader + tableRows;

    document.querySelectorAll('.edit-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const userData = JSON.parse(e.target.getAttribute('data-user'));
        openUserModal(userData);
      });
    });

    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        const userId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć tego użytkownika?')) {
          try {
            const response = await fetch(`/api/users/${userId}`, {
              method: 'DELETE',
            });

            if (response.ok) {
              alert('Użytkownik został usunięty.');
              loadUsers(currentUserSearchQuery);
            } else {
              const errorData = await response.json();
              alert(`Błąd usuwania użytkownika: ${errorData.message}`);
            }
          } catch (error) {
            console.error('Błąd podczas usuwania użytkownika:', error);
          }
        }
      });
    });
  }

  if (searchUserForm) {
    searchUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const searchType = document.getElementById('search-type').value;
      const searchQuery = document.getElementById('search-query').value.trim();
      if (!searchQuery) {
        alert('Proszę wprowadzić wartość do wyszukania.');
        return;
      }
      currentUserSearchQuery = `?${searchType}=${encodeURIComponent(searchQuery)}`;
      loadUsers(currentUserSearchQuery);
    });
  }

  if (resetSearchButton) {
    resetSearchButton.addEventListener('click', () => {
      document.getElementById('search-query').value = '';
      currentUserSearchQuery = '';
      loadUsers();
    });
  }

  userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = userIdField.value;
    const login = userLoginField.value.trim();
    const firstName = userFirstNameField.value.trim();
    const lastName = userLastNameField.value.trim();
    const pesel = userPeselField.value.trim();
    const role = userRoleField.value;
    const password = userPasswordField.value;
    const passwordConfirm = userPasswordConfirmField.value;

    if (!/^\d{11}$/.test(pesel)) {
      alert('PESEL musi składać się z 11 cyfr.');
      return;
    }

    if (userId) {
      if ((password || passwordConfirm) && (password !== passwordConfirm)) {
        alert('Hasła nie są zgodne.');
        return;
      }
    } else {
      if (!password || !passwordConfirm) {
        alert('Hasło jest wymagane przy dodawaniu nowego użytkownika.');
        return;
      }
      if (password !== passwordConfirm) {
        alert('Hasła nie są zgodne.');
        return;
      }
    }

    let userData = {
      login,
      firstName,
      lastName,
      pesel,
      role
    };

    if ((!userId && password && passwordConfirm && password === passwordConfirm) || 
        (userId && password && passwordConfirm && password === passwordConfirm)) {
      userData.password = password;
    }

    try {
      let response;
      if (userId) {
        const putBody = {
          firstName,
          lastName,
          pesel,
          role
        };
        if (userData.password) {
          putBody.password = userData.password;
        }

        response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(putBody),
        });
      } else {
        response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });
      }

      if (response.ok) {
        let newUserId = userId;
        if (!userId) {
          const created = await response.json();
          newUserId = created.id;
          alert('Dodano nowego użytkownika.');
        } else {
          alert('Dane użytkownika zostały zaktualizowane.');
        }

        await saveUserVisibleClinics(newUserId);
        closeUserModal();
        loadUsers(currentUserSearchQuery);
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas zapisywania użytkownika:', error);
      alert('Błąd podczas zapisywania użytkownika.');
    }
  });

  async function saveUserVisibleClinics(userId) {
    const checkboxes = userClinicsContainer.querySelectorAll('input[type="checkbox"]');
    const selectedClinics = [];
    checkboxes.forEach(ch => {
      if (ch.checked) selectedClinics.push(parseInt(ch.value));
    });

    try {
      const response = await fetch(`/api/users/${userId}/visible-clinics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinics: selectedClinics }),
      });
      if (!response.ok) {
        const err = await response.json();
        alert(`Błąd zapisu widocznych poradni: ${err.message}`);
      }
    } catch (error) {
      console.error('Błąd zapisu widocznych poradni:', error);
      alert('Błąd zapisu widocznych poradni.');
    }
  }

  async function loadUserVisibleClinics(userId) {
    try {
      const response = await fetch(`/api/users/${userId}/visible-clinics`);
      if (response.ok) {
        const visibleClinics = await response.json();
        const visibleIds = visibleClinics.map(vc => vc.id);
        loadAllClinicsForUserForm(visibleIds);
      } else {
        loadAllClinicsForUserForm([]);
      }
    } catch (error) {
      console.error('Błąd ładowania widocznych poradni:', error);
      loadAllClinicsForUserForm([]);
    }
  }

  async function loadAllClinicsForUserForm(visibleClinicIds) {
    try {
      const response = await fetch('/api/clinics');
      if (response.ok) {
        const clinics = await response.json();
        userClinicsContainer.innerHTML = '';
        clinics.forEach(c => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = c.id;
          if (visibleClinicIds.includes(c.id)) {
            checkbox.checked = true;
          }
          label.appendChild(checkbox);
          label.append(' ' + c.name);
          userClinicsContainer.appendChild(label);
          userClinicsContainer.appendChild(document.createElement('br'));
        });
      } else {
        console.error('Błąd ładowania poradni.');
      }
    } catch (error) {
      console.error('Błąd podczas ładowania poradni:', error);
    }
  }

  const resetPasswordModal = document.getElementById('reset-password-modal');
  const closeResetPasswordModal = document.getElementById('close-reset-password-modal');
  const temporaryPasswordInput = document.getElementById('temporary-password');
  const resetPasswordForm = document.getElementById('reset-password-form');

  window.resetPassword = function(id) {
    resetPasswordModal.style.display = 'block';

    closeResetPasswordModal.onclick = function() {
      resetPasswordModal.style.display = 'none';
      temporaryPasswordInput.value = '';
    };

    window.onclick = function(event) {
      if (event.target == resetPasswordModal) {
        resetPasswordModal.style.display = 'none';
        temporaryPasswordInput.value = '';
      }
    };

    resetPasswordForm.onsubmit = async function(e) {
      e.preventDefault();
      const temporaryPassword = temporaryPasswordInput.value;
      if (temporaryPassword.trim() === '') {
        alert('Hasło nie może być puste.');
        return;
      }

      try {
        const response = await fetch(`/api/users/${id}/reset-password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temporaryPassword }),
        });

        if (response.ok) {
          alert('Hasło zostało zresetowane.');
          resetPasswordModal.style.display = 'none';
          temporaryPasswordInput.value = '';
        } else {
          const errorData = await response.json();
          alert(`Błąd resetowania hasła: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Błąd resetowania hasła:', error);
      }
    };
  };

  async function loadSystemLogs() {
    try {
      const response = await fetch('/api/system-logs');
      if (response.ok) {
        const logs = await response.text();
        const logsContent = document.getElementById('logs-content');
        logsContent.textContent = logs;
      } else {
        alert('Błąd podczas wczytywania logów systemowych.');
      }
    } catch (error) {
      console.error('Błąd wczytywania logów systemowych:', error);
    }
  }

  const systemConfigForm = document.getElementById('system-config-form');
  systemConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maintenanceMode = document.getElementById('maintenance-mode').value;
    const sessionTimeout = document.getElementById('session-timeout').value;
    const logLevel = document.getElementById('log-level').value;

    try {
      const response = await fetch('/api/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenanceMode, sessionTimeout, logLevel }),
      });

      if (response.ok) {
        alert('Konfiguracja systemu została zaktualizowana.');
      } else {
        alert('Błąd podczas zapisywania konfiguracji systemu.');
      }
    } catch (error) {
      console.error('Błąd konfiguracji systemu:', error);
    }
  });

  async function loadSystemConfig() {
    try {
      const response = await fetch('/api/system-config');
      if (response.ok) {
        const config = await response.json();
        document.getElementById('maintenance-mode').value = config.maintenanceMode;
        document.getElementById('session-timeout').value = config.sessionTimeout;
        document.getElementById('log-level').value = config.logLevel;
      } else {
        alert('Błąd podczas wczytywania konfiguracji systemu.');
      }
    } catch (error) {
      console.error('Błąd wczytywania konfiguracji systemu:', error);
    }
  }

  // Zarządzanie Poradniami
  const addClinicButton = document.getElementById('add-clinic-button');
  const clinicList = document.getElementById('clinic-list');
  const clinicModal = document.getElementById('clinic-modal');
  const closeClinicModalButton = document.getElementById('close-clinic-modal');
  const clinicModalTitle = document.getElementById('clinic-modal-title');
  const clinicForm = document.getElementById('clinic-form');
  const clinicIdField = document.getElementById('clinic-id');
  const clinicNameField = document.getElementById('clinic-name');
  const assignedDoctorsTitle = document.getElementById('assigned-doctors-title');
  const assignedDoctorsList = document.getElementById('assigned-doctors-list');

  let currentClinicId = null;
  const addDoctorToClinicButton = document.getElementById('add-doctor-to-clinic-button');
  const addDoctorToClinicModal = document.getElementById('add-doctor-to-clinic-modal');
  const closeAddDoctorToClinicModalButton = document.getElementById('close-add-doctor-to-clinic-modal');
  const doctorSearchResults = document.getElementById('doctor-search-results');

  addClinicButton.addEventListener('click', () => {
    openClinicModal();
  });

  function openClinicModal(clinic = null) {
    if (clinic) {
      clinicModalTitle.textContent = 'Edytuj Poradnię';
      clinicIdField.value = clinic.id;
      clinicNameField.value = clinic.name;
      currentClinicId = clinic.id;

      assignedDoctorsTitle.style.display = 'block';
      assignedDoctorsList.style.display = 'block';
      addDoctorToClinicButton.style.display = 'inline-block'; 

      loadAssignedDoctors(currentClinicId);
    } else {
      clinicModalTitle.textContent = 'Dodaj Poradnię';
      clinicForm.reset();
      clinicIdField.value = '';
      currentClinicId = null;

      // Nie pokazujemy listy lekarzy ani przycisku gdy tworzymy nową poradnię
      assignedDoctorsTitle.style.display = 'none';
      assignedDoctorsList.style.display = 'none';
      addDoctorToClinicButton.style.display = 'none';

      assignedDoctorsList.innerHTML = '';
    }
    clinicModal.style.display = 'block';
  }

  async function loadAssignedDoctors(clinicId) {
    try {
      const response = await fetch(`/api/clinics/${clinicId}/doctors`);
      if (response.ok) {
        const doctors = await response.json();
        renderAssignedDoctors(doctors);
      } else {
        assignedDoctorsList.innerHTML = '<li>Błąd podczas pobierania przypisanych lekarzy.</li>';
      }
    } catch (error) {
      console.error('Błąd pobierania przypisanych lekarzy:', error);
      assignedDoctorsList.innerHTML = '<li>Błąd podczas pobierania przypisanych lekarzy.</li>';
    }
  }

  function renderAssignedDoctors(doctors) {
    assignedDoctorsList.innerHTML = '';
    if (doctors.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak przypisanych lekarzy.';
      assignedDoctorsList.appendChild(li);
      return;
    }

    doctors.forEach(doc => {
      const li = document.createElement('li');
      li.textContent = `${doc.firstName} ${doc.lastName}`;
      assignedDoctorsList.appendChild(li);
    });
  }

  function closeClinicModal() {
    clinicModal.style.display = 'none';
    clinicForm.reset();
    clinicIdField.value = '';
    currentClinicId = null;
    assignedDoctorsList.innerHTML = '';
    assignedDoctorsTitle.style.display = 'none';
    assignedDoctorsList.style.display = 'none';
    addDoctorToClinicButton.style.display = 'none';
  }

  closeClinicModalButton.addEventListener('click', closeClinicModal);

  window.addEventListener('click', (event) => {
    if (event.target == clinicModal) {
      closeClinicModal();
    }
  });

  clinicForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clinicId = clinicIdField.value;
    const name = clinicNameField.value.trim();

    try {
      let response;
      if (clinicId) {
        response = await fetch(`/api/clinics/${clinicId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } else {
        response = await fetch('/api/clinics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      }

      if (response.ok) {
        if (!clinicId) {
          const data = await response.json();
          currentClinicId = data.id;

          // Teraz po zapisaniu nowej poradni możemy pokazać listę lekarzy i przycisk
          assignedDoctorsTitle.style.display = 'block';
          assignedDoctorsList.style.display = 'block';
          addDoctorToClinicButton.style.display = 'inline-block';
          alert('Dodano poradnię.');
          loadAssignedDoctors(currentClinicId);
        } else {
          alert('Zaktualizowano poradnię.');
          loadAssignedDoctors(clinicId);
        }
        closeClinicModal();
        loadClinics();
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd zapisywania poradni:', error);
      alert('Błąd podczas zapisywania poradni.');
    }
  });

  async function loadClinics() {
    try {
      const response = await fetch('/api/clinics');
      if (response.ok) {
        const clinics = await response.json();
        renderClinicList(clinics);
      } else {
        const errorData = await response.json();
        console.error('Błąd pobierania poradni:', errorData);
        alert('Błąd podczas pobierania listy poradni.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy poradni:', error);
    }
  }

  function renderClinicList(clinics) {
    if (clinics.length === 0) {
      clinicList.innerHTML = `
        <tr>
          <td colspan="2">Brak poradni do wyświetlenia.</td>
        </tr>
      `;
      return;
    }

    let tableHeader = `
      <tr>
        <th>Nazwa Poradni</th>
        <th>Akcje</th>
      </tr>
    `;

    let tableRows = '';

    clinics.forEach((clinic) => {
      tableRows += `
        <tr>
          <td>${clinic.name}</td>
          <td>
            <button class="edit-clinic-button" data-clinic='${JSON.stringify(clinic)}'>Edytuj</button>
            <button class="delete-clinic-button" data-id="${clinic.id}">Usuń</button>
          </td>
        </tr>
      `;
    });

    clinicList.innerHTML = tableHeader + tableRows;

    document.querySelectorAll('.edit-clinic-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const clinicData = JSON.parse(e.target.getAttribute('data-clinic'));
        openClinicModal(clinicData);
      });
    });

    document.querySelectorAll('.delete-clinic-button').forEach(button => {
      button.addEventListener('click', async (e) => {
        const clinicId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć tę poradnię?')) {
          try {
            const response = await fetch(`/api/clinics/${clinicId}`, {
              method: 'DELETE',
            });

            if (response.ok) {
              alert('Poradnia została usunięta.');
              loadClinics();
            } else {
              const errorData = await response.json();
              alert(`Błąd usuwania poradni: ${errorData.message}`);
            }
          } catch (error) {
            console.error('Błąd usuwania poradni:', error);
          }
        }
      });
    });
  }

  addDoctorToClinicButton.addEventListener('click', async () => {
    if (!currentClinicId) {
      alert('Zapisz najpierw poradnię aby móc dodać lekarza.');
      return;
    }

    try {
      const response = await fetch('/api/doctors'); 
      if (response.ok) {
        const doctors = await response.json();
        renderDoctorSearchResults(doctors);
      } else {
        alert('Błąd podczas pobierania listy lekarzy.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy lekarzy:', error);
      alert('Błąd podczas pobierania listy lekarzy.');
    }

    addDoctorToClinicModal.style.display = 'block';
  });

  closeAddDoctorToClinicModalButton.addEventListener('click', () => {
    addDoctorToClinicModal.style.display = 'none';
    doctorSearchResults.innerHTML = '';
  });

  window.addEventListener('click', (event) => {
    if (event.target == addDoctorToClinicModal) {
      addDoctorToClinicModal.style.display = 'none';
      doctorSearchResults.innerHTML = '';
    }
  });

  async function loadAssignedDoctorsForUpdate(clinicId) {
    const response = await fetch(`/api/clinics/${clinicId}/doctors`);
    if (response.ok) {
      return await response.json();
    } else {
      return [];
    }
  }

  function renderDoctorSearchResults(doctors) {
    doctorSearchResults.innerHTML = '';
    if (doctors.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Brak lekarzy do wyświetlenia.';
      doctorSearchResults.appendChild(li);
      return;
    }

    doctors.forEach(doc => {
      const li = document.createElement('li');
      li.textContent = `${doc.firstName} ${doc.lastName}`;
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        addDoctorToClinic(doc.id);
      });
      doctorSearchResults.appendChild(li);
    });
  }

  async function addDoctorToClinic(doctorId) {
    if (!currentClinicId) {
      alert('Najpierw wybierz poradnię.');
      return;
    }

    // Pobierz aktualnie przypisanych lekarzy
    let assignedDoctors = await loadAssignedDoctorsForUpdate(currentClinicId);
    const assignedDoctorIds = assignedDoctors.map(d => d.id);

    // Dodaj nowego lekarza jeśli nie ma go na liście
    if (!assignedDoctorIds.includes(doctorId)) {
      assignedDoctorIds.push(doctorId);
    }

    // Wyślij całą listę do serwera
    try {
      const response = await fetch(`/api/clinics/${currentClinicId}/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctors: assignedDoctorIds })
      });

      if (response.ok) {
        alert('Lekarz został dodany do poradni.');
        addDoctorToClinicModal.style.display = 'none';
        doctorSearchResults.innerHTML = '';
        // Odśwież listę przypisanych lekarzy
        loadAssignedDoctors(currentClinicId);
      } else {
        const errorData = await response.json();
        alert(`Błąd dodawania lekarza do poradni: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd dodawania lekarza do poradni:', error);
      alert('Błąd dodawania lekarza do poradni.');
    }
  }

  loadUsers();
});
