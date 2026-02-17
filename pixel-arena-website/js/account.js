// =============== ACCOUNT PAGE LOGIC ===============
// Handles login/signup forms + dashboard rendering.

(function () {
  var api = window.PA_API;

  // ---- DOM refs ----
  var authSection = document.getElementById('auth-section');
  var dashSection = document.getElementById('dashboard-section');
  var loginForm = document.getElementById('login-form');
  var signupForm = document.getElementById('signup-form');
  var authTabs = document.querySelectorAll('.auth-tab');
  var loginPanel = document.getElementById('login-panel');
  var signupPanel = document.getElementById('signup-panel');
  var errorEl = document.getElementById('auth-error');
  var dashUser = document.getElementById('dash-username');
  var charSlots = document.getElementById('char-slots');
  var saveStatus = document.getElementById('save-status');
  var logoutBtn = document.getElementById('logout-btn');
  var syncBtn = document.getElementById('sync-btn');
  var downloadBtn = document.getElementById('download-btn');

  // ---- Init ----
  function init() {
    if (api.isLoggedIn()) {
      showDashboard();
    } else {
      showAuth();
    }
  }

  // ---- Tab switching ----
  authTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      authTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.tab;
      loginPanel.style.display = target === 'login' ? 'block' : 'none';
      signupPanel.style.display = target === 'signup' ? 'block' : 'none';
      clearError();
    });
  });

  // ---- Login ----
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();
    var username = document.getElementById('login-username').value.trim();
    var password = document.getElementById('login-password').value;
    if (!username || !password) return showError('Fill in all fields');

    try {
      setLoading(loginForm, true);
      await api.login(username, password);
      showDashboard();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(loginForm, false);
    }
  });

  // ---- Signup ----
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearError();
    var username = document.getElementById('signup-username').value.trim();
    var password = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;

    if (!username || !password) return showError('Fill in all fields');
    if (password !== confirm) return showError('Passwords do not match');
    if (password.length < 6) return showError('Password must be at least 6 characters');

    try {
      setLoading(signupForm, true);
      await api.signup(username, password);
      showDashboard();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(signupForm, false);
    }
  });

  // ---- Logout ----
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      api.logout();
      showAuth();
    });
  }

  // ---- Sync (upload local save) ----
  if (syncBtn) {
    syncBtn.addEventListener('click', async function () {
      var saveRaw = localStorage.getItem('pixel-arena-save');
      if (!saveRaw) {
        showSaveStatus('No local save data found', 'error');
        return;
      }
      try {
        var saveData = JSON.parse(saveRaw);
        await api.uploadCloudSave(saveData);
        showSaveStatus('Save uploaded to cloud!', 'success');
      } catch (err) {
        showSaveStatus('Upload failed: ' + err.message, 'error');
      }
    });
  }

  // ---- Download cloud save ----
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async function () {
      try {
        var result = await api.loadCloudSave();
        localStorage.setItem('pixel-arena-save', JSON.stringify(result.save));
        showSaveStatus('Cloud save downloaded! Refresh the game to load it.', 'success');
        renderCharacters(result.save);
      } catch (err) {
        showSaveStatus('Download failed: ' + err.message, 'error');
      }
    });
  }

  // ---- Show auth / dashboard ----
  function showAuth() {
    authSection.style.display = 'block';
    dashSection.style.display = 'none';
  }

  async function showDashboard() {
    authSection.style.display = 'none';
    dashSection.style.display = 'block';
    dashUser.textContent = api.getUsername() || 'Player';

    // Try to load cloud save data for display
    try {
      var result = await api.loadCloudSave();
      renderCharacters(result.save);
      showSaveStatus('Cloud save found (updated ' + formatDate(result.updatedAt) + ')', 'success');
    } catch (err) {
      // No cloud save — check local
      var localRaw = localStorage.getItem('pixel-arena-save');
      if (localRaw) {
        try {
          renderCharacters(JSON.parse(localRaw));
          showSaveStatus('Showing local save data. Click "Upload to Cloud" to sync.', '');
        } catch (e) {
          renderNoCharacters();
        }
      } else {
        renderNoCharacters();
      }
    }
  }

  // ---- Render characters ----
  function renderCharacters(save) {
    if (!save || !save.slots || !save.slots.length) {
      renderNoCharacters();
      return;
    }

    var html = '';
    save.slots.forEach(function (slot) {
      var cc = slot.customChar || {};
      var statsHtml = '';

      if (cc.equipment) {
        var eqList = [];
        for (var s in cc.equipment) {
          var item = cc.equipment[s];
          if (item) {
            var name = typeof item === 'string' ? item : (item.baseKey || '—');
            eqList.push(formatGearName(name));
          }
        }
        if (eqList.length) {
          statsHtml += '<div class="char-stats">';
          statsHtml += '<div class="stat-label">Gear</div><div class="stat-value">' + eqList.length + ' items</div>';
          statsHtml += '</div>';
        }
      }

      html += '<div class="char-card">' +
        '<div class="char-name">' + esc(slot.name || 'Hero') + '</div>' +
        '<div class="char-class">' + esc(slot.sprite || 'Unknown') + ' archetype</div>' +
        '<div class="char-stats">' +
          '<div class="stat-label">Ladder Best</div><div class="stat-value">' + (slot.ladderBest || 0) + '</div>' +
          '<div class="stat-label">Dungeon Clears</div><div class="stat-value">' + (slot.dungeonClears || 0) + '</div>' +
          '<div class="stat-label">Followers</div><div class="stat-value">' + (slot.p1Collection ? slot.p1Collection.length : 0) + '</div>' +
          '<div class="stat-label">Dust</div><div class="stat-value">' + (slot.dust || 0) + '</div>' +
        '</div>' +
        statsHtml +
        '</div>';
    });

    // Fill remaining empty slots
    var remaining = 4 - save.slots.length;
    for (var i = 0; i < remaining; i++) {
      html += '<div class="empty-slot">Empty Slot</div>';
    }

    charSlots.innerHTML = html;
  }

  function renderNoCharacters() {
    charSlots.innerHTML = '<div class="empty-slot" style="grid-column:1/-1">No character data found. Play the game to create characters!</div>';
  }

  // ---- Helpers ----
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  function showSaveStatus(msg, type) {
    saveStatus.textContent = msg;
    saveStatus.className = 'alert' + (type ? ' alert-' + type : '');
    saveStatus.style.display = 'block';
  }

  function setLoading(form, loading) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = loading;
  }

  function formatGearName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function formatDate(iso) {
    if (!iso) return 'unknown';
    var d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ---- Boot ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
