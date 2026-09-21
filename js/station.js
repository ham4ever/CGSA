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
  var actionName = (source === 'ronde') ? 'Opgehaald' : 'Ontvangen';

  var newBatch = {
    id: batchId,
    code: code,
    source: source || 'station', // 'ronde' or 'station'
    received: true,
    receivedAt: now,
    receivedBy: actingUser,
    pickedUp: (source === 'ronde'),
    pickedUpAt: (source === 'ronde') ? now : '',
    pickedUpBy: (source === 'ronde') ? actingUser : '',
    processed: false,
    processedAt: '',
    processedBy: '',
    inSterilization: false,
    sterilizationMethod: '',
    sterilizationStartedAt: '',
    sterilizationStartedBy: '',
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
  return addStationBatch(code, 'station', currentUser);
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
    return s.history.map(function(ev){
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
  if(s.archivedAt){
    var aUser = s.archivedBy ? ' <span style="font-weight:700;color:var(--c-text);">('+s.archivedBy+')</span>' : '';
    out += '<div><span style="min-width:78px;display:inline-block;margin-right:6px;">Archief:</span><span>' + fmtDateTime(s.archivedAt) + aUser + '</span></div>';
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
  if(!b) return;

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

var activeOverzichtFilter = 'all';

function setOverzichtFilter(filter){
  activeOverzichtFilter = filter;
  document.querySelectorAll('.ov-filter-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderStationOverzicht();
}

function renderStationOverzicht(){
  var entries = stationState.entries || [];
  var sortedEntries = entries.slice().sort(function(a, b){
    var ta = a.receivedAt || a.pickedUpAt || '';
    var tb = b.receivedAt || b.pickedUpAt || '';
    if(!ta && !tb) return 0;
    if(!ta) return -1;
    if(!tb) return 1;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  var verwerktCount = sortedEntries.filter(function(e){ return e.processed; }).length;
  var autoclaafCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Autoclaaf'; }).length;
  var heteluchtCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Hetelucht'; }).length;
  var beideCount = sortedEntries.filter(function(e){ return !e.processed && e.inSterilization && e.sterilizationMethod === 'Beide'; }).length;
  var openCount = sortedEntries.length - verwerktCount;

  var hkpiRecv = document.getElementById('hkpiOntvangen');
  if(hkpiRecv) hkpiRecv.textContent = sortedEntries.length;
  var hkpiProc = document.getElementById('hkpiVerwerkt');
  if(hkpiProc) hkpiProc.textContent = verwerktCount;
  var hkpiOpn = document.getElementById('stationHkpiOpen');
  if(hkpiOpn) hkpiOpn.textContent = openCount;
  var countEl = document.getElementById('ovCount');
  if(countEl) countEl.textContent = sortedEntries.length;

  // Update filter pill counts
  var cAll = document.getElementById('ovFltAllCount');
  var cOpen = document.getElementById('ovFltOpenCount');
  var cAuto = document.getElementById('ovFltAutoclaafCount');
  var cHete = document.getElementById('ovFltHeteluchtCount');
  var cBeide = document.getElementById('ovFltBeideCount');
  var cDone = document.getElementById('ovFltDoneCount');
  if(cAll) cAll.textContent = sortedEntries.length;
  if(cOpen) cOpen.textContent = openCount;
  if(cAuto) cAuto.textContent = autoclaafCount;
  if(cHete) cHete.textContent = heteluchtCount;
  if(cBeide) cBeide.textContent = beideCount;
  if(cDone) cDone.textContent = verwerktCount;

  // Filter based on active tab
  var filtered = sortedEntries.filter(function(e){
    if(activeOverzichtFilter === 'open'){
      return !e.processed;
    } else if(activeOverzichtFilter === 'autoclaaf'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Autoclaaf';
    } else if(activeOverzichtFilter === 'hetelucht'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Hetelucht';
    } else if(activeOverzichtFilter === 'beide'){
      return !e.processed && e.inSterilization && e.sterilizationMethod === 'Beide';
    } else if(activeOverzichtFilter === 'processed'){
      return e.processed;
    }
    return true; // 'all'
  });

  var list = document.getElementById('overzichtList');
  if(!list) return;

  if(!filtered.length){
    list.innerHTML = '<div class="empty-state">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px;margin:0 auto 12px;opacity:.3;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      + (sortedEntries.length === 0 ? 'Nog niets ontvangen. Ga naar Kamers of Lab Ronde om materialen te registreren.' : 'Geen items in deze filter.') + '</div>';
    return;
  }

  list.innerHTML = filtered.map(function(batch){
    var room = getRoomLookup(batch.code);
    var niet = isNietSteriel(room.sterile);
    var isSterile = !niet;
    var mainColor = niet ? 'var(--c-danger)' : 'var(--c-success)';

    // Adjust card tint if currently inside sterilizer
    if(batch.inSterilization){
      if(batch.sterilizationMethod === 'Hetelucht') mainColor = '#f97316';
      else if(batch.sterilizationMethod === 'Beide') mainColor = '#8b5cf6';
      else mainColor = '#06b6d4';
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
    if(batch.processed){
      var pLabel = (isSterile && batch.sterilizationMethod && batch.sterilizationMethod !== 'Direct')
        ? ('&#10003; Gesteriliseerd (' + batch.sterilizationMethod + ')')
        : '&#10003; Verwerkt';
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,var(--c-success) 18%,transparent);color:var(--c-success);font-weight:800;">' + pLabel + '</span>';
    } else if(batch.inSterilization){
      var mIcon = batch.sterilizationMethod === 'Hetelucht' ? '♨️' : batch.sterilizationMethod === 'Beide' ? '⚡' : '💨';
      var mText = 'In ' + (batch.sterilizationMethod || 'Sterilisator') + (batch.sterilizationStartedBy ? ' (' + batch.sterilizationStartedBy + ')' : '');
      tagHtml = '<span class="ov-tag" style="background:color-mix(in srgb,'+mainColor+' 20%,transparent);color:'+mainColor+';font-weight:800;display:inline-flex;align-items:center;gap:4px;">' + mIcon + ' ' + mText + '</span>';
    } else {
      tagHtml = '<span class="ov-tag" style="background:'+badgeBg+';color:'+mainColor+';">' + (niet ? 'Niet steriel' : 'Steriel') + '</span>';
    }

    // Determine Action Button
    var btnHtml = '';
    if(batch.processed){
      var btnLabel = (isSterile && batch.sterilizationMethod && batch.sterilizationMethod !== 'Direct')
        ? ('&#10003; Gesteriliseerd (' + batch.sterilizationMethod + ')')
        : '&#10003; Verwerkt';
      btnHtml = '<button class="verwerkt-btn done" data-id="'+batch.id+'" data-code="'+batch.code+'">'+btnLabel+'</button>';
    } else if(batch.inSterilization){
      btnHtml = '<button class="verwerkt-btn finish-sterilize" data-id="'+batch.id+'" data-code="'+batch.code+'">&#10003; Afronden / Klaar</button>';
    } else {
      btnHtml = '<button class="verwerkt-btn" data-id="'+batch.id+'" data-code="'+batch.code+'">Verwerken</button>';
    }

    var historyHtml = renderRoomHistoryHtml(batch);

    return '<div class="overzicht-card'+(batch.processed?' verwerkt':'')+ '" id="ov-'+batch.id+'" style="border:1px solid '+borderCol+'; border-left:5px solid '+mainColor+'; background: '+cardBg+';">'
      + '<div class="overzicht-card-body">'
        + '<div class="ov-badge" style="background:'+badgeBg+';color:'+mainColor+';">'+fmtCode(batch.code)+'</div>'
        + '<div class="ov-info">'
          + '<div class="ov-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'
            + '<span class="ov-area">'+(room.area || '')+'</span>'
            + batchBadge
            + tagHtml
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

  list.querySelectorAll('.del-batch-btn').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var batchId = btn.dataset.deleteBatch;
      var b = getStationBatchById(batchId);
      if(!b) return;
      if(confirm('Weet je zeker dat je deze batch voor kamer ' + fmtCode(b.code) + ' wilt verwijderen?')){
        removeStationBatch(batchId);
        haptic('off');
        saveStationState();
        updateStationBadge();
        renderStationOverzicht();
        showToast('Batch voor ' + fmtCode(b.code) + ' verwijderd');
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
        + '<div style="display:flex;align-items:center;gap:8px;">'
          + '<div class="room-row-code">'+fmtCode(item.code)+'</div>'
          + '<span style="font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--c-success) 15%,transparent);color:var(--c-success);">&#10003; Gearchiveerd</span>'
        + '</div>'
        + '<div class="room-row-area">'+(item.area || '')+'</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:3px;font-size:11px;color:var(--c-muted);margin-top:6px;width:100%;">'
        + historyHtml
      + '</div>'
      + '</div>';
  }).join('');
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
        source: b.source || 'station',
        history: b.history ? b.history.slice() : [],
        pickedUpAt: b.pickedUpAt || '',
        pickedUpBy: b.pickedUpBy || '',
        receivedAt: b.receivedAt || '',
        receivedBy: b.receivedBy || '',
        processedAt: b.processedAt || '',
        processedBy: b.processedBy || '',
        archivedAt: archTime,
        archivedBy: currentUser
      };
      // Append step "Archief: [tijd datum] (User)" to history
      archItem.history.push({
        action: 'Archief',
        time: archTime,
        user: currentUser
      });
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

var clearBtn = document.getElementById('clearBtn');
if(clearBtn){
  clearBtn.addEventListener('click', function(){
    if(currentUser !== 'Youssef'){
      showToast('Alleen Youssef kan de dag afsluiten.');
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
    if(sumEl) sumEl.textContent = recCount + ' geregistreerde batches vandaag';
    if(brkEl){
      brkEl.textContent = recCount > 0 
        ? (sterCount + ' gesteriliseerd · ' + Math.max(0, recCount - sterCount) + ' niet-steriel verwerkt')
        : 'Geen batches geregistreerd vandaag';
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

function getTodayExportRecords(){
  var records = [];

  // A. Check archive items
  (stationState.archive || []).forEach(function(item){
    var code = item.code;
    var info = getRoomLookup(code);
    var sterileRule = item.sterile || info.sterile || '';
    var isSterile = !isNietSteriel(sterileRule);
    var opgehaaldDoor = '';
    var opgehaaldTijd = '';
    var verwerktDoor = item.processedBy || '';
    var verwerktTijd = item.processedAt ? fmtDateTime(item.processedAt).split(' ')[0] : '';
    var sMethod = item.sterilizationMethod || '';

    if(item.history && item.history.length){
      item.history.forEach(function(ev){
        if(ev.action === 'Opgehaald' && !opgehaaldDoor){
          opgehaaldDoor = ev.user || '';
          opgehaaldTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        }
        if((ev.action === 'Verwerkt' || ev.action.indexOf('Gesteriliseerd') >= 0 || ev.action.indexOf('In ') >= 0) && !verwerktDoor){
          verwerktDoor = ev.user || '';
          verwerktTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        }
        if(!sMethod){
          var mMatch = ev.action.match(/Gesteriliseerd \((.+)\)/) || ev.action.match(/In (Autoclaaf|Hetelucht|Beide)/);
          if(mMatch) sMethod = mMatch[1];
          else if(ev.action === 'Verwerkt (Direct)') sMethod = 'Direct';
        }
      });
    }

    var statusStr = 'Verwerkt (Gearchiveerd)';
    if(sMethod && sMethod !== 'Direct'){
      statusStr = 'Gesteriliseerd (' + sMethod + ')';
    } else if(isSterile){
      statusStr = sMethod === 'Direct' ? 'Gesteriliseerd (Direct)' : 'Gesteriliseerd';
    }

    records.push({
      date: item.archivedAt ? new Date(item.archivedAt).toLocaleDateString('nl-NL') : new Date().toLocaleDateString('nl-NL'),
      time: opgehaaldTijd || verwerktTijd || (item.archivedAt ? fmtDateTime(item.archivedAt).split(' ')[0] : ''),
      code: code,
      area: info.area || item.area || '',
      sterile: sterileRule || '-',
      isSterile: isSterile,
      status: statusStr,
      pickedBy: opgehaaldDoor || item.receivedBy || item.pickedUpBy || '-',
      processedBy: verwerktDoor || item.archivedBy || '-'
    });
  });

  // B. Check active batches in stationState.entries
  (stationState.entries || []).forEach(function(b){
    var code = b.code;
    var info = getRoomLookup(code);
    var isSterile = !isNietSteriel(info.sterile);
    var opgehaaldDoor = b.pickedUpBy || '';
    var opgehaaldTijd = b.pickedUpAt ? fmtDateTime(b.pickedUpAt).split(' ')[0] : '';
    var verwerktDoor = b.processedBy || '';
    var verwerktTijd = b.processedAt ? fmtDateTime(b.processedAt).split(' ')[0] : '';

    if(b.history && b.history.length){
      b.history.forEach(function(ev){
        if(ev.action === 'Opgehaald' && !opgehaaldDoor){
          opgehaaldDoor = ev.user || '';
          opgehaaldTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        }
        if((ev.action === 'Verwerkt' || ev.action.indexOf('Gesteriliseerd') >= 0 || ev.action.indexOf('In ') >= 0) && !verwerktDoor){
          verwerktDoor = ev.user || '';
          verwerktTijd = ev.time ? fmtDateTime(ev.time).split(' ')[0] : '';
        }
      });
    }

    var statusStr = 'Ontvangen';
    if(b.processed){
      if(b.sterilizationMethod && b.sterilizationMethod !== 'Direct'){
        statusStr = 'Gesteriliseerd (' + b.sterilizationMethod + ')';
      } else if(b.sterilizationMethod === 'Direct'){
        statusStr = 'Gesteriliseerd (Direct)';
      } else if(isSterile){
        statusStr = 'Gesteriliseerd';
      } else {
        statusStr = 'Verwerkt';
      }
    } else if(b.inSterilization){
      statusStr = 'In ' + (b.sterilizationMethod || 'Sterilisator');
    } else if(b.source === 'ronde' || b.pickedUp){
      statusStr = 'Opgehaald';
    }

    records.push({
      date: new Date().toLocaleDateString('nl-NL'),
      time: opgehaaldTijd || verwerktTijd || (b.receivedAt ? fmtDateTime(b.receivedAt).split(' ')[0] : ''),
      code: code,
      area: info.area || '',
      sterile: info.sterile || '-',
      isSterile: isSterile,
      status: statusStr,
      pickedBy: opgehaaldDoor || b.receivedBy || '-',
      processedBy: verwerktDoor || '-'
    });
  });

  return records;
}

function exportDayToExcel(){
  var records = getTodayExportRecords();
  if(!Array.isArray(records)) records = Object.values(records);

  if(!records.length){
    showToast('Geen geregistreerde kamers vandaag om te exporteren.');
    return false;
  }

  // Sort logically by room code
  records.sort(function(a, b){
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });

  var todayStr = new Date().toLocaleDateString('nl-NL').replace(/\//g, '-');
  var headers = ['Datum', 'Tijd', 'Kamer', 'Status', 'Opgehaald door', 'Verwerkt door'];

  // 1. Native Excel (.xlsx) Export via SheetJS when available
  if(typeof XLSX !== 'undefined'){
    try {
      var fullDateStr = new Date().toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var nowTimeStr = new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

      var nonSterileCount = records.filter(function(r){
        return r.isSterile === false || isNietSteriel(r.sterile) || (r.status === 'Verwerkt' && !/gesteriliseerd/i.test(r.status));
      }).length;
      var sterileCount = records.length - nonSterileCount;

      // --- SHEET 1: DETAIL DAGRAPPORT ---
      var sheet1Rows = [
        ['CGSA WORKFLOW'],
        ['Datum:', fullDateStr, 'Tijd:', nowTimeStr],
        ['Geëxporteerd door:', currentUser, 'Totaal geregistreerd:', records.length],
        [], // spacing row
        headers
      ];

      records.forEach(function(r){
        sheet1Rows.push([
          r.date,
          r.time,
          fmtCode(r.code),
          r.status,
          r.pickedBy,
          r.processedBy
        ]);
      });

      // KPI Summary rows at the end of the sheet
      sheet1Rows.push([]);
      sheet1Rows.push(['', '', '--- SAMENVATTING ---', '', '', '']);
      sheet1Rows.push(['', '', 'TOTAAL VERWERKT:', records.length, '', '']);
      sheet1Rows.push(['', '', 'Steriel.', sterileCount, '', '']);
      sheet1Rows.push(['', '', 'Niet steriel.', nonSterileCount, '', '']);

      var wb = XLSX.utils.book_new();
      var ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);

      // Dynamic Auto-fit Column Widths for Sheet 1
      var colWidths1 = headers.map(function(h, colIdx){
        var maxLen = h.length;
        records.forEach(function(r){
          var val = [r.date, r.time, fmtCode(r.code), r.status, r.pickedBy, r.processedBy][colIdx] || '';
          if(String(val).length > maxLen) maxLen = String(val).length;
        });
        return { wch: Math.max(maxLen + 4, 12) };
      });
      // Ensure Title on row 1 doesn't cramp column A
      colWidths1[0].wch = Math.max(colWidths1[0].wch, 14);
      colWidths1[3].wch = Math.max(colWidths1[3].wch, 30);
      ws1['!cols'] = colWidths1;

      XLSX.utils.book_append_sheet(wb, ws1, "Dagrapport");

      // --- SHEET 2: MEDEWERKERS & STATISTIEKEN ---
      var staffStats = {};
      records.forEach(function(r){
        if(r.pickedBy && r.pickedBy !== '-'){
          staffStats[r.pickedBy] = staffStats[r.pickedBy] || { picked: 0, processed: 0 };
          staffStats[r.pickedBy].picked++;
        }
        if(r.processedBy && r.processedBy !== '-'){
          staffStats[r.processedBy] = staffStats[r.processedBy] || { picked: 0, processed: 0 };
          staffStats[r.processedBy].processed++;
        }
      });

      var sheet2Rows = [
        ['CGSA MEDEWERKER ACTIVITEIT OVERZICHT'],
        ['Datum:', fullDateStr],
        [],
        ['Medewerker', 'Opgehaald (Kamers)', 'Verwerkt (Kamers)', 'Totaal Handelingen']
      ];

      var staffNames = Object.keys(staffStats).sort();
      if(staffNames.length > 0){
        staffNames.forEach(function(name){
          var s = staffStats[name];
          sheet2Rows.push([name, s.picked, s.processed, s.picked + s.processed]);
        });
      } else {
        sheet2Rows.push(['Geen medewerker toewijzingen vandaag geregistreerd', '-', '-', '-']);
      }

      var ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
      ws2['!cols'] = [
        { wch: 22 }, // Medewerker
        { wch: 20 }, // Opgehaald
        { wch: 20 }, // Verwerkt
        { wch: 22 }  // Totaal
      ];

      XLSX.utils.book_append_sheet(wb, ws2, "Medewerkers Overzicht");

      XLSX.writeFile(wb, 'CGSA_Dagrapport_' + todayStr + '.xlsx');
      showToast('Excel rapport (.xlsx) gedownload (2 tabbladen, ' + records.length + ' kamers)');
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

  var csvRows = [];
  csvRows.push('sep=;');
  csvRows.push('CGSA WORKFLOW');
  csvRows.push(headers.join(';'));

  records.forEach(function(r){
    var row = [
      escapeCsv(r.date),
      escapeCsv(r.time),
      escapeCsv(fmtCode(r.code)),
      escapeCsv(r.status),
      escapeCsv(r.pickedBy),
      escapeCsv(r.processedBy)
    ];
    csvRows.push(row.join(';'));
  });

  csvRows.push(';;--- SAMENVATTING ---;;;');
  csvRows.push(';;TOTAAL VERWERKT;' + records.length + ';;');
  csvRows.push(';;Steriel.;' + sterileCount + ';;');
  csvRows.push(';;Niet steriel.;' + nonSterileCount + ';;');

  var csvContent = '\uFEFF' + csvRows.join('\r\n');
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'CGSA_Dagrapport_' + todayStr + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Excel rapport gedownload (' + records.length + ' kamers)');
  return true;
}

function performCloseDay(){
  if(currentUser !== 'Youssef'){
    showToast('Alleen Youssef kan de dag afsluiten.');
    return;
  }

  stationState.entries = [];
  stationState.roomStates = {};
  stationState.archive = [];
  // Also reset today's lab ronde checklist
  if(typeof state !== 'undefined' && state.rooms){
    Object.keys(state.rooms).forEach(function(k){
      if(state.rooms[k]) {
        state.rooms[k].visited = null;
        state.rooms[k].picked = null;
      }
    });
    saveState();
  }
  saveStationState();
  updateStationBadge();
  renderStationOverzicht();
  if(stationState.activeView === 'archief') renderStationArchief();
  showToast('Dag afgesloten. Alles leeggemaakt voor de volgende shift.');

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

