/* --- USERS & 4-DIGIT PIN SECURITY (FIREBASE + LOCAL CACHE) --- */
// Default template for fresh installation / offline initialization
// Real PINs are loaded dynamically from Firebase Database ('users/') and cached locally.
var DEFAULT_USERS = {
  'Youssef': { pin: '0000', role: 'admin', color: 'y' },
  'Kylian':  { pin: '0000', role: 'user',  color: 'k' },
  'Daniël':  { pin: '0000', role: 'user',  color: 'd' },
  'Maja':    { pin: '0000', role: 'user',  color: 'm' },
  'Esther':  { pin: '0000', role: 'user',  color: 'e' },
  'Sven':    { pin: '0000', role: 'user',  color: 's' }
};

var users = JSON.parse(JSON.stringify(DEFAULT_USERS));
try {
  var cachedUsers = localStorage.getItem('cgsa_users_cache');
  if(cachedUsers){
    var parsedU = JSON.parse(cachedUsers);
    if(parsedU && typeof parsedU === 'object' && Object.keys(parsedU).length > 0){
      users = parsedU;
    }
  }
} catch(e){}

var currentUser = 'Youssef';
try {
  var savedCur = localStorage.getItem('wasstraat_user');
  if(savedCur && users[savedCur]) currentUser = savedCur;
  else currentUser = 'Youssef';
} catch(e){}

var pendingUserSwitch = null;
var usersRef = null;

function saveUsersLocally(){
  try {
    localStorage.setItem('cgsa_users_cache', JSON.stringify(users));
  } catch(e){}
}

function syncUsersToFirebase(){
  saveUsersLocally();
  if(usersRef){
    usersRef.set(users).catch(function(err){
      console.warn('Firebase users sync error:', err);
    });
  }
}

function updateUserRolePermissions(){
  var isYoussef = (currentUser === 'Youssef');
  var clearBtn = document.getElementById('clearBtn');
  if(clearBtn){
    clearBtn.style.display = isYoussef ? '' : 'none';
  }
  var adminFooter = document.getElementById('userAdminFooter');
  if(adminFooter){
    adminFooter.style.display = isYoussef ? 'block' : 'none';
  }
}

function renderUserDropdown(){
  var list = document.getElementById('userDropdownList');
  if(!list) return;
  list.innerHTML = '';
  Object.keys(users).forEach(function(name){
    var u = users[name];
    var col = (u && u.color) ? u.color : 'y';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'user-dropdown-item' + (name === currentUser ? ' active' : '');
    btn.dataset.user = name;
    btn.innerHTML = '<span class="user-avatar ' + col + '">' + name.charAt(0).toUpperCase() + '</span>' +
                    '<span class="user-dropdown-name">' + name + '</span>' +
                    '<span class="user-check">&#10003;</span>';
    btn.addEventListener('click', function(e){
      e.preventDefault();
      var userSelectorWrap = document.getElementById('userSelectorWrap');
      if(userSelectorWrap) userSelectorWrap.classList.remove('open');
      requestUserSwitch(name);
    });
    list.appendChild(btn);
  });
}

function setCurrentUser(user){
  if(!users[user]) user = Object.keys(users)[0] || 'Youssef';
  currentUser = user;
  try { localStorage.setItem('wasstraat_user', user); } catch(e){}

  // Update compact topbar badge
  var topbarAvatar = document.getElementById('topbarAvatar');
  var topbarName = document.getElementById('topbarUserName');
  var uData = users[user] || { color: 'y' };
  if(topbarAvatar){
    topbarAvatar.className = 'user-avatar ' + (uData.color || 'y');
    topbarAvatar.textContent = user ? user[0].toUpperCase() : 'Y';
  }
  if(topbarName){
    topbarName.textContent = user;
  }

  // Update active state in dropdown
  document.querySelectorAll('.user-dropdown-item').forEach(function(b){
    b.classList.toggle('active', b.dataset.user === user);
  });

  // Update permissions: Only Youssef can close day and see Admin button
  updateUserRolePermissions();

  showToast('Ingelogd als ' + user);
}

// User dropdown open / close listeners
var userSelectorWrap = document.getElementById('userSelectorWrap');
var currentUserBtn = document.getElementById('currentUserBtn');
if(currentUserBtn && userSelectorWrap){
  currentUserBtn.addEventListener('click', function(e){
    e.stopPropagation();
    userSelectorWrap.classList.toggle('open');
  });
}

document.addEventListener('click', function(e){
  if(userSelectorWrap && !userSelectorWrap.contains(e.target)){
    userSelectorWrap.classList.remove('open');
  }
});

function requestUserSwitch(targetUser){
  if(targetUser === currentUser) return;
  pendingUserSwitch = targetUser;
  var pinModal = document.getElementById('pinModal');
  var pinTitle = document.getElementById('pinModalTitle');
  var pinSub = document.getElementById('pinModalSub');
  var pinInput = document.getElementById('pinInput');
  var pinError = document.getElementById('pinError');
  
  if(pinTitle) pinTitle.textContent = 'Pincode voor ' + targetUser;
  if(pinSub) pinSub.textContent = 'Voer de 4-cijferige pincode in om te wisselen.';
  if(pinError) {
    pinError.style.display = 'none';
    pinError.textContent = '';
  }
  if(pinInput) {
    pinInput.value = '';
    pinInput.classList.remove('error');
    pinInput.style.borderColor = '';
  }
  if(pinModal) pinModal.classList.add('open');
  setTimeout(function(){ if(pinInput) pinInput.focus(); }, 120);
}

/* --- PIN HASHING (SHA-256 VIA WEB CRYPTO API) --- */
async function hashPin(pin){
  if(!pin) return '';
  var clean = pin.toString().trim();
  if(/^[a-f0-9]{64}$/i.test(clean)) return clean; // already SHA-256 hashed
  if(window.crypto && crypto.subtle && window.TextEncoder){
    try {
      var encoder = new TextEncoder();
      var data = encoder.encode('cgsa_salt_v1_' + clean);
      var buffer = await crypto.subtle.digest('SHA-256', data);
      var hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
    } catch(e){}
  }
  var h = 0;
  for(var i = 0; i < clean.length; i++){
    h = ((h << 5) - h) + clean.charCodeAt(i);
    h |= 0;
  }
  return 'hash_' + Math.abs(h);
}

async function verifyPin(entered, expected){
  if(!expected) return false;
  if(expected.length === 4 && entered === expected) return true;
  var enteredHash = await hashPin(entered);
  return enteredHash === expected;
}

async function verifyAndSwitchUser(){
  var pinInput = document.getElementById('pinInput');
  var pinError = document.getElementById('pinError');
  var pinModal = document.getElementById('pinModal');
  if(!pinInput || !pendingUserSwitch) return;

  var entered = pinInput.value.replace(/\D/g, '').trim();
  var expected = (users[pendingUserSwitch] && users[pendingUserSwitch].pin) ? users[pendingUserSwitch].pin : '0000';

  var isValid = await verifyPin(entered, expected);

  if(isValid){
    var u = pendingUserSwitch;
    // Upgrade legacy plain-text PIN to secure SHA-256 hash in storage automatically
    if(users[u] && users[u].pin && users[u].pin.length === 4){
      users[u].pin = await hashPin(entered);
      syncUsersToFirebase();
    }
    setCurrentUser(u);
    if(pinModal) pinModal.classList.remove('open');
    haptic('yes');
    pendingUserSwitch = null;
    pinInput.value = '';
    if(pinError) pinError.style.display = 'none';
  } else {
    if(pinError){
      pinError.textContent = 'Onjuiste pincode!';
      pinError.style.display = 'block';
    }
    pinInput.classList.add('error');
    pinInput.value = '';
    haptic('no');
    setTimeout(function(){
      if(pinInput) {
        pinInput.classList.remove('error');
        pinInput.focus();
      }
    }, 380);
  }
}

var pinModal = document.getElementById('pinModal');
var closePinModalBtn = document.getElementById('closePinModalBtn');
var cancelPinBtn = document.getElementById('cancelPinBtn');
var confirmPinBtn = document.getElementById('confirmPinBtn');
var pinInput = document.getElementById('pinInput');

if(closePinModalBtn){
  closePinModalBtn.addEventListener('click', function(){
    if(pinModal) pinModal.classList.remove('open');
    pendingUserSwitch = null;
  });
}
if(cancelPinBtn){
  cancelPinBtn.addEventListener('click', function(){
    if(pinModal) pinModal.classList.remove('open');
    pendingUserSwitch = null;
  });
}
if(confirmPinBtn){
  confirmPinBtn.addEventListener('click', function(){
    verifyAndSwitchUser();
  });
}
if(pinInput){
  pinInput.addEventListener('input', function(){
    this.value = this.value.replace(/\D/g, '').slice(0, 4);
    var pinError = document.getElementById('pinError');
    if(pinError) pinError.style.display = 'none';
    if(this.value.length === 4){
      setTimeout(verifyAndSwitchUser, 60);
    }
  });
  pinInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){
      verifyAndSwitchUser();
    }
  });
}

/* --- ADMIN PANEL USER MANAGEMENT MODAL LOGIC --- */
var activePinEditingUser = null;

function renderUserAdminList(){
  var container = document.getElementById('adminUserListContainer');
  if(!container) return;
  container.innerHTML = '';

  Object.keys(users).forEach(function(name){
    var u = users[name];
    var col = (u && u.color) ? u.color : 'y';
    var isSelf = (name === 'Youssef');
    var isEditing = (activePinEditingUser === name);

    var row = document.createElement('div');
    row.className = 'admin-user-row';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.style.gap = '4px';

    var topRowHtml = 
      '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
        '<div style="display:flex;align-items:center;gap:9px;min-width:0;">' +
          '<span class="user-avatar ' + col + '">' + name.charAt(0).toUpperCase() + '</span>' +
          '<div style="min-width:0;">' +
            '<div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;">' +
              '<span>' + name + '</span>' +
              (isSelf ? '<span style="font-size:10px;background:color-mix(in srgb,var(--c-accent) 20%,transparent);color:var(--c-accent);padding:1px 6px;border-radius:4px;font-weight:800;">Admin</span>' : '') +
            '</div>' +
            '<div style="font-size:11.5px;color:var(--c-muted);font-family:monospace;letter-spacing:1px;">PIN: ' + (u.pin ? (u.pin.length > 8 ? '•••• (SHA-256 beveiligd)' : '•••• (ongehashed)') : '----') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">' +
          '<button type="button" class="admin-btn-sm" data-action="toggle-pin-edit" data-user="' + name + '">' + (isEditing ? 'Sluiten' : 'Wijzig PIN') + '</button>' +
          (!isSelf ? '<button type="button" class="admin-btn-sm del" data-action="delete-user" data-user="' + name + '" title="Verwijderen">&#128465;&#65039;</button>' : '') +
        '</div>' +
      '</div>';

    var editBoxHtml = '';
    if(isEditing){
      editBoxHtml = 
        '<div class="admin-pin-edit-box">' +
          '<span style="font-size:11px;font-weight:700;color:var(--c-muted);">Nieuwe PIN:</span>' +
          '<input type="password" class="admin-pin-input-sm" id="inlinePinInput_' + name + '" maxlength="4" pattern="[0-9]*" inputmode="numeric" placeholder="••••" value="" />' +
          '<button type="button" class="admin-btn-sm" style="background:var(--c-accent);color:#fff;border-color:var(--c-accent);" data-action="save-pin" data-user="' + name + '">Opslaan</button>' +
          '<button type="button" class="admin-btn-sm" data-action="reset-pin-0000" data-user="' + name + '" title="Zet op 0000">0000</button>' +
        '</div>';
    }

    row.innerHTML = topRowHtml + editBoxHtml;
    container.appendChild(row);
  });

  // Attach handlers
  container.querySelectorAll('[data-action="toggle-pin-edit"]').forEach(function(b){
    b.addEventListener('click', function(){
      var uName = this.dataset.user;
      activePinEditingUser = (activePinEditingUser === uName) ? null : uName;
      renderUserAdminList();
      if(activePinEditingUser){
        var inp = document.getElementById('inlinePinInput_' + activePinEditingUser);
        if(inp) { inp.focus(); inp.select(); }
      }
    });
  });

  container.querySelectorAll('[data-action="save-pin"]').forEach(function(b){
    b.addEventListener('click', async function(){
      var uName = this.dataset.user;
      var inp = document.getElementById('inlinePinInput_' + uName);
      if(!inp) return;
      var newPin = inp.value.trim();
      if(!/^\d{4}$/.test(newPin)){
        alert('De pincode moet exact 4 cijfers zijn (bijv. 1234)!');
        inp.focus();
        return;
      }
      if(users[uName]){
        users[uName].pin = await hashPin(newPin);
        syncUsersToFirebase();
        activePinEditingUser = null;
        renderUserAdminList();
        showToast('Pincode voor ' + uName + ' veilig bijgewerkt!');
      }
    });
  });

  container.querySelectorAll('[data-action="reset-pin-0000"]').forEach(function(b){
    b.addEventListener('click', async function(){
      var uName = this.dataset.user;
      if(users[uName]){
        users[uName].pin = await hashPin('0000');
        syncUsersToFirebase();
        activePinEditingUser = null;
        renderUserAdminList();
        showToast('Pincode voor ' + uName + ' gereset naar 0000');
      }
    });
  });

  container.querySelectorAll('[data-action="delete-user"]').forEach(function(b){
    b.addEventListener('click', function(){
      var uName = this.dataset.user;
      if(uName === 'Youssef'){
        alert('Youssef kan niet worden verwijderd!');
        return;
      }
      if(confirm('Weet je zeker dat je ' + uName + ' wilt verwijderen?')){
        delete users[uName];
        syncUsersToFirebase();
        renderUserDropdown();
        renderUserAdminList();
        showToast(uName + ' verwijderd');
      }
    });
  });
}

function setupAdminPanelEvents(){
  var openBtn = document.getElementById('openUserAdminBtn');
  var modal = document.getElementById('userAdminModal');
  var closeBtn = document.getElementById('closeUserAdminModalBtn');
  var addBtn = document.getElementById('addNewUserBtn');
  var nameInput = document.getElementById('newUserNameInput');
  var pinInput = document.getElementById('newUserPinInput');
  var errDiv = document.getElementById('newUserError');

  if(openBtn && modal){
    openBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var userSelectorWrap = document.getElementById('userSelectorWrap');
      if(userSelectorWrap) userSelectorWrap.classList.remove('open');
      renderUserAdminList();
      if(nameInput) nameInput.value = '';
      if(pinInput) pinInput.value = '';
      if(errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }
      modal.classList.add('open');
    });
  }

  if(closeBtn && modal){
    closeBtn.addEventListener('click', function(){
      modal.classList.remove('open');
    });
  }

  if(addBtn){
    addBtn.addEventListener('click', async function(){
      if(!nameInput || !pinInput) return;
      var name = nameInput.value.trim();
      var pin = pinInput.value.trim();

      if(errDiv) { errDiv.style.display = 'none'; errDiv.textContent = ''; }

      if(!name){
        if(errDiv) { errDiv.textContent = 'Vul een naam in.'; errDiv.style.display = 'block'; }
        return;
      }
      if(users[name]){
        if(errDiv) { errDiv.textContent = 'Er bestaat al een medewerker met deze naam.'; errDiv.style.display = 'block'; }
        return;
      }
      if(!/^\d{4}$/.test(pin)){
        if(errDiv) { errDiv.textContent = 'Pincode moet exact 4 cijfers zijn.'; errDiv.style.display = 'block'; }
        return;
      }

      var colorKeys = ['y', 'k', 'd', 'm', 'e', 's'];
      var existingColors = Object.values(users).map(function(u){ return u.color; });
      var chosenColor = colorKeys.find(function(c){ return !existingColors.includes(c); }) || colorKeys[Math.floor(Math.random() * colorKeys.length)];

      var hashedPin = await hashPin(pin);
      users[name] = {
        pin: hashedPin,
        role: 'user',
        color: chosenColor
      };

      syncUsersToFirebase();
      renderUserDropdown();
      renderUserAdminList();
      nameInput.value = '';
      pinInput.value = '';
      showToast('Medewerker ' + name + ' toegevoegd (met veilige PIN)!');
    });
  }
}

/* --- CLOUD SYNC (FIREBASE REALTIME DATABASE) --- */
var db = null, syncRef = null;
var isRemoteUpdate = false;

function updateSyncStatus(status){
  var dot = document.getElementById('syncDot');
  var badge = document.getElementById('syncStatusBadge');
  if(dot){
    dot.className = 'sync-dot ' + status;
  }
  if(badge){
    badge.className = 'modal-status-badge ' + status;
    badge.textContent = status === 'online' ? '🟢 Online (Verbonden)' :
                        status === 'connecting' ? '🟡 Verbinden...' :
                        status === 'offline' ? '🔴 Offline' : '⚪ Alleen lokaal';
  }
}

function initCloudSync(){
  try {
    var dbUrl = (localStorage.getItem('cgsa_firebase_url') || localStorage.getItem('wasstraat_firebase_url') || '').trim();
    var urlInput = document.getElementById('firebaseDbUrlInput');
    if(urlInput) urlInput.value = dbUrl;
    if(!dbUrl){ updateSyncStatus('local'); return; }
    if(typeof firebase === 'undefined'){ updateSyncStatus('local'); return; }
    if(!firebase.apps.length){ firebase.initializeApp({ databaseURL: dbUrl }); }
    db = firebase.database();
    syncRef = db.ref('wasstraat_state');
    usersRef = db.ref('users');
    updateSyncStatus('connecting');

    // Live sync users & PINs from Firebase
    usersRef.on('value', function(snap){
      var val = snap.val();
      if(val && typeof val === 'object' && Object.keys(val).length > 0){
        users = val;
      } else {
        // First run or empty: seed with DEFAULT_USERS
        usersRef.set(DEFAULT_USERS);
        users = JSON.parse(JSON.stringify(DEFAULT_USERS));
      }
      saveUsersLocally();
      renderUserDropdown();
      var adminModal = document.getElementById('userAdminModal');
      if(adminModal && adminModal.classList.contains('open')){
        renderUserAdminList();
      }
    });

    db.ref('.info/connected').on('value', function(snap){
      updateSyncStatus(snap.val() === true ? 'online' : 'connecting');
    });

    syncRef.on('value', function(snapshot){
      var val = snapshot.val();
      if(!val) return;
      isRemoteUpdate = true;
      try {
        // 1. Sync CGSA-Tracker entries (and legacy roomStates)
        if(Array.isArray(val.entries)){
          stationState.entries = val.entries;
          var convertedRooms = {};
          val.entries.forEach(function(b){ convertedRooms[b.code] = b; });
          stationState.roomStates = convertedRooms;
        } else if(val.roomStates && Object.keys(val.roomStates).length > 0){
          var convertedRooms = {};
          var convertedEntries = [];
          Object.keys(val.roomStates).forEach(function(k){
            var originalCode = k.replace(/_/g, '.');
            var item = val.roomStates[k];
            convertedRooms[originalCode] = item;
            if(item && (item.received || item.processed)){
              convertedEntries.push(item);
            }
          });
          stationState.roomStates = convertedRooms;
          stationState.entries = convertedEntries;
        } else {
          // Cleared / closed day remotely
          stationState.entries = [];
          stationState.roomStates = {};
        }

        if(Array.isArray(val.archive)) {
          stationState.archive = val.archive;
        } else {
          stationState.archive = [];
        }

        saveStationState(true);
        updateStationBadge();

        // 2. Sync Lab Ronde room states (or reset if day closed)
        if(val.lrRooms && Object.keys(val.lrRooms).length > 0){
          var convertedLr = {};
          Object.keys(val.lrRooms).forEach(function(k){
            var originalCode = k.replace(/_/g, '.');
            convertedLr[originalCode] = val.lrRooms[k];
          });
          state.rooms = convertedLr;
          saveState();
        } else {
          if(typeof state !== 'undefined' && state.rooms){
            Object.keys(state.rooms).forEach(function(k){
              if(state.rooms[k]) {
                state.rooms[k].visited = null;
                state.rooms[k].picked = null;
              }
            });
            saveState();
          }
        }

        // 3. Live UI re-renders based on active mode (silently without popup)
        if(appMode === 'station'){
          if(stationState.activeView === 'overzicht') renderStationOverzicht();
          else if(stationState.activeView === 'kamers') renderStationKamers();
          else if(stationState.activeView === 'archief') renderStationArchief();
        } else if(appMode === 'ronde'){
          if(state.activeView === 'home') renderHome();
          else if(state.activeView === 'rooms') renderRooms();
          else if(state.activeView === 'summary') renderSummary();
        }

        // 4. Regular notification only if not a day reset
        if(val.lastActionBy && val.lastActionBy !== currentUser && !val.lastResetAt && (val.entries || val.roomStates)){
          showToast('Live bijgewerkt door ' + val.lastActionBy);
        }
      } catch(e){
        console.error('Remote sync error:', e);
      } finally {
        isRemoteUpdate = false;
      }
    });
  } catch(err){
    console.error('Firebase sync error:', err);
    updateSyncStatus('local');
  }
}

function pushCloudSync(){
  if(!syncRef || isRemoteUpdate) return;
  try {
    var safeRooms = {};
    var hasRooms = false;
    Object.keys(stationState.roomStates || {}).forEach(function(code){
      safeRooms[code.replace(/\./g, '_')] = stationState.roomStates[code];
      hasRooms = true;
    });

    var safeLrRooms = {};
    var hasLrRooms = false;
    Object.keys(state.rooms || {}).forEach(function(code){
      safeLrRooms[code.replace(/\./g, '_')] = state.rooms[code];
      hasLrRooms = true;
    });

    syncRef.update({
      entries: (stationState.entries && stationState.entries.length) ? stationState.entries : null,
      roomStates: hasRooms ? safeRooms : null,
      archive: (stationState.archive && stationState.archive.length) ? stationState.archive : null,
      lrRooms: hasLrRooms ? safeLrRooms : null,
      lastActionBy: currentUser,
      lastActionAt: new Date().toISOString()
    }).catch(function(err){
      console.warn('Firebase push failed:', err);
    });
  } catch(e){
    console.error('pushCloudSync error:', e);
  }
}

var syncStatusBtn = document.getElementById('syncStatusBtn');
var syncModal = document.getElementById('syncModal');
var closeSyncModal = document.getElementById('closeSyncModal') || document.getElementById('closeSyncModalBtn');
var saveDbUrlBtn = document.getElementById('saveDbUrlBtn') || document.getElementById('saveSyncBtn');
var disconnectSyncBtn = document.getElementById('disconnectSyncBtn');

if(syncStatusBtn && syncModal){
  syncStatusBtn.addEventListener('click', function(){ syncModal.classList.add('open'); });
}
if(closeSyncModal && syncModal){
  closeSyncModal.addEventListener('click', function(){ syncModal.classList.remove('open'); });
}
if(saveDbUrlBtn){
  saveDbUrlBtn.addEventListener('click', function(){
    var val = (document.getElementById('firebaseDbUrlInput').value || '').trim();
    if(val && !val.startsWith('https://')){
      alert('Vul een geldige URL in (begint met https://)');
      return;
    }
    localStorage.setItem('wasstraat_firebase_url', val); localStorage.setItem('cgsa_firebase_url', val);
    if(syncModal) syncModal.classList.remove('open');
    showToast('Verbinden met database...');
    initCloudSync();
  });
}
if(disconnectSyncBtn){
  disconnectSyncBtn.addEventListener('click', function(){
    localStorage.removeItem('wasstraat_firebase_url');
    var urlInput = document.getElementById('firebaseDbUrlInput');
    if(urlInput) urlInput.value = '';
    if(syncRef) syncRef.off();
    syncRef = null;
    updateSyncStatus('local');
    if(syncModal) syncModal.classList.remove('open');
    showToast('Cloud sync uitgeschakeld (lokaal)');
  });
}
