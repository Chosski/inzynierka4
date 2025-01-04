document.addEventListener('DOMContentLoaded', () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'admin') {
    alert('Brak dostępu do tej strony.');
    window.location.href = 'dashboard.html';
    return;
  }

  // ---------------------------
  // Sekcje / Taby
  // ---------------------------
  const manageUsersTab = document.getElementById('manage-users-tab');
  const systemLogsTab = document.getElementById('system-logs-tab');
  const systemConfigTab = document.getElementById('system-config-tab');
  const manageClinicsTab = document.getElementById('manage-clinics-tab');
  const managePermissionsTab = document.getElementById('manage-permissions-tab');

  const manageUsersSection = document.getElementById('manage-users-section');
  const systemLogsSection = document.getElementById('system-logs-section');
  const systemConfigSection = document.getElementById('system-config-section');
  const manageClinicsSection = document.getElementById('manage-clinics-section');
  const managePermissionsSection = document.getElementById('manage-permissions-section');

  function showSection(section) {
    // Ukrywamy wszystkie sekcje
    manageUsersSection.style.display = 'none';
    systemLogsSection.style.display = 'none';
    systemConfigSection.style.display = 'none';
    manageClinicsSection.style.display = 'none';
    managePermissionsSection.style.display = 'none';

    // Pokazujemy tylko wybraną
    if (section === 'manage-users') {
      manageUsersSection.style.display = 'block';
    } else if (section === 'system-logs') {
      systemLogsSection.style.display = 'block';
      loadSystemLogs();
    } else if (section === 'system-config') {
      systemConfigSection.style.display = 'block';
      loadSystemConfig();
    } else if (section === 'manage-clinics') {
      manageClinicsSection.style.display = 'block';
      loadClinics();
    } else if (section === 'manage-permissions') {
      managePermissionsSection.style.display = 'block';
      loadPermissions();
      loadPermissionGroups();
    }
  }

  // Obsługa kliknięcia w taby
  manageUsersTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-users');
  });
  systemLogsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('system-logs');
  });
  systemConfigTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('system-config');
  });
  manageClinicsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-clinics');
  });
  managePermissionsTab.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-permissions');
  });

  // Domyślnie startujemy od zakładki "manage-users"
  showSection('manage-users');

  // Przyciski w nagłówku
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


  // ---------------------------
  // Zarządzanie Użytkownikami
  // ---------------------------
  const searchUserForm = document.getElementById('search-user-form');
  const resetSearchButton = document.getElementById('reset-search');
  const userList = document.getElementById('user-list');
  let currentUserSearchQuery = '';

  // --- Dodawanie użytkownika ---
  const addUserButton = document.getElementById('add-user-button');
  const addUserModal = document.getElementById('add-user-modal');
  const closeAddUserModalButton = document.getElementById('close-add-user-modal');
  const addUserForm = document.getElementById('add-user-form');
  const addUserLoginField = document.getElementById('add-user-login');
  const addUserFirstNameField = document.getElementById('add-user-firstName');
  const addUserLastNameField = document.getElementById('add-user-lastName');
  const addUserPeselField = document.getElementById('add-user-pesel');
  const addUserPermissionGroupSelect = document.getElementById('add-user-permission-group');
  const addUserPasswordField = document.getElementById('add-user-password');
  const addUserPasswordConfirmField = document.getElementById('add-user-password-confirm');
  const addUserClinicsContainer = document.getElementById('add-user-clinics-container');

  // --- Edycja użytkownika ---
  const editUserModal = document.getElementById('edit-user-modal');
  const closeEditUserModalButton = document.getElementById('close-edit-user-modal');
  const editUserForm = document.getElementById('edit-user-form');
  const editUserIdField = document.getElementById('edit-user-id');
  const editUserLoginField = document.getElementById('edit-user-login');
  const editUserFirstNameField = document.getElementById('edit-user-firstName');
  const editUserLastNameField = document.getElementById('edit-user-lastName');
  const editUserPeselField = document.getElementById('edit-user-pesel');
  const editUserPermissionGroupSelect = document.getElementById('edit-user-permission-group');
  const editUserClinicsContainer = document.getElementById('edit-user-clinics-container');

  // Przycisk "Dodaj Użytkownika" -> otwarcie modala
  addUserButton.addEventListener('click', () => {
    openAddUserModal();
  });

  // Funkcja otwarcia modala dodawania
  function openAddUserModal() {
    addUserForm.reset();
    // Ładujemy grupy do selecta
    loadPermissionGroupsIntoSelect(addUserPermissionGroupSelect);
    // Ładujemy listę poradni (wszystkie odznaczone, bo nowy user)
    loadAllClinicsForForm(addUserClinicsContainer, []);
    addUserModal.style.display = 'block';
  }

  // Zamknięcie modala dodawania
  function closeAddUserModal() {
    addUserModal.style.display = 'none';
    addUserForm.reset();
  }

  closeAddUserModalButton.addEventListener('click', closeAddUserModal);
  window.addEventListener('click', (event) => {
    if (event.target === addUserModal) {
      closeAddUserModal();
    }
  });

  // Funkcja otwarcia modala edycji
  function openEditUserModal(user) {
    editUserForm.reset();
    editUserIdField.value = user.id;
    editUserLoginField.value = user.login;
    editUserFirstNameField.value = user.firstName;
    editUserLastNameField.value = user.lastName;
    editUserPeselField.value = user.pesel;

    // Załaduj grupy do selecta -> ustaw grupę usera
    loadPermissionGroupsIntoSelect(editUserPermissionGroupSelect).then(async () => {
      const userGroups = await fetchUserPermissionGroups(user.id);
      if (userGroups && userGroups.length > 0) {
        // Zakładamy, że user ma jedną grupę
        editUserPermissionGroupSelect.value = userGroups[0].id;
      } else {
        editUserPermissionGroupSelect.value = '';
      }
    });

    // Widoczne poradnie
    fetch(`/api/users/${user.id}/visible-clinics`)
      .then(resp => resp.ok ? resp.json() : [])
      .then(visibleClinics => {
        const visibleIds = visibleClinics.map(vc => vc.id);
        loadAllClinicsForForm(editUserClinicsContainer, visibleIds);
      })
      .catch(err => {
        console.error('Błąd ładowania widocznych poradni:', err);
        loadAllClinicsForForm(editUserClinicsContainer, []);
      });

    editUserModal.style.display = 'block';
  }

  // Zamknięcie modala edycji
  function closeEditUserModal() {
    editUserModal.style.display = 'none';
    editUserForm.reset();
  }

  closeEditUserModalButton.addEventListener('click', closeEditUserModal);
  window.addEventListener('click', (event) => {
    if (event.target === editUserModal) {
      closeEditUserModal();
    }
  });

  // Ładowanie listy użytkowników
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
    if (!users || users.length === 0) {
      userList.innerHTML = `
        <tr>
          <td colspan="4">Brak użytkowników do wyświetlenia.</td>
        </tr>
      `;
      return;
    }

    let tableHeader = `
      <tr>
        <th>Login</th>
        <th>Imię</th>
        <th>Nazwisko</th>
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
          <td>
            <button class="edit-button" data-user='${JSON.stringify(user)}'>Edytuj</button>
            <button class="delete-button" data-id="${user.id}">Usuń</button>
            <button onclick="resetPassword(${user.id})">Resetuj Hasło</button>
          </td>
        </tr>
      `;
    });

    userList.innerHTML = tableHeader + tableRows;

    // Obsługa przycisków edycji i usuwania
    document.querySelectorAll('.edit-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const userData = JSON.parse(e.target.getAttribute('data-user'));
        openEditUserModal(userData);
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

  // Obsługa wyszukiwania
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

  // Zapis nowego użytkownika (modal "Dodaj Użytkownika")
  addUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const login = addUserLoginField.value.trim();
    const firstName = addUserFirstNameField.value.trim();
    const lastName = addUserLastNameField.value.trim();
    const pesel = addUserPeselField.value.trim();
    const groupId = addUserPermissionGroupSelect.value;
    const password = addUserPasswordField.value;
    const passwordConfirm = addUserPasswordConfirmField.value;

    // Walidacja PESEL
    if (!/^\d{11}$/.test(pesel)) {
      alert('PESEL musi składać się z 11 cyfr.');
      return;
    }
    // Walidacja hasła
    if (!password || !passwordConfirm) {
      alert('Hasło jest wymagane.');
      return;
    }
    if (password !== passwordConfirm) {
      alert('Hasła nie są zgodne.');
      return;
    }

    // Budujemy obiekt usera
    const userData = {
      login,
      firstName,
      lastName,
      pesel,
      password
    };

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (response.ok) {
        const created = await response.json();
        const newUserId = created.id;
        alert('Dodano nowego użytkownika.');

        // Zapis widocznych poradni
        await saveUserVisibleClinics(newUserId, addUserClinicsContainer);

        // Przypisanie do grupy
        if (groupId) {
          await assignUserToGroups(newUserId, [ parseInt(groupId) ]);
        }

        closeAddUserModal();
        loadUsers(currentUserSearchQuery);
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas dodawania użytkownika:', error);
      alert('Błąd podczas dodawania użytkownika.');
    }
  });

  // Zapis edytowanego użytkownika (modal "Edycja Użytkownika")
  editUserForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = editUserIdField.value;
    const firstName = editUserFirstNameField.value.trim();
    const lastName = editUserLastNameField.value.trim();
    const pesel = editUserPeselField.value.trim();
    const groupId = editUserPermissionGroupSelect.value;

    if (!/^\d{11}$/.test(pesel)) {
      alert('PESEL musi składać się z 11 cyfr.');
      return;
    }

    // Budujemy obiekt do PUT
    const putBody = {
      firstName,
      lastName,
      pesel
    };

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      if (response.ok) {
        alert('Dane użytkownika zostały zaktualizowane.');

        // Zapis widocznych poradni
        await saveUserVisibleClinics(userId, editUserClinicsContainer);

        // Grupa uprawnień
        if (groupId) {
          await assignUserToGroups(userId, [ parseInt(groupId) ]);
        } else {
          // Ewentualnie można wyczyścić
          // await assignUserToGroups(userId, []);
        }

        closeEditUserModal();
        loadUsers(currentUserSearchQuery);
      } else {
        const errorData = await response.json();
        alert(`Błąd: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Błąd podczas edycji użytkownika:', error);
      alert('Błąd podczas edycji użytkownika.');
    }
  });

  // Zapisywanie widocznych poradni
  async function saveUserVisibleClinics(userId, containerEl) {
    const checkboxes = containerEl.querySelectorAll('input[type="checkbox"]');
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

  // Funkcja ładująca listę poradni (checkboxy)
  async function loadAllClinicsForForm(containerEl, visibleIds) {
    try {
      const response = await fetch('/api/clinics');
      if (response.ok) {
        const clinics = await response.json();
        containerEl.innerHTML = '';
        clinics.forEach(c => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = c.id;
          if (visibleIds.includes(c.id)) {
            checkbox.checked = true;
          }
          label.appendChild(checkbox);
          label.append(' ' + c.name);
          containerEl.appendChild(label);
          containerEl.appendChild(document.createElement('br'));
        });
      } else {
        console.error('Błąd ładowania poradni.');
      }
    } catch (error) {
      console.error('Błąd podczas ładowania poradni:', error);
    }
  }

  // Grupy Uprawnień (select)
  async function loadPermissionGroupsIntoSelect(selectEl) {
    try {
      const resp = await fetch('/api/permission-groups');
      if (!resp.ok) {
        throw new Error('Błąd pobierania grup uprawnień.');
      }
      const groups = await resp.json();
      selectEl.innerHTML = '<option value="">--Wybierz--</option>';
      groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        selectEl.appendChild(opt);
      });
    } catch (error) {
      console.error(error);
    }
  }

  // Pobranie grup usera
  async function fetchUserPermissionGroups(userId) {
    try {
      const resp = await fetch(`/api/users/${userId}/all-permissions`);
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.groups || [];
    } catch (error) {
      console.error('fetchUserPermissionGroups:', error);
      return [];
    }
  }

  // Przypisanie usera do wybranych grup
  async function assignUserToGroups(userId, groupIds) {
    try {
      await fetch(`/api/users/${userId}/all-permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groups: groupIds,
          permissions: []
        })
      });
    } catch (error) {
      console.error('assignUserToGroups:', error);
    }
  }

  // Reset hasła (osobny modal)
  const resetPasswordModal = document.getElementById('reset-password-modal');
  const closeResetPasswordModal = document.getElementById('close-reset-password-modal');
  const temporaryPasswordInput = document.getElementById('temporary-password');
  const resetPasswordForm = document.getElementById('reset-password-form');

  // Funkcja globalna, bo wywoływana onclick z tabeli
  window.resetPassword = function(id) {
    resetPasswordModal.style.display = 'block';
    closeResetPasswordModal.onclick = function() {
      resetPasswordModal.style.display = 'none';
      temporaryPasswordInput.value = '';
    };
    window.onclick = function(event) {
      if (event.target === resetPasswordModal) {
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


  // ---------------------------
  // Zarządzanie Poradniami
  // ---------------------------
  async function loadClinics() {
    try {
      const resp = await fetch('/api/clinics');
      if (resp.ok) {
        const data = await resp.json();
        renderClinicList(data);
      } else {
        alert('Błąd podczas pobierania listy poradni.');
      }
    } catch (error) {
      console.error('Błąd podczas pobierania listy poradni:', error);
    }
  }

  function renderClinicList(clinics) {
    const clinicList = document.getElementById('clinic-list');
    if (!clinics || clinics.length === 0) {
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
    clinics.forEach((c) => {
      tableRows += `
        <tr>
          <td>${c.name}</td>
          <td>
            <button class="edit-clinic-button" data-clinic='${JSON.stringify(c)}'>Edytuj</button>
            <button class="delete-clinic-button" data-id="${c.id}">Usuń</button>
          </td>
        </tr>
      `;
    });
    clinicList.innerHTML = tableHeader + tableRows;

    // Obsługa edycji / usuwania
    document.querySelectorAll('.edit-clinic-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const clinicData = JSON.parse(e.target.getAttribute('data-clinic'));
        openClinicModal(clinicData);
      });
    });
    document.querySelectorAll('.delete-clinic-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const clinicId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć tę poradnię?')) {
          try {
            const resp = await fetch(`/api/clinics/${clinicId}`, {
              method: 'DELETE'
            });
            if (resp.ok) {
              alert('Poradnia została usunięta.');
              loadClinics();
            } else {
              const errData = await resp.json();
              alert(`Błąd usuwania poradni: ${errData.message}`);
            }
          } catch (error) {
            console.error('Błąd usuwania poradni:', error);
          }
        }
      });
    });
  }

  const clinicModal = document.getElementById('clinic-modal');
  const closeClinicModalButton = document.getElementById('close-clinic-modal');
  const clinicForm = document.getElementById('clinic-form');
  const clinicIdField = document.getElementById('clinic-id');
  const clinicNameField = document.getElementById('clinic-name');
  const assignedDoctorsTitle = document.getElementById('assigned-doctors-title');
  const assignedDoctorsList = document.getElementById('assigned-doctors-list');
  const addClinicButtonEl = document.getElementById('add-clinic-button');
  let currentClinicId = null;

  const addDoctorToClinicButton = document.getElementById('add-doctor-to-clinic-button');
  const addDoctorToClinicModal = document.getElementById('add-doctor-to-clinic-modal');
  const closeAddDoctorToClinicModalButton = document.getElementById('close-add-doctor-to-clinic-modal');
  const doctorSearchResults = document.getElementById('doctor-search-results');

  addClinicButtonEl.addEventListener('click', () => {
    openClinicModal();
  });

  function openClinicModal(clinic = null) {
    if (clinic) {
      clinicIdField.value = clinic.id;
      clinicNameField.value = clinic.name;
      currentClinicId = clinic.id;

      assignedDoctorsTitle.style.display = 'block';
      assignedDoctorsList.style.display = 'block';
      addDoctorToClinicButton.style.display = 'inline-block';

      loadAssignedDoctors(currentClinicId);
    } else {
      clinicForm.reset();
      clinicIdField.value = '';
      currentClinicId = null;

      assignedDoctorsTitle.style.display = 'none';
      assignedDoctorsList.style.display = 'none';
      addDoctorToClinicButton.style.display = 'none';

      assignedDoctorsList.innerHTML = '';
    }
    clinicModal.style.display = 'block';
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
    if (event.target === clinicModal) {
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
        // Edycja
        response = await fetch(`/api/clinics/${clinicId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } else {
        // Dodawanie
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
    if (!doctors || doctors.length === 0) {
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
    if (event.target === addDoctorToClinicModal) {
      addDoctorToClinicModal.style.display = 'none';
      doctorSearchResults.innerHTML = '';
    }
  });

  function renderDoctorSearchResults(doctors) {
    doctorSearchResults.innerHTML = '';
    if (!doctors || doctors.length === 0) {
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
    const assignedDoctors = await loadAssignedDoctorsForUpdate(currentClinicId);
    const assignedDoctorIds = assignedDoctors.map(d => d.id);

    if (!assignedDoctorIds.includes(doctorId)) {
      assignedDoctorIds.push(doctorId);
    }

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

  async function loadAssignedDoctorsForUpdate(clinicId) {
    const response = await fetch(`/api/clinics/${clinicId}/doctors`);
    if (response.ok) {
      return await response.json();
    } else {
      return [];
    }
  }


  // ---------------------------
  // LOGI SYSTEMOWE
  // ---------------------------
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


  // ---------------------------
  // KONFIGURACJA SYSTEMU
  // ---------------------------
  const systemConfigForm = document.getElementById('system-config-form');
  systemConfigForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const maintenanceMode = document.getElementById('maintenance-mode').value;
    const sessionTimeout = document.getElementById('session-timeout').value;
    const logLevel = document.getElementById('log-level').value;

    try {
      const response = await fetch('/api/system-config', {
        method: 'PUT',
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


  // ---------------------------
  // ZARZĄDZANIE UPRAWNIENIAMI
  // ---------------------------
  // REFS do przycisków, modali i formularzy
  const addPermissionButton = document.getElementById('add-permission-button');
  const permissionModal = document.getElementById('permission-modal');
  const closePermissionModalButton = document.getElementById('close-permission-modal');
  const permissionForm = document.getElementById('permission-form');
  const permissionIdField = document.getElementById('permission-id');
  const permissionNameField = document.getElementById('permission-name');
  const permissionDescField = document.getElementById('permission-desc');
  const permissionModalTitle = document.getElementById('permission-modal-title');

  const addPermissionGroupButton = document.getElementById('add-permission-group-button');
  const permissionGroupModal = document.getElementById('permission-group-modal');
  const closePermissionGroupModalButton = document.getElementById('close-permission-group-modal');
  const permissionGroupForm = document.getElementById('permission-group-form');
  const permissionGroupIdField = document.getElementById('permission-group-id');
  const permissionGroupNameField = document.getElementById('permission-group-name');
  const permissionGroupModalTitle = document.getElementById('permission-group-modal-title');
  const permissionGroupPermissionsContainer = document.getElementById('permission-group-permissions-container');

  // Obsługa kliknięcia "Dodaj Uprawnienie"
  addPermissionButton.addEventListener('click', () => {
    openPermissionModal();
  });

  // Obsługa kliknięcia "Dodaj Grupę"
  addPermissionGroupButton.addEventListener('click', () => {
    openPermissionGroupModal();
  });

  function openPermissionModal(permission = null) {
    if (permission) {
      permissionModalTitle.textContent = 'Edytuj Uprawnienie';
      permissionIdField.value = permission.id;
      permissionNameField.value = permission.name;
      permissionDescField.value = permission.description || '';
    } else {
      permissionModalTitle.textContent = 'Dodaj Uprawnienie';
      permissionForm.reset();
      permissionIdField.value = '';
    }
    permissionModal.style.display = 'block';
  }

  function closePermissionModal() {
    permissionModal.style.display = 'none';
    permissionForm.reset();
    permissionIdField.value = '';
  }

  if (closePermissionModalButton) {
    closePermissionModalButton.addEventListener('click', closePermissionModal);
  }

  window.addEventListener('click', (event) => {
    if (event.target === permissionModal) {
      closePermissionModal();
    }
  });

  // Obsługa submit w formularzu Uprawnienia
  permissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const permId = permissionIdField.value;
    const name = permissionNameField.value.trim();
    const desc = permissionDescField.value.trim();

    if (!name) {
      alert('Nazwa uprawnienia jest wymagana.');
      return;
    }

    try {
      let response;
      if (permId) {
        // Edycja istniejącego
        response = await fetch(`/api/permissions/${permId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: desc }),
        });
      } else {
        // Dodawanie nowego
        response = await fetch('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: desc }),
        });
      }

      if (response.ok) {
        alert(permId ? 'Uprawnienie zaktualizowane.' : 'Dodano uprawnienie.');
        closePermissionModal();
        loadPermissions(); // odśwież listę
      } else {
        const errData = await response.json();
        alert(`Błąd: ${errData.message}`);
      }
    } catch (error) {
      console.error('Błąd zapisu uprawnienia:', error);
      alert('Błąd zapisu uprawnienia.');
    }
  });

  // Obsługa Gru py Uprawnień
  function openPermissionGroupModal(group = null) {
    if (group) {
      permissionGroupModalTitle.textContent = 'Edytuj Grupę Uprawnień';
      permissionGroupIdField.value = group.id;
      permissionGroupNameField.value = group.name;
      loadPermissionsForGroupForm(group.id); 
    } else {
      permissionGroupModalTitle.textContent = 'Dodaj Grupę Uprawnień';
      permissionGroupForm.reset();
      permissionGroupIdField.value = '';
      loadPermissionsForGroupForm(null);
    }
    permissionGroupModal.style.display = 'block';
  }

  function closePermissionGroupModal() {
    permissionGroupModal.style.display = 'none';
    permissionGroupForm.reset();
    permissionGroupIdField.value = '';
  }

  if (closePermissionGroupModalButton) {
    closePermissionGroupModalButton.addEventListener('click', closePermissionGroupModal);
  }

  window.addEventListener('click', (event) => {
    if (event.target === permissionGroupModal) {
      closePermissionGroupModal();
    }
  });

  permissionGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const groupId = permissionGroupIdField.value;
    const name = permissionGroupNameField.value.trim();
    if (!name) {
      alert('Nazwa grupy jest wymagana.');
      return;
    }
    try {
      let response;
      if (groupId) {
        // Edycja
        response = await fetch(`/api/permission-groups/${groupId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      } else {
        // Dodawanie nowej
        response = await fetch('/api/permission-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
      }

      if (response.ok) {
        let updatedGroupId = groupId;
        if (!groupId) {
          const created = await response.json();
          updatedGroupId = created.id;
          alert('Dodano grupę uprawnień.');
        } else {
          alert('Grupa uprawnień zaktualizowana.');
        }
        // Zapis uprawnień w tej grupie
        await savePermissionGroupPermissions(updatedGroupId);
        closePermissionGroupModal();
        loadPermissionGroups();
      } else {
        const errData = await response.json();
        alert(`Błąd: ${errData.message}`);
      }
    } catch (error) {
      console.error('Błąd zapisu grupy uprawnień:', error);
      alert('Błąd zapisu grupy uprawnień.');
    }
  });

  // Pobieranie wszystkich uprawnień i zaznaczanie tych, które dana grupa już ma
  async function loadPermissionsForGroupForm(groupId) {
    let assignedPerms = [];
    if (groupId) {
      // pobierz uprawnienia grupy
      try {
        const groupResp = await fetch(`/api/permission-groups/${groupId}`);
        if (groupResp.ok) {
          const groupData = await groupResp.json();
          assignedPerms = groupData.permissions.map(p => p.id);
        }
      } catch (error) {
        console.error('Błąd pobierania grupy:', error);
      }
    }
    // pobierz wszystkie uprawnienia
    try {
      const resp = await fetch('/api/permissions');
      if (resp.ok) {
        const allPerms = await resp.json();
        permissionGroupPermissionsContainer.innerHTML = '';
        allPerms.forEach(perm => {
          const label = document.createElement('label');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = perm.id;
          if (assignedPerms.includes(perm.id)) {
            checkbox.checked = true;
          }
          label.appendChild(checkbox);
          label.append(' ' + perm.name);
          permissionGroupPermissionsContainer.appendChild(label);
          permissionGroupPermissionsContainer.appendChild(document.createElement('br'));
        });
      } else {
        alert('Błąd pobierania wszystkich uprawnień.');
      }
    } catch (error) {
      console.error('Błąd pobierania wszystkich uprawnień:', error);
    }
  }

  // Zapisywanie checklisty uprawnień w grupie
  async function savePermissionGroupPermissions(groupId) {
    const checkboxes = permissionGroupPermissionsContainer.querySelectorAll('input[type="checkbox"]');
    const selectedPermissions = [];
    checkboxes.forEach(ch => {
      if (ch.checked) selectedPermissions.push(parseInt(ch.value));
    });
    try {
      const resp = await fetch(`/api/permission-groups/${groupId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedPermissions })
      });
      if (!resp.ok) {
        const err = await resp.json();
        alert(`Błąd zapisu uprawnień w grupie: ${err.message}`);
      }
    } catch (error) {
      console.error('Błąd zapisu uprawnień w grupie:', error);
    }
  }

  // Render uprawnień (po pobraniu)
  function renderPermissions(perms) {
    const permissionsList = document.getElementById('permissions-list');
    if (!perms || perms.length === 0) {
      permissionsList.innerHTML = `
        <tr><td colspan="3">Brak uprawnień do wyświetlenia.</td></tr>
      `;
      return;
    }
    let tableHeader = `
      <tr>
        <th>Nazwa</th>
        <th>Opis</th>
        <th>Akcje</th>
      </tr>
    `;
    let tableRows = '';

    perms.forEach((p) => {
      tableRows += `
        <tr>
          <td>${p.name}</td>
          <td>${p.description || ''}</td>
          <td>
            <button class="edit-permission-button" data-perm='${JSON.stringify(p)}'>Edytuj</button>
            <button class="delete-permission-button" data-id="${p.id}">Usuń</button>
          </td>
        </tr>
      `;
    });
    permissionsList.innerHTML = tableHeader + tableRows;

    // Obsługa kliknięć w "Edytuj" / "Usuń"
    document.querySelectorAll('.edit-permission-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const perm = JSON.parse(e.target.getAttribute('data-perm'));
        openPermissionModal(perm);
      });
    });

    document.querySelectorAll('.delete-permission-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const permId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć to uprawnienie?')) {
          try {
            const delResp = await fetch(`/api/permissions/${permId}`, {
              method: 'DELETE'
            });
            if (delResp.ok) {
              alert('Uprawnienie zostało usunięte.');
              loadPermissions();
            } else {
              const errData = await delResp.json();
              alert(`Błąd usuwania uprawnienia: ${errData.message}`);
            }
          } catch (error) {
            console.error('Błąd usuwania uprawnienia:', error);
          }
        }
      });
    });
  }

  // Render grup (po pobraniu)
  function renderPermissionGroups(groups) {
    const permissionGroupsList = document.getElementById('permission-groups-list');
    if (!groups || groups.length === 0) {
      permissionGroupsList.innerHTML = `
        <tr><td colspan="2">Brak grup do wyświetlenia.</td></tr>
      `;
      return;
    }
    let tableHeader = `
      <tr>
        <th>Nazwa Grupy</th>
        <th>Akcje</th>
      </tr>
    `;
    let tableRows = '';

    groups.forEach((g) => {
      tableRows += `
        <tr>
          <td>${g.name}</td>
          <td>
            <button class="edit-permission-group-button" data-group='${JSON.stringify(g)}'>Edytuj</button>
            <button class="delete-permission-group-button" data-id="${g.id}">Usuń</button>
          </td>
        </tr>
      `;
    });
    permissionGroupsList.innerHTML = tableHeader + tableRows;

    // Obsługa "Edytuj" / "Usuń"
    document.querySelectorAll('.edit-permission-group-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const groupData = JSON.parse(e.target.getAttribute('data-group'));
        openPermissionGroupModal(groupData);
      });
    });

    document.querySelectorAll('.delete-permission-group-button').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const groupId = e.target.getAttribute('data-id');
        if (confirm('Czy na pewno chcesz usunąć tę grupę?')) {
          try {
            const delResp = await fetch(`/api/permission-groups/${groupId}`, {
              method: 'DELETE'
            });
            if (delResp.ok) {
              alert('Grupa uprawnień została usunięta.');
              loadPermissionGroups();
            } else {
              const errData = await delResp.json();
              alert(`Błąd usuwania grupy: ${errData.message}`);
            }
          } catch (error) {
            console.error('Błąd usuwania grupy:', error);
          }
        }
      });
    });
  }

  // Funkcje do załadowania uprawnień / grup
  async function loadPermissions() {
    try {
      const response = await fetch('/api/permissions');
      if (response.ok) {
        const perms = await response.json();
        renderPermissions(perms);
      } else {
        alert('Błąd pobierania uprawnień.');
      }
    } catch (error) {
      console.error('Błąd pobierania uprawnień:', error);
    }
  }

  async function loadPermissionGroups() {
    try {
      const response = await fetch('/api/permission-groups');
      if (response.ok) {
        const groups = await response.json();
        renderPermissionGroups(groups);
      } else {
        alert('Błąd pobierania grup uprawnień.');
      }
    } catch (error) {
      console.error('Błąd pobierania grup uprawnień:', error);
    }
  }

  // Na końcu ładujemy listę użytkowników
  loadUsers();
});
