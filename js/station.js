/* --- CGSA STATION STATE & METHODS --- */
var stationState = {
  entries: [], // Array of active batch objects
  roomStates: {}, // cached map for fast lookup / compatibility
  archive: [],
  activeView: 'overzicht'
};

function loadStationState(){
  try {
    var s = localStorage.getItem('wasstraat1');
    if(s){
      var p = JSON.parse(s);
      if(Array.isArray(p.entries)){
        stationState.entries = p.entries;
      } else if(p.roomStates && typeof p.roomStates === 'object'){
        // Migrate legacy roomStates into entries array
        stationState.entries = [];
        Object.keys(p.roomStates).forEach(function(code){
          var rs = p.roomStates[code];
          if(rs && (rs.received || rs.processed || (rs.history && rs.history.length))){
            stationState.entries.push({
              id: 'b_' + code.replace(/\./g, '') + '_' + Date.now() + '_' + Math.floor(Math.random()*1000),
              code: code,
              source: rs.pickedUp ? 'ronde' : 'station',
              pickedUp: !!rs.pickedUp,
              pickedUpAt: rs.pickedUpAt || '',
              pickedUpBy: rs.pickedUpBy || '',
              received: true,
              receivedAt: rs.receivedAt || '',
              receivedBy: rs.receivedBy || '',
              processed: !!rs.processed,
              processedAt: rs.processedAt || '',
              processedBy: rs.processedBy || '',
              inSterilization: !!rs.inSterilization,
              sterilizationMethod: rs.sterilizationMethod || '',
              sterilizationStartedAt: rs.sterilizationStartedAt || '',
              sterilizationStartedBy: rs.sterilizationStartedBy || '',
              history: rs.history || []
            });
          }
        });
      } else {
        stationState.entries = [];
      }
      if(p.activeView) stationState.activeView = p.activeView;
      if(p.archive && Array.isArray(p.archive)) stationState.archive = p.archive;
    }
  } catch(e){
    console.error('loadStationState error:', e);
  }
}

function saveStationState(skipCloud){
  try {
    // Keep stationState.roomStates updated as map of latest state per room for backward compatibility
    var rsMap = {};
    (stationState.entries || []).forEach(function(entry){
      rsMap[entry.code] = entry;
    });
    stationState.roomStates = rsMap;

    localStorage.setItem('wasstraat1', JSON.stringify({
      entries: stationState.entries || [],
      roomStates: rsMap,
      activeView: stationState.activeView,
      archive: stationState.archive || []
    }));
  } catch(e){}
  if(!skipCloud && typeof pushCloudSync === 'function') pushCloudSync();
}

function addStationBatch(code, source, user){
  if(!stationState.entries) stationState.entries = [];
  var actingUser = user || currentUser || 'Youssef';
  var now = new Date().toISOString();
  var batchId = 'b_' + code.replace(/\./g, '') + '_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  var isRonde = (source === 'ronde');
  var actionName = isRonde ? 'Opgehaald' : 'Ontvangen';

  var newBatch = {
    id: batchId,
    code: code,
    source: source || 'station', // 'ronde' or 'station'
    received: !isRonde,
    receivedAt: !isRonde ? now : '',
    receivedBy: !isRonde ? actingUser : '',
    pickedUp: isRonde,
    pickedUpAt: isRonde ? now : '',
    pickedUpBy: isRonde ? actingUser : '',
    wasmachine: '',
    wasmachineAt: '',
    wasmachineBy: '',
    droogkast: '',
    droogkastAt: '',
    droogkastBy: '',
    processed: false,
    processedAt: '',
    processedBy: '',
    inSterilization: false,
    sterilizationMethod: '',
    sterilizationStartedAt: '',
    sterilizationStartedBy: '',
    returned: false,
    returnedAt: '',
    returnedBy: '',
    history: [
      { action: actionName, time: now, user: actingUser }
    ]
  };

  stationState.entries.push(newBatch);
  saveStationState();
  updateStationBadge();
  return newBatch;
}

function removeStationBatch(id){
  if(!stationState.entries) return;
  stationState.entries = stationState.entries.filter(function(b){ return b.id !== id; });
  saveStationState();
  updateStationBadge();
}

function getStationBatchById(id){
  if(!stationState.entries) stationState.entries = [];
  return stationState.entries.find(function(b){ return b.id === id; });
}

function getActiveStationBatchesForRoom(code){
  if(!stationState.entries) return [];
  return stationState.entries.filter(function(b){ return b.code === code; });
}

function getStationRoomState(code){
  var batches = getActiveStationBatchesForRoom(code);
  if(batches.length > 0){
    return batches[batches.length - 1];
  }
  return null; // Caller must handle null — do NOT auto-create a batch here
}

function peekStationRoomState(code){
  var batches = getActiveStationBatchesForRoom(code);
  if(batches.length > 0){
    return batches[batches.length - 1];
  }
  return { received: false, processed: false, history: [] };
}

function renderRoomHistoryHtml(s){
  if(s.history && s.history.length){
    return s.history
      .filter(function(ev){ return ev.action !== 'Archief'; })
      .map(function(ev){
        var userStr = ev.user ? ' <span style="font-weight:700;color:var(--c-text);">(' + ev.user + ')</span>' : '';
        return '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">' + ev.action + ':</span><span>' + fmtDateTime(ev.time) + userStr + '</span></div>';
      }).join('');
  }
  var out = '';
  if(s.source === 'ronde' || s.pickedUpAt){
    var puUser = s.pickedUpBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.pickedUpBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">Opgehaald:</span><span>' + fmtDateTime(s.pickedUpAt || s.receivedAt) + puUser + '</span></div>';
  } else if(s.receivedAt){
    var rUser = s.receivedBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.receivedBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">Ontvangen:</span><span>' + fmtDateTime(s.receivedAt) + rUser + '</span></div>';
  }
  if(s.wasmachineAt){
    var wmUser = s.wasmachineBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.wasmachineBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">' + (s.wasmachine || 'In Wasmachine') + ':</span><span>' + fmtDateTime(s.wasmachineAt) + wmUser + '</span></div>';
  }
  if(s.droogkastAt){
    var dkUser = s.droogkastBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.droogkastBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">' + (s.droogkast || 'In Droogkast') + ':</span><span>' + fmtDateTime(s.droogkastAt) + dkUser + '</span></div>';
  }
  if(s.inSterilization && !s.processed){
    var sUser = s.sterilizationStartedBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.sterilizationStartedBy+')</span>' : '';
    var sMethod = s.sterilizationMethod || 'Sterilisator';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">In ' + sMethod + ':</span><span>' + fmtDateTime(s.sterilizationStartedAt) + sUser + '</span></div>';
  }
  if(s.processedAt){
    var pUser = s.processedBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.processedBy+')</span>' : '';
    var pAct = (s.sterilizationMethod && s.sterilizationMethod !== 'Direct') ? ('Gesteriliseerd (' + s.sterilizationMethod + ')') : 'Verwerkt';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">' + pAct + ':</span><span>' + fmtDateTime(s.processedAt) + pUser + '</span></div>';
  }
  if(s.returnedAt){
    var retUser = s.returnedBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.returnedBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">Teruggebracht:</span><span>' + fmtDateTime(s.returnedAt) + retUser + '</span></div>';
  }
  return out;
}

function switchStationView(viewId){
  stationState.activeView = viewId;
  saveStationState(true);
  document.querySelectorAll('.view').forEach(function(el){ el.classList.remove('active'); });
  var target = document.getElementById('view-station-' + viewId);
  if(target) target.classList.add('active');

  document.querySelectorAll('#bottomNavStation .nav-item').forEach(function(b){
    b.classList.toggle('active', b.dataset.stationView === viewId);
  });

  if(viewId === 'overzicht') renderStationOverzicht();
  else if(viewId === 'kamers') renderStationKamers();
  else if(viewId === 'zoeken'){
    var sInp = document.getElementById('stationSearchInput');
    if(sInp) focusSearchInput(sInp);
    doStationSearch();
  }
  else if(viewId === 'archief') renderStationArchief();
}

document.querySelectorAll('#bottomNavStation .nav-item').forEach(function(b){
  b.addEventListener('click', function(){
    var view = this.dataset.stationView;
    switchStationView(view);
    if(view === 'zoeken'){
      var sInp = document.getElementById('stationSearchInput');
      if(sInp) focusSearchInput(sInp);
    }
  });
});

var activeSterilizeBatchId = null;
var activeSterilizeRoomCode = null;

function openSterilizeModal(batchId, code, room){
  activeSterilizeBatchId = batchId;
  activeSterilizeRoomCode = code;
  var modal = document.getElementById('sterilizeModal');
  var sub = document.getElementById('sterilizeModalSub');
  var rule = document.getElementById('sterilizeModalRule');
  if(sub) sub.textContent = 'Kamer ' + fmtCode(code) + ' (' + ((room && room.area) || '') + ')';
  if(rule) rule.textContent = 'Eis: ' + ((room && room.sterile) || '-');
  if(modal) modal.classList.add('open');
}

function closeSterilizeModal(){
  activeSterilizeBatchId = null;
  activeSterilizeRoomCode = null;
  var modal = document.getElementById('sterilizeModal');
  if(modal) modal.classList.remove('open');
}

function chooseSterilizationMethod(method){
  var b = null;
  if(activeSterilizeBatchId){
    b = getStationBatchById(activeSterilizeBatchId);
  } else if(activeSterilizeRoomCode){
    b = getStationRoomState(activeSterilizeRoomCode);
  }
  if(!b){ closeSterilizeModal(); return; } // batch was deleted — close modal silently

  var now = new Date().toISOString();
  if(!b.history) b.history = [];

  if(method === 'Direct'){
    b.inSterilization = false;
    b.sterilizationMethod = 'Direct';
    b.processed = true;
    b.processedAt = now;
    b.processedBy = currentUser;
    b.history.push({ action: 'Verwerkt (Direct)', time: now, user: currentUser });
  } else {
    b.inSterilization = true;
    b.sterilizationMethod = method;
    b.sterilizationStartedAt = now;
    b.sterilizationStartedBy = currentUser;
    b.processed = false;
    b.history.push({ action: 'In ' + method, time: now, user: currentUser });
  }

  haptic('on');
  closeSterilizeModal();
  saveStationState();
  updateStationBadge();
  renderStationOverzicht();
}

var activeWasmachineBatchId = null;
function openWasmachineModal(batchId, code){
  activeWasmachineBatchId = batchId;
  var modal = document.getElementById('wasmachineModal');
  var sub = document.getElementById('wasmachineModalSub');
  if(sub) sub.textContent = 'Kamer ' + fmtCode(code);
  if(modal) modal.classList.add('open');
}

function closeWasmachineModal(){
  activeWasmachineBatchId = null;
  var modal = document.getElementById('wasmachineModal');
  if(modal) modal.classList.remove('open');
}

function chooseWasmachine(num){
  var b = getStationBatchById(activeWasmachineBatchId);
  if(!b){ closeWasmachineModal(); return; }
  var now = new Date().toISOString();
  if(!b.history) b.history = [];
  b.wasmachine = 'Wasmachine ' + num;
  b.wasmachineAt = now;
  b.wasmachineBy = currentUser;
  b.inProgress = true;
  if(!b.receivedBy){
    b.received = true;
    b.receivedAt = now;
    b.receivedBy = currentUser;
    b.history.push({ action: 'Ontvangen', time: now, user: currentUser });
  }
  b.history.push({ action: 'In Wasmachine ' + num, time: now, user: currentUser });
  haptic('on');
  closeWasmachineModal();
  saveStationState();
  updateStationBadge();
  renderStationOverzicht();
  showToast(fmtCode(b.code) + ': in Wasmachine ' + num + ' geplaatst');
}

var activeDroogkastBatchId = null;
function openDroogkastModal(batchId, code){
  activeDroogkastBatchId = batchId;
  var modal = document.getElementById('droogkastModal');
  var sub = document.getElementById('droogkastModalSub');
  if(sub) sub.textContent = 'Kamer ' + fmtCode(code);
  if(modal) modal.classList.add('open');
}

function closeDroogkastModal(){
  activeDroogkastBatchId = null;
  var modal = document.getElementById('droogkastModal');
  if(modal) modal.classList.remove('open');
}

function chooseDroogkast(num){
  var b = getStationBatchById(activeDroogkastBatchId);
  if(!b){ closeDroogkastModal(); return; }
  var now = new Date().toISOString();
  if(!b.history) b.history = [];
  b.droogkast = 'Droogkast ' + num;
  b.droogkastAt = now;
  b.droogkastBy = currentUser;
  b.history.push({ action: 'In Droogkast ' + num, time: now, user: currentUser });
  haptic('on');
  closeDroogkastModal();
  saveStationState();
  updateStationBadge();
  renderStationOverzicht();
  showToast(fmtCode(b.code) + ': in Droogkast ' + num + ' geplaatst');
}

function getElapsedInfo(isoTime, stage){
  if(!isoTime) return { str: '', isReady: false, mins: 0, label: '' };
  var start = new Date(isoTime).getTime();
  if(isNaN(start)) return { str: '', isReady: false, mins: 0, label: '' };
  var diffSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  var mins = Math.floor(diffSec / 60);

  var str = '';
  if(mins < 1) str = '< 1 min';
  else if(mins < 60) str = mins + ' min';
  else {
    var hrs = Math.floor(mins / 60);
    var remMins = mins % 60;
    str = hrs + 'u ' + (remMins < 10 ? '0' : '') + remMins + 'm';
  }

  var isReady = false;
  var label = '';

  if(stage === 'droogkast'){
    // Droogkast: normally 30 to 40 mins
    if(mins >= 35){
      isReady = true;
      label = 'Droogcyclus voltooid (' + str + ', norm 30-40m)';
    } else {
      label = 'In droogkast (' + str + ', duurt 30-40 min)';
    }
  } else if(stage === 'wasmachine'){
    // Wasmachine: normally 40 to 55 mins
    if(mins >= 45){
      isReady = true;
      label = 'Wascyclus voltooid (' + str + ', norm 40-55m)';
    } else {
      label = 'In wasmachine (' + str + ', duurt 40-55 min)';
    }
  } else if(stage === 'autoclaaf'){
    // Autoclaaf: normally 1h15m to 1h20m (75 to 80 mins)
    if(mins >= 75){
      isReady = true;
      label = 'Autoclaafcyclus voltooid (' + str + ', norm ~1u15m)';
    } else {
      label = 'In autoclaaf (' + str + ', duurt ~1u15m-1u20m)';
    }
  } else if(stage === 'hetelucht'){
    // Hetelucht: end of shift, stays overnight until next morning
    if(mins >= 600){ // 10h+
      isReady = true;
      label = 'Hetelucht overnacht voltooid (' + str + ') - klaar voor uitruimen';
    } else {
      label = 'In hetelucht sterilisator (' + str + ', blijft overnacht tot volgende dag)';
    }
  } else if(stage === 'beide'){
    if(mins >= 75){
      isReady = true;
      label = 'Autoclaaf klaar (' + str + ') - Hetelucht blijft overnacht';
    } else {
      label = 'In sterilisatie (Autoclaaf + Hetelucht, ' + str + ')';
    }
  } else {
    label = 'Tijd in huidige stap: ' + str;
  }

  return { str: str, isReady: isReady, mins: mins, label: label };
}

function isBatchReadyToUnload(batch){
  if(!batch || batch.returned || batch.processed) return false;
  if(batch.inSterilization){
    var sm = (batch.sterilizationMethod || '').toLowerCase();
    var stage = 'autoclaaf';
    if(sm.indexOf('hetelucht') !== -1 && sm.indexOf('autoclaaf') === -1 && sm.indexOf('beide') === -1){
      stage = 'hetelucht';
    } else if(sm.indexOf('beide') !== -1){
      stage = 'beide';
    }
    return getElapsedInfo(batch.sterilizationStartedAt, stage).isReady;
  }
  if(batch.droogkast){
    return getElapsedInfo(batch.droogkastAt, 'droogkast').isReady;
  }
  if(batch.wasmachine){
    return getElapsedInfo(batch.wasmachineAt, 'wasmachine').isReady;
  }
  return false;
}

var elapsedTimerInterval = null;
function updateActiveElapsedTimers(){
  var timerEls = document.querySelectorAll('.ov-timer[data-timer-start]');
  if(!timerEls.length) return;
  var anyReadyChange = false;
  timerEls.forEach(function(el){
    var startIso = el.dataset.timerStart;
    var stage = el.dataset.timerStage || '';
    if(startIso){
      var info = getElapsedInfo(startIso, stage);
      el.textContent = info.str;
      var wasReady = el.classList.contains('ready');
      el.classList.toggle('ready', info.isReady);
      if(info.label) el.setAttribute('title', info.label);
      if(wasReady !== info.isReady) anyReadyChange = true;
    }
  });

  if(anyReadyChange){
    var entries = stationState.entries || [];
    var klaarCount = entries.filter(isBatchReadyToUnload).length;
    var cReady = document.getElementById('ovFltReadyCount');
    var bReady = document.querySelector('.ov-filter-btn[data-filter="ready"]');
    if(cReady) cReady.textContent = klaarCount;
    if(bReady) bReady.classList.toggle('has-ready', klaarCount > 0);
    if(activeOverzichtFilter === 'ready'){
      renderStationOverzicht();
    }
  }
}

function startElapsedTimerLoop(){
  if(elapsedTimerInterval) return;
  elapsedTimerInterval = setInterval(updateActiveElapsedTimers, 30000);
}

var activeOverzichtFilter = 'all';

function setOverzichtFilter(filter){
  activeOverzichtFilter = filter;
  document.querySelectorAll('.ov-filter-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderStationOverzicht();
}

var activeOverzichtSort = (function(){
  try { return localStorage.getItem('cgsa_station_sort') || 'time'; } catch(e){ return 'time'; }
})();
var activeOverzichtSortDir = (function(){
  try { return localStorage.getItem('cgsa_station_sort_dir') || 'asc'; } catch(e){ return 'asc'; }
})();

function setOverzichtSort(sortBy){
  if(activeOverzichtSort === sortBy){
    activeOverzichtSortDir = (activeOverzichtSortDir === 'asc') ? 'desc' : 'asc';
  } else {
    activeOverzichtSort = sortBy;
    activeOverzichtSortDir = 'asc';
  }
  try {
    localStorage.setItem('cgsa_station_sort', activeOverzichtSort);
    localStorage.setItem('cgsa_station_sort_dir', activeOverzichtSortDir);
  } catch(e){}
  renderStationOverzicht();
}

function renderStationOverzicht(){
  var entries = stationState.entries || [];
  var sortedEntries = entries.slice().sort(function(a, b){
    if(activeOverzichtSort === 'lab'){
      // Primary: natural alphanumeric sort by room/lab code
      var ca = (a.code || '').trim();
      var cb = (b.code || '').trim();
      var cmp = ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
      if(cmp !== 0){
        return activeOverzichtSortDir === 'desc' ? -cmp : cmp;
      }
      // Secondary: time of reception/pickup
      var ta = a.receivedAt || a.pickedUpAt || '';
      var tb = b.receivedAt || b.pickedUpAt || '';
      if(!ta && !tb) return 0;
      if(!ta) return 1;
      if(!tb) return -1;
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    } else {
      // Primary: time of reception/pickup
      var ta = a.receivedAt || a.pickedUpAt || '';
      var tb = b.receivedAt || b.pickedUpAt || '';
      var cmp = 0;
      if(!ta && !tb) cmp = 0;
      else if(!ta) cmp = -1;
      else if(!tb) cmp = 1;
      else cmp = (ta < tb ? -1 : ta > tb ? 1 : 0);

      if(cmp !== 0){
        return activeOverzichtSortDir === 'desc' ? -cmp : cmp;
      }
      // Secondary: lab code
      var ca = (a.code || '').trim();
      var cb = (b.code || '').trim();
      return ca.localeCompare(cb, undefined, { numeric: true, sensitivity: 'base' });
    }
  });

  var verwerktCount = sortedEntries.filter(function(e){ return e.processed && !e.returned; }).length;
  var teruggebrachtCount = sortedEntries.filter(function(e){ return e.returned; }).length;
  var wasmachineCount = sortedEntries.filter(function(e){ return e.wasmachine && !e.droogkast && !e.inSterilization && !e.processed; }).length;
  var droogkastCount = sortedEntries.filter(function(e){ return e.droogkast && !e.inSterilization && !e.processed; }).length;
  var nieuwCount = sortedEntries.filter(function(e){ return !e.wasmachine && !e.droogkast && !e.inSterilization && !e.processed; }).length;
  var autoclaafCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Autoclaaf'; }).length;
  var heteluchtCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Hetelucht'; }).length;
  var beideCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Beide'; }).length;
  var openCount = sortedEntries.filter(function(e){ return !e.processed; }).length;
  var klaarCount = sortedEntries.filter(isBatchReadyToUnload).length;

  var hkpiRecv = document.getElementById('hkpiOntvangen');
  if(hkpiRecv) hkpiRecv.textContent = sortedEntries.length;
  var hkpiProc = document.getElementById('hkpiVerwerkt');
  if(hkpiProc) hkpiProc.textContent = verwerktCount + teruggebrachtCount;
  var hkpiOpn = document.getElementById('stationHkpiOpen');
  if(hkpiOpn) hkpiOpn.textContent = openCount;
  var countEl = document.getElementById('ovCount');
  if(countEl) countEl.textContent = sortedEntries.length;

  // Update sort buttons active state & dynamic text
  var timeBtn = document.getElementById('ovSortTimeBtn');
  var labBtn = document.getElementById('ovSortLabBtn');
  var timeTxt = document.getElementById('ovSortTimeText');
  var labTxt = document.getElementById('ovSortLabText');
  if(timeBtn && labBtn){
    var isTime = activeOverzichtSort === 'time';
    timeBtn.classList.toggle('active', isTime);
    labBtn.classList.toggle('active', !isTime);
    if(timeTxt){
      timeTxt.textContent = isTime ? (activeOverzichtSortDir === 'desc' ? 'Tijd (nieuwst)' : 'Tijd (oudst)') : 'Tijd';
    }
    if(labTxt){
      labTxt.textContent = !isTime ? (activeOverzichtSortDir === 'desc' ? 'Lab (9-0)' : 'Lab (0-9)') : 'Labnummer';
    }
  }

  // Update filter pill counts
  var cAll = document.getElementById('ovFltAllCount');
  var cReady = document.getElementById('ovFltReadyCount');
  var bReady = document.querySelector('.ov-filter-btn[data-filter="ready"]');
  var cOpen = document.getElementById('ovFltOpenCount');
  var cWas = document.getElementById('ovFltWasmachineCount');
  var cDroog = document.getElementById('ovFltDroogkastCount');
  var cAuto = document.getElementById('ovFltAutoclaafCount');
  var cHete = document.getElementById('ovFltHeteluchtCount');
  var cBeide = document.getElementById('ovFltBeideCount');
  var cDone = document.getElementById('ovFltDoneCount');
  var cRet = document.getElementById('ovFltReturnedCount');
  if(cAll) cAll.textContent = sortedEntries.length;
  if(cReady) cReady.textContent = klaarCount;
  if(bReady) bReady.classList.toggle('has-ready', klaarCount > 0);
  if(cOpen) cOpen.textContent = nieuwCount;
  if(cWas) cWas.textContent = wasmachineCount;
  if(cDroog) cDroog.textContent = droogkastCount;
  if(cAuto) cAuto.textContent = autoclaafCount;
  if(cHete) cHete.textContent = heteluchtCount;
  if(cBeide) cBeide.textContent = beideCount;
  if(cDone) cDone.textContent = verwerktCount;
  if(cRet) cRet.textContent = teruggebrachtCount;

  // Filter based on active tab
  var filtered = sortedEntries.filter(function(e){
    if(activeOverzichtFilter === 'ready'){
      return isBatchReadyToUnload(e);
    } else if(activeOverzichtFilter === 'open'){
      return !e.wasmachine && !e.droogkast && !e.inSterilization && !e.processed;
    } else if(activeOverzichtFilter === 'wasmachine'){
      return e.wasmachine && !e.droogkast && !e.inSterilization && !e.processed;
    } else if(activeOverzichtFilter === 'droogkast'){
      return e.droogkast && !e.inSterilization && !e.processed;
    } else if(activeOverzichtFilter === 'autoclaaf'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Autoclaaf';
    } else if(activeOverzichtFilter === 'hetelucht'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Hetelucht';
    } else if(activeOverzichtFilter === 'beide'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Beide';
    } else if(activeOverzichtFilter === 'processed'){
      return e.processed && !e.returned;
    } else if(activeOverzichtFilter === 'returned'){
      return !!e.returned;
    }
    return true; // 'all'
  });

  var list = document.getElementById('overzichtList');
  if(!list) return;

  if(!filtered.length){
    var emptyMsg = 'Geen items in deze filter.';
    if(sortedEntries.length === 0){
      emptyMsg = 'Nog niets ontvangen. Ga naar Kamers of Lab Ronde om materialen te registreren.';
    } else if(activeOverzichtFilter === 'ready'){
      emptyMsg = 'Geen machines klaar om uit te ruimen.';
    }
    list.innerHTML = '<div class="empty-state">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;margin:0 auto 12px;opacity:.3;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      + emptyMsg + '</div>';
    return;
  }

  list.innerHTML = filtered.map(function(batch){
    var room = getRoomLookup(batch.code);
    var niet = isNietSteriel(room.sterile);
    var isSterile = !niet;
    var mainColor = niet ? 'var(--c-danger)' : 'var(--c-success)';

    // Adjust card tint if currently in sterilization, droogkast, wasmachine, or returned
    if(batch.inSterilization){
      if(batch.sterilizationMethod === 'Hetelucht') mainColor = '#f97316';
      else if(batch.sterilizationMethod === 'Beide') mainColor = '#8b5cf6';
      else mainColor = '#06b6d4';
    } else if(batch.droogkast && !batch.processed){
      mainColor = '#f59e0b';
    } else if(batch.wasmachine && !batch.processed){
      mainColor = '#0284c7';
    } else if(batch.returned){
      mainColor = '#7c3aed';
    }

    var cardBg = 'color-mix(in srgb, ' + mainColor + ' 6%, var(--c-surface))';
    var footerBg = 'color-mix(in srgb, ' + mainColor + ' 12%, var(--c-surface))';
    var badgeBg = 'color-mix(in srgb, ' + mainColor + ' 15%, transparent)';
    var borderCol = 'color-mix(in srgb, ' + mainColor + ' 30%, transparent)';

    // Multi-batch badge if this room has multiple active batches
    var roomBatches = getActiveStationBatchesForRoom(batch.code);
    var batchIndex = roomBatches.findIndex(function(b){ return b.id === batch.id; });
    var batchBadge = (roomBatches.length > 1 && batchIndex >= 0)
      ? '<span style="font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;background:var(--c-surface2);border:1px solid var(--c-border);color:var(--c-muted);">Batch ' + (batchIndex + 1) + '/' + roomBatches.length + '</span>'
      : '';

    // Determine tag
    var tagHtml = '';
    if(batch.returned){
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,#7c3aed 18%,transparent);color:#7c3aed;font-weight:800;">Teruggebracht' + (batch.returnedBy ? ' ('+batch.returnedBy+')' : '') + '</span>';
    } else if(batch.processed){
      var pLabel = (isSterile && batch.sterilizationMethod && batch.sterilizationMethod !== 'Direct')
        ? ('Gesteriliseerd (' + batch.sterilizationMethod + ')')
        : 'Verwerkt';
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,var(--c-success) 18%,transparent);color:var(--c-success);font-weight:800;">' + pLabel + '</span>';
    } else if(batch.inSterilization){
      var sUser = batch.sterilizationStartedBy ? ' (' + batch.sterilizationStartedBy + ')' : '';
      var mText = 'Nu in ' + (batch.sterilizationMethod || 'Sterilisator') + sUser;
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,'+mainColor+' 20%,transparent);color:'+mainColor+';font-weight:800;">' + mText + '</span>';
    } else if(batch.droogkast){
      var dkUser = batch.droogkastBy ? ' (' + batch.droogkastBy + ')' : '';
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,#f59e0b 20%,transparent);color:#d97706;font-weight:800;">Nu in ' + batch.droogkast + dkUser + '</span>';
    } else if(batch.wasmachine){
      var wmUser = batch.wasmachineBy ? ' (' + batch.wasmachineBy + ')' : '';
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,#0284c7 20%,transparent);color:#0284c7;font-weight:800;">Nu in ' + batch.wasmachine + wmUser + '</span>';
    } else {
      tagHtml = '<span class="ov-tag" style="background:'+badgeBg+';color:'+mainColor+';">' + (niet ? 'Niet steriel' : 'Steriel') + '</span>';
    }

    // Determine Action Buttons
    var btnHtml = '';
    if(batch.returned){
      btnHtml = '<div style="display:flex;align-items:center;gap:6px;">'
        + '<button class="teruggebracht-btn done" data-id="'+batch.id+'" data-action="undo-return" title="Klik om terugbrengen ongedaan te maken">Teruggebracht</button>'
        + '</div>';
    } else if(batch.inSterilization){
      btnHtml = '<div style="display:flex;align-items:center;gap:6px;">'
        + '<button class="teruggebracht-btn" data-id="'+batch.id+'" data-action="return">Terugbrengen</button>'
        + '<button class="sterilize-undo-btn" data-id="'+batch.id+'" title="Sterilisatie annuleren" style="background:none;border:none;color:var(--c-muted);font-size:12px;cursor:pointer;padding:4px 6px;">Heropen</button>'
        + '</div>';
    } else if(batch.droogkast){
      if(isSterile){
        btnHtml = '<div style="display:flex;align-items:center;gap:6px;">'
          + '<button class="verwerkt-btn" data-id="'+batch.id+'" data-code="'+batch.code+'">Plaats in sterilisator</button>'
          + '<button class="droog-undo-btn" data-id="'+batch.id+'" title="Droogkast annuleren" style="background:none;border:none;color:var(--c-muted);font-size:12px;cursor:pointer;padding:4px 6px;">Heropen</button>'
          + '</div>';
      } else {
        btnHtml = '<div style="display:flex;align-items:center;gap:6px;">'
          + '<button class="teruggebracht-btn" data-id="'+batch.id+'" data-action="return">Terugbrengen</button>'
          + '<button class="droog-undo-btn" data-id="'+batch.id+'" title="Droogkast annuleren" style="background:none;border:none;color:var(--c-muted);font-size:12px;cursor:pointer;padding:4px 6px;">Heropen</button>'
          + '</div>';
      }
    } else if(batch.wasmachine){
      var wmNum = (batch.wasmachine || '').replace(/\D/g, '') || '1';
      btnHtml = '<div style="display:flex;align-items:center;gap:6px;">'
        + '<button class="droogkast-btn" data-id="'+batch.id+'" data-code="'+batch.code+'" data-num="'+wmNum+'">Plaats in Droogkast '+wmNum+'</button>'
        + '<button class="droogkast-change-btn" data-id="'+batch.id+'" data-code="'+batch.code+'" title="Kies andere droogkast" style="background:none;border:none;color:var(--c-muted);font-size:11px;cursor:pointer;padding:4px 4px;text-decoration:underline;">wijzig</button>'
        + '<button class="was-undo-btn" data-id="'+batch.id+'" title="Wasmachine annuleren" style="background:none;border:none;color:var(--c-muted);font-size:12px;cursor:pointer;padding:4px 6px;">Heropen</button>'
        + '</div>';
    } else {
      btnHtml = '<button class="wasmachine-btn" data-id="'+batch.id+'" data-code="'+batch.code+'">Plaats in wasmachine</button>';
    }

    // Determine active stage timestamp & timer badge
    var activeStartTime = '';
    var activeTimerStage = '';
    if(batch.returned){
      // Returned - no live timer
    } else if(batch.inSterilization){
      activeStartTime = batch.sterilizationStartedAt || '';
      var sm = (batch.sterilizationMethod || '').toLowerCase();
      if(sm.indexOf('hetelucht') !== -1 && sm.indexOf('autoclaaf') === -1 && sm.indexOf('beide') === -1){
        activeTimerStage = 'hetelucht';
      } else if(sm.indexOf('beide') !== -1){
        activeTimerStage = 'beide';
      } else {
        activeTimerStage = 'autoclaaf';
      }
    } else if(batch.droogkast){
      activeStartTime = batch.droogkastAt || '';
      activeTimerStage = 'droogkast';
    } else if(batch.wasmachine){
      activeStartTime = batch.wasmachineAt || '';
      activeTimerStage = 'wasmachine';
    } else {
      activeStartTime = batch.receivedAt || batch.pickedUpAt || '';
      activeTimerStage = 'intake';
    }

    var timerBadge = '';
    if(activeStartTime && !batch.returned){
      var tInfo = getElapsedInfo(activeStartTime, activeTimerStage);
      timerBadge = '<span class="ov-timer' + (tInfo.isReady ? ' ready' : '') + '" data-timer-start="' + activeStartTime + '" data-timer-stage="' + activeTimerStage + '" title="' + (tInfo.label || 'Tijd in huidige stap') + '">' + tInfo.str + '</span>';
    }

    var historyHtml = renderRoomHistoryHtml(batch);

    return '<div class="overzicht-card'+(batch.returned?' returned':batch.processed?' verwerkt':'')+ '" id="ov-'+batch.id+'" style="border:1px solid '+borderCol+'; border-left:5px solid '+mainColor+'; background: '+cardBg+';">'
      + '<div class="overzicht-card-body">'
        + '<div class="ov-badge" style="background:'+badgeBg+';color:'+mainColor+';">'+fmtCode(batch.code)+'</div>'
        + '<div class="ov-info">'
          + '<div class="ov-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
            + '<span class="ov-area">'+(room.area || '')+'</span>'
            + batchBadge
            + tagHtml
            + timerBadge
            + '<button type="button" class="del-batch-btn" data-delete-batch="'+batch.id+'" title="Verwijder batch" style="margin-left:auto;background:none;border:none;color:var(--c-muted);font-size:16px;cursor:pointer;line-height:1;padding:0 4px;opacity:0.6;">&times;</button>'
          + '</div>'
          + '<div class="ov-sterile-rule">'+(room.sterile || '')+'</div>'
          + (room.note && !niet ? '<div class="ov-note" style="border-top:1px solid '+borderCol+';">'+room.note+'</div>' : '')
        + '</div>'
      + '</div>'
      + '<div class="overzicht-card-footer" style="background:'+footerBg+'; border-top:1px solid '+borderCol+';">'
        + '<div class="ov-history-list" style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--c-muted);">'
          + historyHtml
        + '</div>'
        + btnHtml
      + '</div>'
      + '</div>';
  }).join('');

  startElapsedTimerLoop();

  // Event handlers for Wasmachine buttons
  list.querySelectorAll('.wasmachine-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      openWasmachineModal(btn.dataset.id, btn.dataset.code);
    });
  });

  list.querySelectorAll('.was-undo-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var b = getStationBatchById(batchId);
      if(!b) return;
      var now = new Date().toISOString();
      if(!b.history) b.history = [];

      b.wasmachine = '';
      b.wasmachineAt = '';
      b.wasmachineBy = '';
      b.inProgress = false;
      b.history.push({ action: 'Uit wasmachine gehaald', time: now, user: currentUser });
      haptic('off');
      saveStationState();
      updateStationBadge();
      renderStationOverzicht();
      showToast(fmtCode(b.code) + ': uit wasmachine gehaald');
    });
  });

  // Event handlers for Droogkast buttons (Instant 1-tap matching droogkast)
  list.querySelectorAll('.droogkast-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var num = btn.dataset.num;
      if(num){
        activeDroogkastBatchId = batchId;
        chooseDroogkast(num);
      } else {
        openDroogkastModal(batchId, btn.dataset.code);
      }
    });
  });

  list.querySelectorAll('.droogkast-change-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      openDroogkastModal(btn.dataset.id, btn.dataset.code);
    });
  });

  list.querySelectorAll('.droog-undo-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var b = getStationBatchById(batchId);
      if(!b) return;
      var now = new Date().toISOString();
      if(!b.history) b.history = [];

      b.droogkast = '';
      b.droogkastAt = '';
      b.droogkastBy = '';
      b.history.push({ action: 'Uit droogkast gehaald', time: now, user: currentUser });
      haptic('off');
      saveStationState();
      updateStationBadge();
      renderStationOverzicht();
      showToast(fmtCode(b.code) + ': uit droogkast gehaald');
    });
  });

  list.querySelectorAll('.sterilize-undo-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var b = getStationBatchById(batchId);
      if(!b) return;
      var now = new Date().toISOString();
      if(!b.history) b.history = [];

      b.inSterilization = false;
      b.sterilizationMethod = '';
      b.sterilizationStartedAt = '';
      b.sterilizationStartedBy = '';
      b.history.push({ action: 'Sterilisatie geannuleerd', time: now, user: currentUser });
      haptic('off');
      saveStationState();
      updateStationBadge();
      renderStationOverzicht();
      showToast(fmtCode(b.code) + ': sterilisatie geannuleerd');
    });
  });

  list.querySelectorAll('.verwerkt-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var b = getStationBatchById(batchId);
      if(!b) return;
      var room = getRoomLookup(b.code);
      var isSterile = !isNietSteriel(room.sterile);
      var now = new Date().toISOString();
      if(!b.history) b.history = [];

      // 1. If currently in sterilization -> Complete it!
      if(b.inSterilization){
        b.inSterilization = false;
        b.processed = true;
        b.processedAt = now;
        b.processedBy = currentUser;
        var mName = b.sterilizationMethod || 'Sterilisator';
        b.history.push({ action: 'Gesteriliseerd (' + mName + ')', time: now, user: currentUser });
        haptic('on');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
        return;
      }

      // 2. If already processed -> Reopen / undo
      if(b.processed){
        b.processed = false;
        b.returned = false;
        b.inSterilization = false;
        b.reopenedAt = now;
        b.reopenedBy = currentUser;
        b.history.push({ action: 'Heropend', time: now, user: currentUser });
        haptic('off');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
        return;
      }

      // 3. Not processed yet
      if(isSterile){
        openSterilizeModal(b.id, b.code, room);
      } else {
        b.processed = true;
        b.processedAt = now;
        b.processedBy = currentUser;
        b.history.push({ action: 'Verwerkt', time: now, user: currentUser });
        haptic('on');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
      }
    });
  });

  // Event handlers for Teruggebracht buttons -> Moves directly to Archief!
  list.querySelectorAll('.teruggebracht-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var batchId = btn.dataset.id;
      var action = btn.dataset.action;
      var b = getStationBatchById(batchId);
      if(!b) return;
      var now = new Date().toISOString();
      if(!b.history) b.history = [];

      if(action === 'return'){
        var room = getRoomLookup(b.code);
        var archItem = {
          id: b.id,
          code: b.code,
          area: room.area,
          sterile: room.sterile,
          sterilizationMethod: b.sterilizationMethod || '',
          sterilizationStartedAt: b.sterilizationStartedAt || '',
          sterilizationStartedBy: b.sterilizationStartedBy || '',
          source: b.source || 'station',
          history: b.history ? b.history.slice() : [],
          pickedUpAt: b.pickedUpAt || '',
          pickedUpBy: b.pickedUpBy || '',
          receivedAt: b.receivedAt || '',
          receivedBy: b.receivedBy || '',
          wasmachine: b.wasmachine || '',
          wasmachineAt: b.wasmachineAt || '',
          wasmachineBy: b.wasmachineBy || '',
          droogkast: b.droogkast || '',
          droogkastAt: b.droogkastAt || '',
          droogkastBy: b.droogkastBy || '',
          inProgressAt: b.inProgressAt || '',
          inProgressBy: b.inProgressBy || '',
          processedAt: b.processedAt || '',
          processedBy: b.processedBy || '',
          returned: true,
          returnedAt: now,
          returnedBy: currentUser,
          archivedAt: now,
          archivedBy: currentUser
        };
        archItem.history.push({ action: 'Teruggebracht', time: now, user: currentUser });

        if(!stationState.archive) stationState.archive = [];
        stationState.archive.push(archItem);

        // Remove from active entries
        stationState.entries = (stationState.entries || []).filter(function(x){ return x.id !== b.id; });

        haptic('on');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
        if(stationState.activeView === 'archief') renderStationArchief();
        showToast(fmtCode(b.code) + ' teruggebracht en verplaatst naar Archief');
      } else if(action === 'undo-return'){
        b.returned = false;
        b.returnedAt = '';
        b.returnedBy = '';
        b.history.push({ action: 'Terugbrengen ongedaan', time: now, user: currentUser });
        haptic('off');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
        showToast(fmtCode(b.code) + ': terugbrengen ongedaan gemaakt');
      }
    });
  });

  list.querySelectorAll('.del-batch-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var batchId = btn.dataset.deleteBatch;
      var b = getStationBatchById(batchId);
      if(!b) return;
      if(confirm('Weet je zeker dat je deze batch voor kamer ' + fmtCode(b.code) + ' wilt verwijderen?')){
        var code = b.code; // capture before removal
        removeStationBatch(batchId); // already calls saveStationState + updateStationBadge internally
        haptic('off');
        renderStationOverzicht();
        showToast('Batch voor ' + fmtCode(code) + ' verwijderd');
      }
    });
  });
}

// Modal event listeners
var sterilizeModalX = document.getElementById('sterilizeModalX');
var sterilizeCancelBtn = document.getElementById('sterilizeCancelBtn');
var sterilizeDirectDoneBtn = document.getElementById('sterilizeDirectDoneBtn');

if(sterilizeModalX) sterilizeModalX.addEventListener('click', closeSterilizeModal);
if(sterilizeCancelBtn) sterilizeCancelBtn.addEventListener('click', closeSterilizeModal);
if(sterilizeDirectDoneBtn){
  sterilizeDirectDoneBtn.addEventListener('click', function(){
    chooseSterilizationMethod('Direct');
  });
}

document.querySelectorAll('.sterilize-opt-btn').forEach(function(btn){
  btn.addEventListener('click', function(){
    var m = btn.dataset.method;
    chooseSterilizationMethod(m);
  });
});

var wasmachineModalX = document.getElementById('wasmachineModalX');
var wasmachineCancelBtn = document.getElementById('wasmachineCancelBtn');
if(wasmachineModalX) wasmachineModalX.addEventListener('click', closeWasmachineModal);
if(wasmachineCancelBtn) wasmachineCancelBtn.addEventListener('click', closeWasmachineModal);
document.querySelectorAll('[data-wasmachine]').forEach(function(btn){
  btn.addEventListener('click', function(){
    chooseWasmachine(btn.dataset.wasmachine);
  });
});

var droogkastModalX = document.getElementById('droogkastModalX');
var droogkastCancelBtn = document.getElementById('droogkastCancelBtn');
if(droogkastModalX) droogkastModalX.addEventListener('click', closeDroogkastModal);
if(droogkastCancelBtn) droogkastCancelBtn.addEventListener('click', closeDroogkastModal);
document.querySelectorAll('[data-droogkast]').forEach(function(btn){
  btn.addEventListener('click', function(){
    chooseDroogkast(btn.dataset.droogkast);
  });
});

function renderStationKamers(){
  var list = document.getElementById('kamersList');
  if(!list) return;
  var floors = [], floorMap = {};
  allRooms.forEach(function(r){
    var fl = r.code.split('.')[0];
    if(!floorMap[fl]){ floorMap[fl]=[]; floors.push(fl); }
    floorMap[fl].push(r);
  });

  list.innerHTML = floors.map(function(fl){
    var rooms = floorMap[fl];
    var flBatches = 0;
    rooms.forEach(function(r){
      flBatches += getActiveStationBatchesForRoom(r.code).length;
    });

    var rows = rooms.map(function(r){
      var batches = getActiveStationBatchesForRoom(r.code);
      var count = batches.length;
      var niet = isNietSteriel(r.sterile);
      var isRecv = count > 0;
      var btnText = isRecv ? ('&#10003; Ontvangen' + (count > 1 ? ' (' + count + 'x)' : '')) : '+ Ontvangen';

      return '<div class="room-row'+(isRecv?' received':'')+'" id="kr-'+r.code.replace(/\./g,'-')+'">'
        + '<div class="room-dot"></div>'
        + '<div class="room-row-info">'
          + '<div class="room-row-code">'+fmtCode(r.code)+'</div>'
          + '<div class="room-row-area">'+r.area+'</div>'
          + '<div class="room-row-sterile" style="color:'+(niet?'var(--c-danger)':'var(--c-success)')+'">'+r.sterile+'</div>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<button class="recv-btn" data-station-recv="'+r.code+'">'+btnText+'</button>'
          + (isRecv ? '<button type="button" class="recv-cancel-btn" data-station-cancel="'+r.code+'" title="Verwijder laatste batch" style="width:28px;height:28px;border-radius:50%;background:var(--c-surface2);border:1px solid var(--c-border);color:var(--c-muted);font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;line-height:1;">&times;</button>' : '')
        + '</div>'
        + '</div>';
    }).join('');

    return '<div class="floor-group">'
      + '<div class="floor-header">'
        + '<div class="floor-badge">'+fl+'</div>'
        + '<div class="floor-header-info">'
          + '<div class="floor-header-title">Verdieping '+fl+'</div>'
          + '<div class="floor-header-sub">'+flBatches+' geregistreerd</div>'
        + '</div>'
      + '</div>'
      + rows
      + '</div>';
  }).join('');

  list.querySelectorAll('[data-station-recv]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var code = this.dataset.stationRecv;
      // Double-tap guard: block if a batch was added for this room in the last 3 seconds
      var recent = (stationState.entries || []).find(function(b){
        return b.code === code && b.source === 'station' && b.receivedBy === currentUser
          && (Date.now() - new Date(b.receivedAt).getTime()) < 3000;
      });
      if(recent){ showToast('Al geregistreerd — wacht even.'); return; }
      addStationBatch(code, 'station', currentUser);
      haptic('on');
      renderStationKamers();
      showToast(fmtCode(code) + ' geregistreerd als ontvangen');
    });
  });

  list.querySelectorAll('[data-station-cancel]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var code = this.dataset.stationCancel;
      var batches = getActiveStationBatchesForRoom(code);
      if(batches.length > 0){
        var last = batches[batches.length - 1];
        removeStationBatch(last.id);
        haptic('off');
        renderStationKamers();
        showToast('Batch voor ' + fmtCode(code) + ' verwijderd');
      }
    });
  });
}

function doStationSearch(){
  var inp = document.getElementById('stationSearchInput');
  var val = (inp ? inp.value : '').trim().toLowerCase();
  var c = document.getElementById('stationSearchResults');
  if(!c) return;
  if(!val){
    c.innerHTML = '<div class="empty-state">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;margin:0 auto 12px;opacity:.3;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + 'Typ een kamernummer om direct te zoeken</div>';
    return;
  }
  var found = allRooms.filter(function(r){
    var raw = r.code.replace(/\./g,'');
    return raw.startsWith(val) || r.code.startsWith(val);
  });
  if(!found.length){
    c.innerHTML = '<div class="empty-state">Geen kamers gevonden voor "'+val+'"</div>';
    return;
  }
  c.innerHTML = found.map(function(room){
    var batches = getActiveStationBatchesForRoom(room.code);
    var count = batches.length;
    var niet = isNietSteriel(room.sterile);
    var tagBg = niet ? 'color-mix(in srgb,var(--c-danger) 12%,transparent)' : 'color-mix(in srgb,var(--c-success) 12%,transparent)';
    var tagColor = niet ? 'var(--c-danger)' : 'var(--c-success)';
    var isRecv = count > 0;
    var btnText = isRecv ? ('&#10003; Ontvangen' + (count > 1 ? ' (' + count + 'x)' : '')) : '+ Ontvangen';

    return '<div style="background:var(--c-surface);border:1px solid var(--c-border);border-left:4px solid '+(niet?'var(--c-danger)':'var(--c-success)')+';border-radius:var(--r-lg);padding:var(--s4);margin-bottom:var(--s3);">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--s2);">'
        + '<span style="font-size:17px;font-weight:800;">'+fmtCode(room.code)+'</span>'
        + '<div style="display:flex;align-items:center;gap:6px;">'
          + '<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:'+tagBg+';color:'+tagColor+';">'+(niet?'Niet steriel':'Steriel')+'</span>'
          + '<button style="padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;border:1.5px solid '+(isRecv?'var(--c-accent)':'var(--c-border)')+';background:'+(isRecv?'var(--c-accent)':'var(--c-surface2)')+';color:'+(isRecv?'#fff':'var(--c-muted)')+';touch-action:manipulation;" data-search-code="'+room.code+'">'+btnText+'</button>'
          + (isRecv ? '<button type="button" data-search-cancel="'+room.code+'" title="Verwijder laatste batch" style="width:28px;height:28px;border-radius:50%;background:var(--c-surface2);border:1px solid var(--c-border);color:var(--c-muted);font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;line-height:1;">&times;</button>' : '')
        + '</div>'
      + '</div>'
      + '<div style="font-size:12px;color:var(--c-muted);margin-bottom:4px;">'+room.area+'</div>'
      + '<div style="font-size:13px;font-weight:600;">'+room.sterile+'</div>'
      + (room.note && !niet ? '<div style="font-size:12px;color:var(--c-muted);margin-top:6px;padding-top:6px;border-top:1px solid var(--c-border);">'+room.note+'</div>' : '')
      + '</div>';
  }).join('');

  c.querySelectorAll('[data-search-code]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      var code = btn.dataset.searchCode;
      // Double-tap guard: block if a batch was added for this room in the last 3 seconds
      var recentSearch = (stationState.entries || []).find(function(b){
        return b.code === code && b.source === 'station' && b.receivedBy === currentUser
          && (Date.now() - new Date(b.receivedAt).getTime()) < 3000;
      });
      if(recentSearch){ showToast('Al geregistreerd — wacht even.'); return; }
      addStationBatch(code, 'station', currentUser);
      haptic('on');
      showToast(fmtCode(code) + ' geregistreerd als ontvangen');
      var inp = document.getElementById('stationSearchInput');
      if(inp){
        inp.focus();
        setTimeout(function(){
          inp.value = '';
          doStationSearch();
        }, 150);
      }
    });
  });

  c.querySelectorAll('[data-search-cancel]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      var code = btn.dataset.searchCancel;
      var batches = getActiveStationBatchesForRoom(code);
      if(batches.length > 0){
        var last = batches[batches.length - 1];
        removeStationBatch(last.id);
        haptic('off');
        doStationSearch();
        showToast('Batch voor ' + fmtCode(code) + ' verwijderd');
      }
    });
  });
}

var stationSearchInp = document.getElementById('stationSearchInput');
if(stationSearchInp) stationSearchInp.addEventListener('input', doStationSearch);
var clearStationSearch = document.getElementById('clearStationSearch');
if(clearStationSearch) clearStationSearch.addEventListener('click', function(e){
  e.preventDefault();
  if(stationSearchInp) stationSearchInp.value = '';
  doStationSearch();
  if(stationSearchInp) stationSearchInp.focus();
});

function renderStationArchief(){
  var list = document.getElementById('archiefList');
  var arch = stationState.archive || [];
  var countEl = document.getElementById('archiefCount');
  if(countEl) countEl.textContent = arch.length;
  if(!list) return;
  if(!arch.length){
    list.innerHTML = '<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;margin:0 auto 12px;opacity:.3;"><path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/></svg>Geen verwerkte kamers gearchiveerd.</div>';
    return;
  }
  var rev = arch.slice().sort(function(a,b){
    var ta = a.archivedAt || '';
    var tb = b.archivedAt || '';
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  list.innerHTML = rev.map(function(item){
    var historyHtml = renderRoomHistoryHtml(item);
    var niet = isNietSteriel(item.sterile);
    var badgeCol = niet ? 'var(--c-danger)' : 'var(--c-success)';

    return '<div class="room-row" style="flex-direction:column;align-items:flex-start;opacity:0.95;margin-bottom:var(--s2);border-left:4px solid ' + badgeCol + ';">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;width:100%;">'
        + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
          + '<div class="room-row-code">'+fmtCode(item.code)+'</div>'
          + (item.returned
              ? '<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:4px;background:color-mix(in srgb,#7c3aed 16%,transparent);color:#7c3aed;">Teruggebracht' + (item.returnedBy ? ' ('+item.returnedBy+')' : '') + '</span>'
              : '<button class="teruggebracht-btn" data-arch-return="'+item.id+'" style="padding:2px 8px;font-size:11px;">Terugbrengen</button>')
          + '<span style="font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:4px;background:color-mix(in srgb,var(--c-success) 15%,transparent);color:var(--c-success);">Gearchiveerd</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px;">'
          + '<div class="room-row-area">'+(item.area || '')+'</div>'
          + '<button type="button" class="arch-restore-btn" data-restore-id="'+item.id+'" title="Heropenen naar Overzicht" style="background:none;border:none;color:var(--c-muted);font-size:11px;cursor:pointer;padding:2px 4px;text-decoration:underline;">Heropenen</button>'
        + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--c-muted);margin-top:6px;width:100%;">'
        + historyHtml
      + '</div>'
      + '</div>';
  }).join('');

  list.querySelectorAll('[data-arch-return]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id = btn.dataset.archReturn;
      var item = (stationState.archive || []).find(function(a){ return a.id === id; });
      if(!item) return;
      var now = new Date().toISOString();
      item.returned = true;
      item.returnedAt = now;
      item.returnedBy = currentUser;
      if(!item.history) item.history = [];
      item.history.push({ action: 'Teruggebracht', time: now, user: currentUser });
      haptic('on');
      saveStationState();
      renderStationArchief();
      showToast(fmtCode(item.code) + ' gemarkeerd als teruggebracht door ' + currentUser);
    });
  });

  list.querySelectorAll('[data-restore-id]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var id = btn.dataset.restoreId;
      var idx = (stationState.archive || []).findIndex(function(a){ return a.id === id; });
      if(idx === -1) return;
      var item = stationState.archive.splice(idx, 1)[0];
      var now = new Date().toISOString();
      item.returned = false;
      item.returnedAt = '';
      item.returnedBy = '';
      if(!item.history) item.history = [];
      item.history.push({ action: 'Heropend vanuit archief', time: now, user: currentUser });
      if(!stationState.entries) stationState.entries = [];
      stationState.entries.push(item);
      haptic('off');
      saveStationState();
      updateStationBadge();
      renderStationArchief();
      renderStationOverzicht();
      showToast(fmtCode(item.code) + ' heropend en teruggezet naar Overzicht');
    });
  });
}

var archiveBtn = document.getElementById('archiveBtn');
if(archiveBtn){
  archiveBtn.addEventListener('click', function(){
    var toArchive = (stationState.entries || []).filter(function(b){ return b.processed; });
    if(!toArchive.length){
      showToast('Geen verwerkte kamers om te archiveren.');
      return;
    }
    if(!stationState.archive) stationState.archive = [];
    var nowMs = Date.now();
    toArchive.forEach(function(b, i){
      var room = getRoomLookup(b.code);
      var archTime = new Date(nowMs + i).toISOString();
      var archItem = {
        id: b.id,
        code: b.code,
        area: room.area,
        sterile: room.sterile,
        sterilizationMethod: b.sterilizationMethod || '',
        sterilizationStartedAt: b.sterilizationStartedAt || '',
        sterilizationStartedBy: b.sterilizationStartedBy || '',
        source: b.source || 'station',
        history: b.history ? b.history.slice() : [],
        pickedUpAt: b.pickedUpAt || '',
        pickedUpBy: b.pickedUpBy || '',
        receivedAt: b.receivedAt || '',
        receivedBy: b.receivedBy || '',
        wasmachine: b.wasmachine || '',
        wasmachineAt: b.wasmachineAt || '',
        wasmachineBy: b.wasmachineBy || '',
        droogkast: b.droogkast || '',
        droogkastAt: b.droogkastAt || '',
        droogkastBy: b.droogkastBy || '',
        inProgressAt: b.inProgressAt || '',
        inProgressBy: b.inProgressBy || '',
        processedAt: b.processedAt || '',
        processedBy: b.processedBy || '',
        returned: !!b.returned,
        returnedAt: b.returnedAt || '',
        returnedBy: b.returnedBy || '',
        archivedAt: archTime,
        archivedBy: currentUser
      };
      stationState.archive.push(archItem);
    });

    // Remove archived batches from active entries
    var archivedIds = {};
    toArchive.forEach(function(b){ archivedIds[b.id] = true; });
    stationState.entries = (stationState.entries || []).filter(function(b){ return !archivedIds[b.id]; });

    haptic('on');
    saveStationState();
    updateStationBadge();
    renderStationOverzicht();
    if(stationState.activeView === 'archief') renderStationArchief();
    showToast(toArchive.length + ' batches gearchiveerd');
  });
}

// Filter pill click listeners
document.querySelectorAll('.ov-filter-btn').forEach(function(b){
  b.addEventListener('click', function(){
    setOverzichtFilter(this.dataset.filter);
  });
});

// Sort button click listeners
var ovSortTimeBtn = document.getElementById('ovSortTimeBtn');
if(ovSortTimeBtn){
  ovSortTimeBtn.addEventListener('click', function(){
    setOverzichtSort('time');
  });
}
var ovSortLabBtn = document.getElementById('ovSortLabBtn');
if(ovSortLabBtn){
  ovSortLabBtn.addEventListener('click', function(){
    setOverzichtSort('lab');
  });
}

var clearBtn = document.getElementById('clearBtn');
if(clearBtn){
  clearBtn.addEventListener('click', function(){
    if(currentUser !== 'Youssef'){
      showToast('Alleen Youssef kan de week afsluiten.');
      return;
    }
    
    // Update live preview in closeDayModal
    var records = getTodayExportRecords();
    if(!Array.isArray(records)) records = Object.values(records);
    var recCount = records.length;
    var sterCount = 0;
    records.forEach(function(r){
      var isSterile = !isNietSteriel(r.sterile);
      var isSterilizedOrInProcess = (r.status && (r.status.indexOf('Gesteriliseerd') >= 0 || r.status.indexOf('In ') === 0));
      if(isSterilizedOrInProcess || isSterile){
        sterCount++;
      }
    });

    var sumEl = document.getElementById('closeDaySummaryText');
    var brkEl = document.getElementById('closeDayBreakdownText');
    if(sumEl) sumEl.textContent = recCount + ' geregistreerde batches deze week';
    if(brkEl){
      brkEl.textContent = recCount > 0 
        ? (sterCount + ' gesteriliseerd · ' + Math.max(0, recCount - sterCount) + ' niet-steriel verwerkt')
        : 'Geen batches geregistreerd deze week';
    }

    var modal = document.getElementById('closeDayModal');
    if(modal) modal.classList.add('open');
  });
}

/* --- EXPORT TO EXCEL & DAG AFSLUITEN WORKFLOW --- */
function escapeCsv(val){
  if(val == null) return '';
  var str = String(val);
  if(str.indexOf(';') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0 || str.indexOf('\r') >= 0){
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function getRoomLookup(code){
  var found = allRooms.find(function(r){ return r.code === code; });
  return found || { code: code, area: '', sterile: '' };
}

function parseExportRecord(batchOrItem, isArchive){
  var code = batchOrItem.code;
  var info = getRoomLookup(code);
  var sterileRule = batchOrItem.sterile || info.sterile || '';
  var isSterile = !isNietSteriel(sterileRule);

  var opgehaaldDoor = '';
  var opgehaaldTijd = '';
  var ontvangenDoor = '';
  var ontvangenTijd = '';
  var wasmachineName = batchOrItem.wasmachine || '';
  var wasmachineTijd = batchOrItem.wasmachineAt ? fmtDateTime(batchOrItem.wasmachineAt).split(' ')[0] : '';
  var wasmachineDoor = batchOrItem.wasmachineBy || '';
  var droogkastName = batchOrItem.droogkast || '';
  var droogkastTijd = batchOrItem.droogkastAt ? fmtDateTime(batchOrItem.droogkastAt).split(' ')[0] : '';
  var droogkastDoor = batchOrItem.droogkastBy || '';
  var sterilisatieMethod = batchOrItem.sterilizationMethod || '';
  var sterilisatieTijd = batchOrItem.sterilizationStartedAt ? fmtDateTime(batchOrItem.sterilizationStartedAt).split(' ')[0] : '';
  var sterilisatieDoor = batchOrItem.sterilizationStartedBy || '';
  var verwerktDoor = batchOrItem.processedBy || '';
  var verwerktTijd = batchOrItem.processedAt ? fmtDateTime(batchOrItem.processedAt).split(' ')[0] : '';
  var teruggebrachtDoor = batchOrItem.returnedBy || '';
  var teruggebrachtTijd = batchOrItem.returnedAt ? fmtDateTime(batchOrItem.returnedAt).split(' ')[0] : '';

  // Scan through history for precise actions and timestamps
  if(batchOrItem.history && batchOrItem.history.length){
    batchOrItem.history.forEach(function(ev){
      if(ev.action === 'Opgehaald' && !opgehaaldDoor){
        opgehaaldDoor = ev.user || '';
        opgehaaldTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
      }
      if(ev.action === 'Ontvangen' && !ontvangenDoor){
        ontvangenDoor = ev.user || '';
        ontvangenTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
      }
      if(ev.action.indexOf('In Wasmachine') === 0 && !wasmachineTijd){
        var wmMatch = ev.action.match(/In (Wasmachine \d)/);
        if(wmMatch) wasmachineName = wmMatch[1];
        wasmachineTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        wasmachineDoor = ev.user || '';
      }
      if(ev.action.indexOf('In Droogkast') === 0 && !droogkastTijd){
        var dkMatch = ev.action.match(/In (Droogkast \d)/);
        if(dkMatch) droogkastName = dkMatch[1];
        droogkastTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        droogkastDoor = ev.user || '';
      }
      if((ev.action.indexOf('In Autoclaaf') === 0 || ev.action.indexOf('In Hetelucht') === 0 || ev.action.indexOf('In Beide') === 0) && !sterilisatieTijd){
        var stMatch = ev.action.match(/In (.+)/);
        if(stMatch) sterilisatieMethod = stMatch[1];
        sterilisatieTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        sterilisatieDoor = ev.user || '';
      }
      if(ev.action.indexOf('Gesteriliseerd') >= 0 && !sterilisatieMethod){
        var gMatch = ev.action.match(/Gesteriliseerd \((.+)\)/);
        if(gMatch) sterilisatieMethod = gMatch[1];
        if(!sterilisatieTijd && ev.time){
          sterilisatieTijd = fmtDateTime(ev.time).split(' ')[0];
          sterilisatieDoor = ev.user || '';
        }
      }
      if(ev.action === 'Verwerkt (Direct)' && !sterilisatieMethod){
        sterilisatieMethod = 'Direct';
        if(!sterilisatieTijd && ev.time) sterilisatieTijd = fmtDateTime(ev.time).split(' ')[0];
      }
      if(ev.action === 'Verwerkt' && !verwerktDoor){
        verwerktDoor = ev.user || '';
        verwerktTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
      }
      if(ev.action === 'Teruggebracht' && !teruggebrachtDoor){
        teruggebrachtDoor = ev.user || '';
        teruggebrachtTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
      }
    });
  }

  // Fallbacks to top-level properties
  if(!opgehaaldDoor && batchOrItem.pickedUpBy){
    opgehaaldDoor = batchOrItem.pickedUpBy;
    opgehaaldTijd = batchOrItem.pickedUpAt ? fmtDateTime(batchOrItem.pickedUpAt).split(' ')[0] : '';
  }
  if(!ontvangenDoor && batchOrItem.receivedBy){
    ontvangenDoor = batchOrItem.receivedBy;
    ontvangenTijd = batchOrItem.receivedAt ? fmtDateTime(batchOrItem.receivedAt).split(' ')[0] : '';
  }
  if(!wasmachineDoor && batchOrItem.wasmachineBy){
    wasmachineDoor = batchOrItem.wasmachineBy;
    wasmachineTijd = batchOrItem.wasmachineAt ? fmtDateTime(batchOrItem.wasmachineAt).split(' ')[0] : '';
  }
  if(!droogkastDoor && batchOrItem.droogkastBy){
    droogkastDoor = batchOrItem.droogkastBy;
    droogkastTijd = batchOrItem.droogkastAt ? fmtDateTime(batchOrItem.droogkastAt).split(' ')[0] : '';
  }
  if(!sterilisatieDoor && batchOrItem.sterilizationStartedBy){
    sterilisatieDoor = batchOrItem.sterilizationStartedBy;
    sterilisatieTijd = batchOrItem.sterilizationStartedAt ? fmtDateTime(batchOrItem.sterilizationStartedAt).split(' ')[0] : '';
  }
  if(!verwerktDoor && batchOrItem.processedBy){
    verwerktDoor = batchOrItem.processedBy;
    verwerktTijd = batchOrItem.processedAt ? fmtDateTime(batchOrItem.processedAt).split(' ')[0] : '';
  }
  if(!teruggebrachtDoor && (batchOrItem.returnedBy || batchOrItem.returned)){
    teruggebrachtDoor = batchOrItem.returnedBy || '';
    teruggebrachtTijd = batchOrItem.returnedAt ? fmtDateTime(batchOrItem.returnedAt).split(' ')[0] : '';
  }

  var primaryIso = batchOrItem.receivedAt || batchOrItem.pickedUpAt || batchOrItem.wasmachineAt || batchOrItem.droogkastAt || batchOrItem.inProgressAt || batchOrItem.processedAt || batchOrItem.returnedAt || (isArchive ? batchOrItem.archivedAt : '') || '';

  var pickedByFormatted = (opgehaaldDoor && opgehaaldDoor !== '-')
    ? (opgehaaldDoor + (opgehaaldTijd ? ' om ' + opgehaaldTijd : ''))
    : '-';
  var receivedByFormatted = (ontvangenDoor && ontvangenDoor !== '-')
    ? (ontvangenDoor + (ontvangenTijd ? ' om ' + ontvangenTijd : ''))
    : '-';
  var wasmachineFormatted = wasmachineName
    ? (wasmachineName + (wasmachineTijd ? ' om ' + wasmachineTijd : '') + (wasmachineDoor ? ' (' + wasmachineDoor + ')' : ''))
    : '-';
  var droogkastFormatted = droogkastName
    ? (droogkastName + (droogkastTijd ? ' om ' + droogkastTijd : '') + (droogkastDoor ? ' (' + droogkastDoor + ')' : ''))
    : '-';
  var sterilizeFormatted = '-';
  if(sterilisatieMethod){
    sterilizeFormatted = sterilisatieMethod + (sterilisatieTijd ? ' om ' + sterilisatieTijd : '') + (sterilisatieDoor ? ' (' + sterilisatieDoor + ')' : '');
  } else if(!isSterile){
    sterilizeFormatted = 'N.v.t. (niet steriel)';
  }

  var processedByFormatted = (verwerktDoor && verwerktDoor !== '-')
    ? (verwerktDoor + (verwerktTijd ? ' om ' + verwerktTijd : ''))
    : '-';
  var returnedByFormatted = (teruggebrachtDoor && teruggebrachtDoor !== '-')
    ? (teruggebrachtDoor + (teruggebrachtTijd ? ' om ' + teruggebrachtTijd : ''))
    : '-';

  var statusStr = 'Ontvangen';
  if(batchOrItem.returned || teruggebrachtDoor){
    statusStr = 'Teruggebracht';
  } else if(batchOrItem.processed){
    if(sterilisatieMethod && sterilisatieMethod !== 'Direct'){
      statusStr = 'Gesteriliseerd (' + sterilisatieMethod + ')';
    } else if(sterilisatieMethod === 'Direct'){
      statusStr = 'Gesteriliseerd (Direct)';
    } else if(isSterile){
      statusStr = 'Gesteriliseerd';
    } else {
      statusStr = 'Verwerkt';
    }
  } else if(batchOrItem.inSterilization){
    statusStr = 'In ' + (batchOrItem.sterilizationMethod || 'Sterilisator');
  } else if(batchOrItem.droogkast){
    statusStr = batchOrItem.droogkast;
  } else if(batchOrItem.wasmachine){
    statusStr = batchOrItem.wasmachine;
  } else if(batchOrItem.inProgress){
    statusStr = 'In behandeling';
  } else if(batchOrItem.source === 'ronde' || batchOrItem.pickedUp){
    statusStr = 'Opgehaald';
  } else if(isArchive){
    statusStr = 'Gearchiveerd';
  }

  var dateVal = (isArchive && batchOrItem.archivedAt)
    ? new Date(batchOrItem.archivedAt).toLocaleDateString('nl-NL')
    : (primaryIso ? new Date(primaryIso).toLocaleDateString('nl-NL') : new Date().toLocaleDateString('nl-NL'));

  var timeVal = opgehaaldTijd || ontvangenTijd || wasmachineTijd || droogkastTijd || verwerktTijd || teruggebrachtTijd || '';

  return {
    iso: primaryIso,
    date: dateVal,
    time: timeVal,
    receivedTime: ontvangenTijd,
    code: code,
    area: info.area || batchOrItem.area || '',
    sterile: sterileRule || '-',
    isSterile: isSterile,
    status: statusStr,
    pickedBy: pickedByFormatted,
    receivedBy: receivedByFormatted,
    wasmachineInfo: wasmachineFormatted,
    droogkastInfo: droogkastFormatted,
    sterilizeInfo: sterilizeFormatted,
    processedBy: processedByFormatted,
    returnedBy: returnedByFormatted,
    pickedByName: opgehaaldDoor || '-',
    receivedByName: ontvangenDoor || '-',
    wasmachineByName: wasmachineDoor || '-',
    droogkastByName: droogkastDoor || '-',
    sterilizeByName: sterilisatieDoor || '-',
    processedByName: verwerktDoor || '-',
    returnedByName: teruggebrachtDoor || '-'
  };
}

function getTodayExportRecords(){
  var records = [];

  (stationState.archive || []).forEach(function(item){
    records.push(parseExportRecord(item, true));
  });

  (stationState.entries || []).forEach(function(b){
    records.push(parseExportRecord(b, false));
  });

  return records;
}

function getIsoWeekNumber(d){
  var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function exportWeekToExcel(){
  var records = getTodayExportRecords();
  if(!Array.isArray(records)) records = Object.values(records);

  if(!records.length){
    showToast('Geen geregistreerde kamers deze week om te exporteren.');
    return false;
  }

  // Sort chronologically: by date then time (from early to later)
  records.sort(function(a, b){
    if(a.iso && b.iso){
      return a.iso.localeCompare(b.iso);
    }
    var dComp = (a.date || '').localeCompare(b.date || '');
    if(dComp !== 0) return dComp;
    var tComp = (a.time || '').localeCompare(b.time || '');
    if(tComp !== 0) return tComp;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });

  var weekNum = getIsoWeekNumber(new Date());
  var todayStr = new Date().toLocaleDateString('nl-NL').replace(/\//g, '-');
  var headersWeek = [
    'Datum',
    'Tijd',
    'Kamer',
    'Status',
    'Opgehaald door',
    'Ontvangen door',
    'Wasmachine',
    'Droogkast',
    'Sterilisatie',
    'Teruggebracht door'
  ];

  // 1. Native Excel (.xlsx) Export via SheetJS when available
  if(typeof XLSX !== 'undefined'){
    try {
      var fullDateStr = new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var nowTimeStr = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

      var nonSterileCount = records.filter(function(r){
        return r.isSterile === false || isNietSteriel(r.sterile) || (r.status === 'Verwerkt' && !/gesteriliseerd/i.test(r.status));
      }).length;
      var sterileCount = records.length - nonSterileCount;
      var returnedCount = records.filter(function(r){ return r.returnedByName && r.returnedByName !== '-'; }).length;

      // --- SHEET 1: DETAIL WEEKRAPPORT ---
      var sheet1Rows = [
        ['CGSA WORKFLOW - WEEKRAPPORT (WEEK ' + weekNum + ')'],
        ['Datum:', fullDateStr, 'Tijd:', nowTimeStr],
        ['Geëxporteerd door:', currentUser, 'Totaal geregistreerd deze week:', records.length],
        [], // spacing row
        headersWeek
      ];

      records.forEach(function(r){
        sheet1Rows.push([
          r.date,
          r.time,
          fmtCode(r.code),
          r.status,
          r.pickedBy,
          r.receivedBy,
          r.wasmachineInfo,
          r.droogkastInfo,
          r.sterilizeInfo,
          r.returnedBy
        ]);
      });

      // KPI Summary rows at the end of the sheet
      sheet1Rows.push([]);
      sheet1Rows.push(['', '', '--- SAMENVATTING WEEK ---', '', '', '', '', '', '', '']);
      sheet1Rows.push(['', '', 'TOTAAL GEREGISTREERD:', records.length, '', '', '', '', '', '']);
      sheet1Rows.push(['', '', 'Steriel:', sterileCount, '', '', '', '', '', '']);
      sheet1Rows.push(['', '', 'Niet steriel:', nonSterileCount, '', '', '', '', '', '']);
      sheet1Rows.push(['', '', 'Teruggebracht naar lab:', returnedCount, '', '', '', '', '', '']);

      var wb = XLSX.utils.book_new();
      var ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);

      // Dynamic Auto-fit Column Widths for Sheet 1
      var colWidths1 = headersWeek.map(function(h, colIdx){
        var maxLen = h.length;
        records.forEach(function(r){
          var val = [r.date, r.time, fmtCode(r.code), r.status, r.pickedBy, r.receivedBy, r.wasmachineInfo, r.droogkastInfo, r.sterilizeInfo, r.returnedBy][colIdx] || '';
          if(String(val).length > maxLen) maxLen = String(val).length;
        });
        return { wch: Math.max(maxLen + 4, 12) };
      });
      colWidths1[0].wch = Math.max(colWidths1[0].wch, 14);
      colWidths1[3].wch = Math.max(colWidths1[3].wch, 20);
      colWidths1[6].wch = Math.max(colWidths1[6].wch, 26);
      colWidths1[7].wch = Math.max(colWidths1[7].wch, 26);
      colWidths1[8].wch = Math.max(colWidths1[8].wch, 26);
      ws1['!cols'] = colWidths1;

      XLSX.utils.book_append_sheet(wb, ws1, "Weekrapport");

      // --- SHEET 2: ONTVANGEN DETAIL ---
      var headersOntvangen = [
        'Datum',
        'Tijd Ontvangen',
        'Kamer',
        'Ontvangen door',
        'Opgehaald door',
        'Wasmachine',
        'Droogkast',
        'Sterilisatie',
        'Status'
      ];

      var sheetOntvangenRows = [
        ['CGSA WORKFLOW - ONTVANGEN MATERIALEN (WEEK ' + weekNum + ')'],
        ['Datum:', fullDateStr, 'Tijd:', nowTimeStr],
        ['Overzicht van alle ontvangen kamers en hun verdere verwerking'],
        [],
        headersOntvangen
      ];

      var receivedRecords = records.filter(function(r){
        return (r.receivedByName && r.receivedByName !== '-') || r.receivedTime;
      });
      if(!receivedRecords.length) receivedRecords = records.slice();

      receivedRecords.forEach(function(r){
        sheetOntvangenRows.push([
          r.date,
          r.receivedTime || r.time,
          fmtCode(r.code),
          r.receivedBy,
          r.pickedBy,
          r.wasmachineInfo,
          r.droogkastInfo,
          r.sterilizeInfo,
          r.status
        ]);
      });

      sheetOntvangenRows.push([]);
      sheetOntvangenRows.push(['', '', 'TOTAAL ONTVANGEN:', receivedRecords.length]);

      var wsOntvangen = XLSX.utils.aoa_to_sheet(sheetOntvangenRows);
      var colWidthsOntvangen = headersOntvangen.map(function(h, colIdx){
        var maxLen = h.length;
        receivedRecords.forEach(function(r){
          var val = [r.date, r.receivedTime || r.time, fmtCode(r.code), r.receivedBy, r.pickedBy, r.wasmachineInfo, r.droogkastInfo, r.sterilizeInfo, r.status][colIdx] || '';
          if(String(val).length > maxLen) maxLen = String(val).length;
        });
        return { wch: Math.max(maxLen + 4, 14) };
      });
      wsOntvangen['!cols'] = colWidthsOntvangen;
      XLSX.utils.book_append_sheet(wb, wsOntvangen, "Ontvangen");

      // --- SHEET 3: MEDEWERKERS & STATISTIEKEN ---
      var staffStats = {};
      records.forEach(function(r){
        var pName = r.pickedByName;
        var recvName = r.receivedByName;
        var wmName = r.wasmachineByName;
        var dkName = r.droogkastByName;
        var stName = r.sterilizeByName;
        var retName = r.returnedByName;

        function ensure(u){
          if(!staffStats[u]) staffStats[u] = { picked: 0, received: 0, machines: 0, sterilize: 0, returned: 0 };
        }

        if(pName && pName !== '-'){ ensure(pName); staffStats[pName].picked++; }
        if(recvName && recvName !== '-'){ ensure(recvName); staffStats[recvName].received++; }
        if(wmName && wmName !== '-'){ ensure(wmName); staffStats[wmName].machines++; }
        if(dkName && dkName !== '-'){ ensure(dkName); staffStats[dkName].machines++; }
        if(stName && stName !== '-'){ ensure(stName); staffStats[stName].sterilize++; }
        if(retName && retName !== '-'){ ensure(retName); staffStats[retName].returned++; }
      });

      var sheet3Rows = [
        ['CGSA MEDEWERKER ACTIVITEIT OVERZICHT (WEEK ' + weekNum + ')'],
        ['Datum:', fullDateStr],
        [],
        ['Medewerker', 'Opgehaald', 'Ontvangen', 'Wasmachine/Droogkast', 'Sterilisatie', 'Teruggebracht', 'Totaal Handelingen']
      ];

      var staffNames = Object.keys(staffStats).sort();
      if(staffNames.length > 0){
        staffNames.forEach(function(name){
          var s = staffStats[name];
          var total = s.picked + s.received + s.machines + s.sterilize + s.returned;
          sheet3Rows.push([name, s.picked, s.received, s.machines, s.sterilize, s.returned, total]);
        });
      } else {
        sheet3Rows.push(['Geen medewerker toewijzingen deze week geregistreerd', '-', '-', '-', '-', '-', '-']);
      }

      var ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
      ws3['!cols'] = [
        { wch: 22 }, // Medewerker
        { wch: 16 }, // Opgehaald
        { wch: 16 }, // Ontvangen
        { wch: 24 }, // Wasmachine/Droogkast
        { wch: 18 }, // Sterilisatie
        { wch: 18 }, // Teruggebracht
        { wch: 20 }  // Totaal
      ];

      XLSX.utils.book_append_sheet(wb, ws3, "Medewerkers Overzicht");

      XLSX.writeFile(wb, 'CGSA_Weekrapport_Week_' + weekNum + '_' + todayStr + '.xlsx');
      showToast('Excel weekrapport (.xlsx) gedownload (3 tabbladen, ' + records.length + ' kamers)');
      return true;
    } catch(err) {
      console.warn('XLSX export failed, falling back to CSV:', err);
    }
  }

  // 2. CSV Fallback with sep=; for guaranteed column parsing in Excel
  var nonSterileCount = records.filter(function(r){
    return r.isSterile === false || isNietSteriel(r.sterile) || (r.status === 'Verwerkt' && !/gesteriliseerd/i.test(r.status));
  }).length;
  var sterileCount = records.length - nonSterileCount;
  var returnedCount = records.filter(function(r){ return r.returnedByName && r.returnedByName !== '-'; }).length;

  var csvRows = [];
  csvRows.push('sep=;');
  csvRows.push('CGSA WORKFLOW - WEEKRAPPORT (WEEK ' + weekNum + ')');
  csvRows.push(headersWeek.join(';'));

  records.forEach(function(r){
    var row = [
      escapeCsv(r.date),
      escapeCsv(r.time),
      escapeCsv(fmtCode(r.code)),
      escapeCsv(r.status),
      escapeCsv(r.pickedBy),
      escapeCsv(r.receivedBy),
      escapeCsv(r.wasmachineInfo),
      escapeCsv(r.droogkastInfo),
      escapeCsv(r.sterilizeInfo),
      escapeCsv(r.returnedBy)
    ];
    csvRows.push(row.join(';'));
  });

  csvRows.push(';;--- SAMENVATTING WEEK ---;;;;;;;;');
  csvRows.push(';;TOTAAL GEREGISTREERD;' + records.length + ';;;;;;;;');
  csvRows.push(';;Steriel;' + sterileCount + ';;;;;;;;');
  csvRows.push(';;Niet steriel;' + nonSterileCount + ';;;;;;;;');
  csvRows.push(';;Teruggebracht naar lab;' + returnedCount + ';;;;;;;;');

  var csvContent = '\uFEFF' + csvRows.join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'CGSA_Weekrapport_Week_' + weekNum + '_' + todayStr + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Weekrapport gedownload (' + records.length + ' kamers)');
  return true;
}

var exportDayToExcel = exportWeekToExcel;

function performCloseWeek(){
  if(currentUser !== 'Youssef'){
    showToast('Alleen Youssef kan de week afsluiten.');
    return;
  }

  stationState.entries = [];
  stationState.roomStates = {};
  stationState.archive = [];
  // Also reset lab ronde checklist
  if(typeof state !== 'undefined' && state.roomStates){
    Object.keys(state.roomStates).forEach(function(k){
      if(state.roomStates[k]) {
        state.roomStates[k].visited = null;
        state.roomStates[k].picked = null;
        state.roomStates[k].checks = [false, false, false, false];
      }
    });
    saveState();
  }
  // Clear last touched room so Lab Ronde shows the very first unvisited room
  if(typeof lastTouchedRoom !== 'undefined') lastTouchedRoom = null;
  if(typeof floatRoomIndex !== 'undefined') floatRoomIndex = 0;
  saveStationState();
  updateStationBadge();
  renderStationOverzicht();
  if(stationState.activeView === 'archief') renderStationArchief();
  showToast('Week afgesloten. Alles leeggemaakt voor de volgende week.');

  // Real-time broadcast day closure to Firebase for all users
  if(syncRef){
    try {
      var nowIso = new Date().toISOString();
      syncRef.update({
        entries: null,
        roomStates: null,
        archive: null,
        lrRooms: null,
        lastResetAt: nowIso,
        lastResetBy: 'Youssef',
        lastActionAt: nowIso,
        lastActionBy: 'Youssef'
      }).catch(function(err){
        console.warn('Firebase reset sync failed:', err);
      });
    } catch(e){
      console.error('Firebase reset error:', e);
    }
  }
}

var performCloseDay = performCloseWeek;

// Export button in Archief view
var exportArchiveBtn = document.getElementById('exportArchiveBtn');
if(exportArchiveBtn){
  exportArchiveBtn.addEventListener('click', function(){
    exportDayToExcel();
  });
}

// Dag afsluiten modal & actions
var closeDayModal = document.getElementById('closeDayModal');
var closeDayModalX = document.getElementById('closeDayModalX');
var cancelCloseDayBtn = document.getElementById('cancelCloseDayBtn');
var exportAndCloseBtn = document.getElementById('exportAndCloseBtn');
var closeWithoutExportBtn = document.getElementById('closeWithoutExportBtn');

if(closeDayModalX) closeDayModalX.addEventListener('click', function(){ closeDayModal.classList.remove('open'); });
if(cancelCloseDayBtn) cancelCloseDayBtn.addEventListener('click', function(){ closeDayModal.classList.remove('open'); });

if(exportAndCloseBtn){
  exportAndCloseBtn.addEventListener('click', function(){
    exportDayToExcel();
    if(closeDayModal) closeDayModal.classList.remove('open');
    setTimeout(performCloseDay, 300);
  });
}

if(closeWithoutExportBtn){
  closeWithoutExportBtn.addEventListener('click', function(){
    if(closeDayModal) closeDayModal.classList.remove('open');
    performCloseDay();
  });
}

function updateStationBadge(){
  var open = (stationState.entries || []).filter(function(e){ return !e.processed; }).length;
  var badge = document.getElementById('navBadge');
  if(badge) badge.textContent = open;
}

