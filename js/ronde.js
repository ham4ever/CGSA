/* -- RENDER HOME ----------------------------------------- */

function renderHome(){

    renderFloorPicker();

 renderHeroStats();

}



function renderFloorPicker(){

  const allFloors=['0','1','2','3','4','5'];

  const fp=document.getElementById('fpChips');

  const fo=document.getElementById('fpOrder');

  const fb=document.getElementById('fpStartBtn');

  const fpr=document.getElementById('fpPresets');

  // chips

  fp.innerHTML=allFloors.map(f=>{

    const sel=state.customFloorOrder.includes(f);

    return `<button class="fp-chip${sel?' selected':''}" data-floor="${f}" onclick="fpToggleFloor('${f}')">${f}</button>`;

  }).join('');

  // presets

  const presets=[{l:'0+5',v:['0','5']},{l:'2+4',v:['2','4']},{l:'3+1',v:['3','1']},{l:'Alles',v:['0','1','2','3','4','5']}];

  fpr.innerHTML=presets.map(p=>`<button class="fp-preset" onclick="fpApplyPreset([${p.v.map(x=>"'"+x+"'").join(',')}])">${p.l}</button>`).join('');

  // order list

  if(!state.customFloorOrder.length){

    fo.innerHTML='<div class="fp-empty">Tik op een verdieping hierboven om toe te voegen</div>';

  } else {

    fo.innerHTML=state.customFloorOrder.map((f,i)=>{

      const roomCount=Object.values(routeData).reduce((n,rd)=>n+(rd.floors&&rd.floors.includes(f)?rd.rooms.filter(r=>r.code.startsWith(f+'.')).length:0),0);

      return `<div class="fp-order-item" data-floor="${f}">

        <div class="fp-order-badge">${f}</div>

        <div style="flex:1">

          <div class="fp-order-label">Verdieping ${f}</div>

          <div class="fp-order-sub">${roomCount} kamers</div>

        </div>

        <div class="fp-order-btns">

          <button class="fp-order-btn" ${i===0?'disabled':''} onclick="fpMoveFloor(${i},-1)">&#8593;</button>

          <button class="fp-order-btn" ${i===state.customFloorOrder.length-1?'disabled':''} onclick="fpMoveFloor(${i},1)">&#8595;</button>

        </div>

        <button class="fp-order-btn" style="margin-left:4px;color:var(--c-danger);border-color:var(--c-danger)" onclick="fpRemoveFloor('${f}')" title="Verwijder">&#215;</button>

      </div>`;

    }).join('');

  }

  fb.disabled=state.customFloorOrder.length===0;

  // update topbar pill

  var _rp = document.getElementById('topbarRoutePill'); if(_rp) _rp.textContent = state.customFloorOrder.length ? 'Verd. '+state.customFloorOrder.join('+') : getRoute().title;

}

function fpToggleFloor(f){

  const i=state.customFloorOrder.indexOf(f);

  if(i===-1) state.customFloorOrder.push(f);

  else state.customFloorOrder.splice(i,1);

  saveState(); renderFloorPicker();

}

function fpMoveFloor(i,dir){

  const arr=state.customFloorOrder;

  const j=i+dir;

  if(j<0||j>=arr.length) return;

  [arr[i],arr[j]]=[arr[j],arr[i]];

  saveState(); renderFloorPicker();

}

function fpRemoveFloor(f){

  state.customFloorOrder=state.customFloorOrder.filter(x=>x!==f);

  saveState(); renderFloorPicker();

}

function fpApplyPreset(floors){

  state.customFloorOrder = floors.slice();



  saveState();

  haptic();

  renderFloorPicker();



  showToast('Gekozen: verdieping ' + floors.join(' &rarr; '));

}

function startCustomRoute(){

  if(!state.customFloorOrder.length) return;

  saveState();

  switchView('rooms');

}





function renderHeroStats(){

  const r=getRoute();

  const rooms=r.rooms;

  const active=rooms.filter(rm=>!peekRoomState(rm.code).skipped);

  const visited=active.filter(rm=>peekRoomState(rm.code).visited===true).length;

  const picked=active.filter(rm=>peekRoomState(rm.code).picked===true).length;

  const total=active.length;

  const pct=total?Math.round((visited/total)*100):0;

  document.getElementById('heroRouteName').textContent=r.title;

  document.getElementById('hkpiTotal').textContent=total;

  document.getElementById('hkpiVisited').textContent=visited;

  document.getElementById('hkpiPicked').textContent=picked;

  document.getElementById('hkpiOpen').textContent=total-visited;

  document.getElementById('heroPct').textContent=pct+'%';

  var ring=document.getElementById('heroRingFill');

  if(ring){

    var circ=2*Math.PI*52;

    ring.style.strokeDasharray=circ;

    ring.style.strokeDashoffset=circ*(1-pct/100);

    ring.classList.toggle('complete', pct>=100);

  }

  var _rp = document.getElementById('topbarRoutePill'); if(_rp) _rp.textContent = r.title;

}



/* -- RENDER ROOMS ---------------------------------------- */

let lastTouchedRoom = null;



function roomCardHTML(room) {

  var s = peekRoomState(room.code);

  var isDone = s.visited === true;

    var isSkipped = s.skipped === true;

  var isCurrent = lastTouchedRoom === room.code;

  var cardClass = 'room-card' + (isDone ? ' visited-done' : '') + (isCurrent ? ' current-room' : '') + (isSkipped ? ' skipped' : '');

  var cardId = 'rc-' + room.code.replace(/\./g, '-');

      var note = room.note;

  var activeBatches = (typeof getActiveStationBatchesForRoom === 'function') ? getActiveStationBatchesForRoom(room.code) : [];
  var isInTracker = activeBatches.length > 0;
  var trackerCountStr = activeBatches.length > 1 ? ' (' + activeBatches.length + 'x)' : '';
  var latestUser = (activeBatches.length > 0 && (activeBatches[activeBatches.length-1].pickedUpBy || activeBatches[activeBatches.length-1].receivedBy)) ? (activeBatches[activeBatches.length-1].pickedUpBy || activeBatches[activeBatches.length-1].receivedBy) : '';
  var trackerUserStr = latestUser ? ' <span style="opacity:0.8;font-weight:500;">('+latestUser+')</span>' : '';

  return '<article class="' + cardClass + '" id="' + cardId + '">'

      + '<div class="room-card-header">'

        + '<div class="room-badge">'

        + '<span class="room-badge-num">' + fmtCode(room.code) + '</span>'

      + '</div>'

      + '<div class="room-info">'

        + '<div class="room-area">' + room.area + '</div>'

        + '<span class="room-sterile">' + room.sterile + '</span>'

        + (isInTracker ? '<div class="room-tracker-pill" style="margin-top:4px;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--c-accent);background:color-mix(in srgb,var(--c-accent) 12%,transparent);padding:2px 8px;border-radius:6px;">&#10003; In CGSA-Tracker' + trackerCountStr + trackerUserStr + '<button type="button" class="cancel-tracker-btn" data-cancel-station="' + room.code + '" title="Verwijder uit CGSA-Tracker" style="margin-left:4px;background:none;border:none;color:var(--c-muted);font-size:13px;cursor:pointer;padding:0 2px;line-height:1;">&times;</button></div>' : '')

      + '</div>'
            + '</div>' + (note ? '<div class="room-note">' + room.note + '</div>' : '')

      + (isSkipped

    ? '<div class="skip-banner"><span class="skip-banner-text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Hoeft niet vandaag</span><button class="skip-unblock" data-action="unskip" data-room="' + room.code + '">Activeer</button></div>'

    : '<div class="room-body" style="display:block">'

      + '<div  class="room-actions">'

      + '<div class="toggle-row">'

      + '<span class="toggle-label">Langs geweest?</span>'

      + '<div class="toggle-btns">'

      + '<button class="' + (s.visited === true ? 'yes' : '') + '" data-action="visited" data-value="yes" data-room="' + room.code + '">&#10003; Ja</button>'

      + '<button class="' + (s.visited === false ? 'no' : '') + '" data-action="visited" data-value="no" data-room="' + room.code + '">&#10007; Nee</button>'

      + '</div>'

      + '</div>'

      + '<div class="toggle-row">'

      + '<span class="toggle-label">Iets opgehaald?</span>'

      + '<div class="toggle-btns">'

      + '<button class="' + (s.picked === true ? 'yes' : '') + '" data-action="picked" data-value="yes" data-room="' + room.code + '">&#10003; Ja</button>'

      + '<button class="' + (s.picked === false ? 'no' : '') + '" data-action="picked" data-value="no" data-room="' + room.code + '">&#10007; Nee</button>'

      + '</div>'

      + '</div>'

      + '</div>'

      + '</div>')

  + '</article>';

}


function setRoomPicked(roomCode, val, user){
  var s = getRoomState(roomCode);
  s.picked = val;
  var now = new Date().toISOString();
  var actingUser = user || currentUser || 'Youssef';

  if(val){
    s.pickedAt = now;
    s.pickedBy = actingUser;
  } else {
    s.pickedAt = null;
    s.pickedBy = null;
  }

  // Sync into CGSA-Tracker
  if(val){
    if(typeof addStationBatch === 'function'){
      addStationBatch(roomCode, 'ronde', actingUser);
      updateUserRolePermissions();
      updateStationBadge();
      showToast(fmtCode(roomCode) + ' toegevoegd aan CGSA-Tracker');
    }
  } else {
    // In a multi-round day, clicking 'Nee' during a second or third visit means nothing was picked up in THIS round.
    // Existing batches in CGSA-Tracker remain untouched!
    var activeBatches = (typeof getActiveStationBatchesForRoom === 'function') ? getActiveStationBatchesForRoom(roomCode) : [];
    if(activeBatches.length > 0){
      showToast(fmtCode(roomCode) + ': niets opgehaald (blijft in CGSA-Tracker)');
    }
  }

  saveState();
  if(typeof pushCloudSync === 'function') pushCloudSync();
}

function renderRooms() {

var r = getRoute();

var rooms = applyRoomSort(r.rooms);



rooms = rooms.filter(function(rm){ return !peekRoomState(rm.code).skipped; });

if (state.filter === 'pending') rooms = rooms.filter(function(rm){ return peekRoomState(rm.code).visited !== true; });

  if (state.filter === 'visited') rooms = rooms.filter(function(rm){ return peekRoomState(rm.code).visited === true; });

  if (state.filter === 'picked')  rooms = rooms.filter(function(rm){ return peekRoomState(rm.code).picked === true; });

  var c = document.getElementById('roomsList');

  if (!rooms.length) { c.innerHTML = '<div class="empty-state">Geen kamers in deze filter.</div>'; return; }



  // Group by floor

  var floorOrder = [];

  var floorMap = {};

  rooms.forEach(function(room) {

    var fl = room.code.split('.')[0];

    if (!floorMap[fl]) { floorMap[fl] = []; floorOrder.push(fl); }

    floorMap[fl].push(room);

  });



  c.innerHTML = floorOrder.map(function(floor) {

    var flRooms = floorMap[floor];

    var allFloorRooms = r.rooms.filter(function(rm){ return rm.code.split('.')[0] === floor; });

    var activeFloorRooms = allFloorRooms.filter(function(rm){ return !peekRoomState(rm.code).skipped; });

    var done = activeFloorRooms.filter(function(rm){ return peekRoomState(rm.code).visited === true; }).length;

    var total = activeFloorRooms.length;

    var allDone = done === total;

    var cfg = getFloorSort(floor);

    var zones = {};

    flRooms.forEach(function(rm){

      var z = (rm.area || '').split(' ')[1];

      if (z && !zones[z]) zones[z] = true;

    });

    var zoneDefs = (cfg.zones || ['Noord','Midden','Zuid']).map(function(z){ return [z, z]; }).filter(function(zd){ return zones[zd[0]]; });

    var zoneBtns = zoneDefs.map(function(zd){

      return '<button class="floor-zone-btn" data-floor="'+floor+'" data-zone="'+zd[0]+'">'+zd[1]+'</button>';

    }).join('');

    return '<div class="floor-group" data-floor="' + floor + '">'

      + '<div class="floor-header">'

        + '<div class="floor-label">'

          + '<div class="floor-badge-wrap">'

            + '<div class="floor-badge">' + floor + '</div>'

            + (zoneBtns ? '<div class="floor-zone-jumps">'+zoneBtns+'</div>' : '')

          + '</div>'

          + '<div>'

            + '<div class="floor-title">Verdieping ' + floor + '</div>'

            + '<div class="floor-sub">' + done + ' / ' + total + ' bezocht</div>'

          + '</div>'

        + '</div>'

        + '<button class="floor-complete-btn' + (allDone ? ' all-done' : '') + '" data-floor="' + floor + '">'

          + (allDone ? '&#10003; Klaar' : 'Alles bezocht')

        + '</button>'

      + '</div>'

      + flRooms.map(function(room){ return roomCardHTML(room); }).join('')

      + '</div>';

  }).join('');



    c.querySelectorAll('.floor-zone-btn').forEach(function(btn){

      btn.addEventListener('click', function(){

        var fl = btn.dataset.floor;

        var zone = btn.dataset.zone;

        var cards = Array.from(c.querySelectorAll('.room-card'));

        var target = null;

        for (var i=0;i<cards.length;i++){

          var code = cards[i].id.replace('rc-','').replace(/-/g,'.');

          var area = (routeRoomArea(code) || '').split(' ');

          if (area[0] === fl && area[1] === zone){ target = cards[i]; break; }

        }

        if (target) {

          target.scrollIntoView({behavior:'smooth', block:'center'});

          c.querySelectorAll('.floor-zone-btn').forEach(function(b){ b.classList.toggle('active', b===btn); });

        }

      });

    });



    c.querySelectorAll('.floor-complete-btn').forEach(function(btn) {  btn.addEventListener('click', function() {

      var fl = btn.dataset.floor;

      var flRooms = r.rooms.filter(function(rm){ return rm.code.split('.')[0] === fl; });

      var activeRooms = flRooms.filter(function(rm){ return !peekRoomState(rm.code).skipped; });

      var allDone = activeRooms.length>0 && activeRooms.every(function(rm){ return peekRoomState(rm.code).visited === true; });

      if (allDone) {

        if (!confirm('Deze verdieping opnieuw openen? Alle kamers worden weer "niet bezocht".')) return;

        flRooms.forEach(function(rm){ getRoomState(rm.code).visited = null; });

      } else {

        flRooms.forEach(function(rm){ getRoomState(rm.code).visited = true; });

      }

      saveState(); renderRooms(); renderHeroStats();

    });

  });



  // Toggle buttons -- in-place update, no full re-render

  c.querySelectorAll('button[data-action]').forEach(function(btn) {

    if (btn.dataset.action === 'note') return;

        if (btn.dataset.action === 'unskip') { btn.addEventListener('click',function(){var s2=getRoomState(btn.dataset.room);s2.skipped=false;saveState();renderRooms();});return;}

    btn.addEventListener('click', function() {

      var s = getRoomState(btn.dataset.room);

      var val = btn.dataset.value === 'yes';

      if (btn.dataset.action === 'visited') {
        s.visited = val;
        s.visitedAt = val ? new Date().toISOString() : null;
        s.visitedBy = val ? currentUser : null;
        saveState();
        if(typeof pushCloudSync === 'function') pushCloudSync();
      }

      if (btn.dataset.action === 'picked') {
        setRoomPicked(btn.dataset.room, val, currentUser);
      }

      haptic(val ? 'yes' : 'no');

      lastTouchedRoom = btn.dataset.room;

      var cardId = 'rc-' + btn.dataset.room.replace(/\./g, '-');

      var card = document.getElementById(cardId);

      if (card) {

        // clear old current-room, set on this card

        c.querySelectorAll('.room-card.current-room').forEach(function(el){ el.classList.remove('current-room'); });

        card.classList.add('current-room');

        // update button states

        card.querySelectorAll('button[data-action="' + btn.dataset.action + '"]').forEach(function(b) {

          b.className = b.dataset.value === 'yes'

            ? (s[btn.dataset.action] === true  ? 'yes' : '')

            : (s[btn.dataset.action] === false ? 'no'  : '');

        });

        if (btn.dataset.action === 'visited') {

          card.classList.toggle('visited-done', s.visited === true);

        }

        // spring-pop on whichever toggle button was tapped (Ja or Nee)

        var tb = card.querySelector('button[data-action="' + btn.dataset.action + '"][data-value="' + (val ? 'yes' : 'no') + '"]');

        if (tb) {

          tb.classList.remove('pop');

          void tb.offsetWidth; // restart animation

          tb.classList.add('pop');

        }

        // update floor sub-count live

        var floor = btn.dataset.room.split('.')[0];

        var flGroup = c.querySelector('.floor-group[data-floor="' + floor + '"]');

        if (flGroup) {

          var allFloorRooms = r.rooms.filter(function(rm){ return rm.code.split('.')[0] === floor; });

          var activeFloorRooms = allFloorRooms.filter(function(rm){ return !peekRoomState(rm.code).skipped; });

          var done = activeFloorRooms.filter(function(rm){ return peekRoomState(rm.code).visited === true; }).length;

          var total = activeFloorRooms.length;

          var allDone = done === total;

          var sub = flGroup.querySelector('.floor-sub');

          if (sub) sub.textContent = done + ' / ' + total + ' bezocht';

          var fcBtn = flGroup.querySelector('.floor-complete-btn');

          if (fcBtn) { fcBtn.innerHTML = allDone ? '&#10003; Klaar' : 'Alles bezocht'; fcBtn.classList.toggle('all-done', allDone); }

        }

      }

      renderHeroStats(); updateFilterCounts();



      // Auto-scroll to next pending room when both questions answered

      var s2 = getRoomState(btn.dataset.room);

      if (s2.visited !== null && s2.picked !== null) {

        var allCards = Array.from(c.querySelectorAll('.room-card'));

        var thisCard = document.getElementById('rc-' + btn.dataset.room.replace(/\./g, '-'));

        var thisIdx = allCards.indexOf(thisCard);

        function isPending(card){

          var code = card.id.replace('rc-','').replace(/-/g,'.');

          var st = peekRoomState(code);

          return st.visited !== true && !st.skipped;

        }

        var target = null;

        for (var ni = thisIdx + 1; ni < allCards.length; ni++){ if (isPending(allCards[ni])) { target = allCards[ni]; break; } }

        if (!target) { for (var ni2 = 0; ni2 < allCards.length; ni2++){ if (isPending(allCards[ni2])) { target = allCards[ni2]; break; } } }

        if (target) {

          setTimeout(function() {

            target.scrollIntoView({behavior: 'smooth', block: 'center'});

          }, 320);

        }

      }

    });

  });



  // Checklist items

  c.querySelectorAll('.checklist-item').forEach(function(item) {

    item.addEventListener('click', function() {

      var room = item.dataset.room;

      var ci = parseInt(item.dataset.check);

      var s = getRoomState(room);

      s.checks[ci] = !s.checks[ci];

      item.classList.toggle('checked', s.checks[ci]);

      haptic(s.checks[ci] ? 'yes' : 'tap');

      saveState();

    });

  });



  c.querySelectorAll('button[data-cancel-station]').forEach(function(btn){
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var code = this.dataset.cancelStation;
      if(confirm('Weet je zeker dat je kamer ' + fmtCode(code) + ' wilt verwijderen uit de CGSA-Tracker?')){
        if(typeof stationState !== 'undefined' && stationState.entries){
          stationState.entries = stationState.entries.filter(function(b){ return b.code !== code; });
          saveStationState(true);
          updateStationBadge();
        }
        renderRooms();
        showToast(fmtCode(code) + ' verwijderd uit CGSA-Tracker');
        if(typeof pushCloudSync === 'function') pushCloudSync();
      }
    });
  });

  setTimeout(updateFloatCounter, 50);

    renderFloorJumps();

}








// Filter pills

document.querySelectorAll('.filter-pill').forEach(p=>{

  p.addEventListener('click',()=>{

    state.filter=p.dataset.filter;

    saveState();

    document.querySelectorAll('.filter-pill').forEach(x=>x.classList.remove('active'));

    p.classList.add('active');

    renderRooms();

  });

});



/* -- SEARCH ----------------------------------------------- */

function doSearch(){

  const term=document.getElementById('searchInput').value.trim().toLowerCase();

  const c=document.getElementById('searchResults');

  if(!term){ c.innerHTML='<div class="search-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Zoek een kamer op nummer of gebied.</div>'; return; }

  const r=getRoute();
  const termRaw = term.replace(/\./g, '');
  const found=r.rooms.filter(rm=>{
    const codeRaw = rm.code.replace(/\./g, '').toLowerCase();
    const formatted = fmtCode(rm.code).toLowerCase();
    const code = rm.code.toLowerCase();
    const area = (rm.area || '').toLowerCase();
    return formatted.includes(term) || code.includes(term) || (termRaw && codeRaw.includes(termRaw)) || area.includes(term);
  });

  if(!found.length){ c.innerHTML='<div class="search-empty">Geen kamers gevonden voor "'+term+'".</div>'; return; }

  c.innerHTML=found.map(room=>{

    const s=peekRoomState(room.code);

    return `<div class="search-result-card" data-jump="${room.code}" style="margin-bottom:var(--s3);cursor:pointer;-webkit-tap-highlight-color:transparent;">

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s2)">

        <h3>${fmtCode(room.code)}</h3>

        <span class="tag-pill ${s.visited===true?'green':s.visited===false?'':'blue'}">${s.visited===true?'Bezocht':s.visited===false?'Niet bezocht':'Open'}</span>

      </div>

      <div style="font-size:12px;color:var(--c-muted);margin-bottom:4px">${room.area}</div>

      <div style="font-size:13px;margin-bottom:var(--s2)">${room.sterile}</div>

      ${room.note?`<div style="font-size:13px;color:var(--c-muted);margin-bottom:var(--s2)">${room.note}</div>`:''}

      ${room.reminder?`<div style="font-size:12px;color:var(--c-accent2);background:color-mix(in srgb,var(--c-accent2) 8%,transparent);padding:8px 10px;border-radius:var(--r-sm)">${room.reminder}</div>`:''}

    </div>`;

  }).join('');

  c.querySelectorAll('[data-jump]').forEach(function(card){

    card.addEventListener('click', function(){ jumpToRoom(this.dataset.jump); });

  });

}

document.getElementById('searchInput').addEventListener('input', doSearch);

document.getElementById('clearSearch').addEventListener('click',()=>{ document.getElementById('searchInput').value=''; doSearch(); });



/* -- FLOOR JUMP BAR -------------------------------------- */

function renderFloorJumps() {

  var r = getRoute();

  var bar = document.getElementById('floorJumps');

  if (!bar) return;

  var floors = [];

  var floorZones = {};

  r.rooms.forEach(function(rm) {

    var fl = rm.code.split('.')[0];

    if (floors.indexOf(fl) === -1) floors.push(fl);

    var z = (rm.area || '').split(' ')[1];

    if (z) { (floorZones[fl] = floorZones[fl] || {}); floorZones[fl][z] = true; }

  });

    bar.innerHTML = floors.map(function(fl) {

      var zoneDefs = (getFloorSort(fl).zones || ['Noord','Midden','Zuid']).map(function(z){ return [z, z==='Noord'?'N':z==='Midden'?'M':'Z']; }).filter(function(zd){ return floorZones[fl] && floorZones[fl][zd[0]]; });

      var zoneBtns = zoneDefs.map(function(zd){

        return '<button class="floor-jump-zone" data-floor="'+fl+'" data-zone="'+zd[0]+'">'+zd[1]+'</button>';

      }).join('');

      return '<div class="floor-jump-item">'

        + '<button class="floor-jump-pill" data-floor="' + fl + '">' + fl + '</button>'

        + (zoneBtns ? '<div class="floor-jump-zones">'+zoneBtns+'</div>' : '')

        + '</div>';

    }).join('');

  // floor number click: toggle zones open + jump to first pending on that floor

  bar.querySelectorAll('.floor-jump-pill').forEach(function(btn) {

    btn.addEventListener('click', function() {

      var fl = btn.dataset.floor;

      var group = document.querySelector('.floor-group[data-floor="' + fl + '"]');
      var target = null;

      if (group) {

        var cards = Array.from(group.querySelectorAll('.room-card'));

        var lastVisitedCard = null, firstPendingCard = null;

        cards.forEach(function(card) {

          var code = card.id.replace('rc-', '').replace(/-/g, '.');

          var st = peekRoomState(code);

          if (st.visited === true) lastVisitedCard = card;

          if (!firstPendingCard && st.visited !== true) firstPendingCard = card;

        });

        target = firstPendingCard || lastVisitedCard || group;

      }

      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      bar.querySelectorAll('.floor-jump-pill').forEach(function(b) { b.classList.remove('active'); });

      btn.classList.add('active');

    });

  });

  // zone click: jump to first room of that zone on that floor

  bar.querySelectorAll('.floor-jump-zone').forEach(function(btn) {

    btn.addEventListener('click', function(e) {

      e.stopPropagation();

      var fl = btn.dataset.floor;

      var zone = btn.dataset.zone;

      var cards = Array.from(document.querySelectorAll('#roomsList .room-card'));

      var target = null;

      for (var i=0;i<cards.length;i++){

        var code = cards[i].id.replace('rc-', '').replace(/-/g, '.');

        var area = (routeRoomArea(code) || '').split(' ');

        if (area[0] === fl && area[1] === zone){ target = cards[i]; break; }

      }

      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });

      bar.querySelectorAll('.floor-jump-zone').forEach(function(b){ b.classList.remove('active'); });

      btn.classList.add('active');

    });

  });

  // highlight active floor on scroll

  var scrollEl = document.querySelector('#view-rooms .scroll-region');

  if (scrollEl) {

    scrollEl.onscroll = function() {

      var groups = document.querySelectorAll('.floor-group[data-floor]');

      var active = null;

      groups.forEach(function(g) {

        var rect = g.getBoundingClientRect();

        if (rect.top <= 120) active = g.dataset.floor;

      });

      bar.querySelectorAll('.floor-jump-pill').forEach(function(b) {

        b.classList.toggle('active', b.dataset.floor === active);

      });

    };

  }

  // set first pill active

  var first = bar.querySelector('.floor-jump-pill');

  if (first) first.classList.add('active');

}



/* -- DRAG TO REORDER ------------------------------------- */

/* -- SUMMARY ---------------------------------------------- */

function renderSummary(){
  const r=getRoute();
  const rooms=r.rooms;
  const reminders=rooms.filter(rm=>peekRoomState(rm.code).picked===true)
    .slice().sort(function(a,b){
      var pa=a.code.split('.'), pb=b.code.split('.');
      var flA=parseInt(pa[0],10), flB=parseInt(pb[0],10);
      if(flA!==flB) return flA-flB;
      return parseInt(pa[1],10)-parseInt(pb[1],10);
    });
  document.getElementById('sumReminders').textContent=reminders.length;
  const rl=document.getElementById('reminderList');
  if(!reminders.length){ rl.innerHTML='<div class="empty-state">Nog geen reminders. Zodra je kamers afvinkt verschijnt hier automatisch een samenvatting.</div>'; return; }
  rl.innerHTML=reminders.map(room=>{
    let sterielText = room.sterile||'';
    sterielText = sterielText.replace(/Alles steriel; flessen (en glaswerk )?(zonder|met) sticker/gi, 'Alles steriel');
    sterielText = sterielText.replace(/Alles steriel (zonder|met) sticker/gi, 'Alles steriel');
    sterielText = sterielText.replace(/ (met|zonder) sticker/gi, '');
    sterielText = sterielText.replace(/Niets steriel; alleen flessen met rode dop \(plastic rondje erin\)/gi, 'Alleen flessen met rode dop (plastic rondje erin) steriel');
    
    let noteText = room.note || '';
    noteText = noteText.replace(/Schoon en vuil op dezelfde plek\.\s*/gi, '');
    noteText = noteText.replace(/Schoon en vuil op dezelfde plek/gi, '');
    
    const isNiet = /^(niet|niets|nee|no\b)/i.test(sterielText.trim());
    const borderColor = isNiet ? 'var(--c-danger)' : 'var(--c-success)';
    const tagBg    = isNiet ? 'color-mix(in srgb,var(--c-danger) 12%,transparent)' : 'color-mix(in srgb,var(--c-success) 12%,transparent)';
    const tagColor = isNiet ? 'var(--c-danger)' : 'var(--c-success)';
    const tagLabel = isNiet ? 'Niet steriel' : 'Steriel';
    return `<div style="border-radius:var(--r-lg);border:1px solid var(--c-border);border-left:4px solid ${borderColor};background:var(--c-surface);margin-bottom:var(--s3);overflow:hidden;">
      <div style="display:flex;align-items:flex-start;gap:var(--s3);padding:12px var(--s4);">
        <div style="min-width:52px;height:52px;border-radius:var(--r-sm);background:var(--c-pill-bg);color:var(--c-accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:800;">${fmtCode(room.code)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
            <span style="font-size:12px;color:var(--c-muted);">${room.area}</span>
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;background:${tagBg};color:${tagColor};">${tagLabel}</span>
          </div>
          <div style="font-size:13px;font-weight:600;line-height:1.5;">${sterielText}</div>
          ${noteText && !isNiet ? `<div style="font-size:12px;color:var(--c-muted);margin-top:5px;line-height:1.5;padding-top:5px;border-top:1px solid var(--c-border);">${noteText}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

document.getElementById('clearRouteBtn').addEventListener('click', function(){
  if (this.dataset.armed === '1') {
    this.dataset.armed = '';
    this.classList.remove('armed');
    this.textContent = 'Ronde leegmaken';
    getRoute().rooms.forEach(rm=>{ const s=getRoomState(rm.code); s.visited=null; s.picked=null; });
    saveState(); renderSummary(); renderHeroStats(); showToast('Ronde leeggemaakt');
    return;
  }
  this.dataset.armed = '1';
  this.classList.add('armed');
  this.textContent = 'Nogmaals tikken om te legen';
  var btn = this;
  setTimeout(function(){ if (btn.dataset.armed === '1') { btn.dataset.armed=''; btn.classList.remove('armed'); btn.textContent='Ronde leegmaken'; } }, 3000);
});

/* -- UPDATE FILTER COUNTS --------------------------------- */

function updateFilterCounts(){

  // just refresh hero stats, no full re-render needed

  renderHeroStats();

}





/* -- FLOATING SCROLL NAV ---------------------------------- */

let floatRoomIndex = 0;

function getVisibleRoomIds(){

  return Array.from(document.querySelectorAll('#roomsList .room-card')).map(c=>c.id);

}

function scrollToRoomByIndex(idx){

  const ids=getVisibleRoomIds();

  if(!ids.length) return;

  floatRoomIndex=Math.max(0,Math.min(idx,ids.length-1));

  const el=document.getElementById(ids[floatRoomIndex]);

  if(el) el.scrollIntoView({behavior:'smooth',block:'center'});

  updateFloatCounter();

}

function updateFloatCounter(){

  const ids=getVisibleRoomIds();

  document.getElementById('floatCounter').textContent=(floatRoomIndex+1)+' / '+(ids.length||1);

}

function findClosestRoomIndex(){

  const ids=getVisibleRoomIds();

  if(!ids.length) return 0;

  const scrollEl=document.querySelector('#view-rooms .scroll-region');

  const viewH=scrollEl?scrollEl.getBoundingClientRect().height:window.innerHeight;

  const viewTop=scrollEl?scrollEl.getBoundingClientRect().top:0;

  let best=0, bestDist=Infinity;

  ids.forEach((id,i)=>{

    const el=document.getElementById(id);

    if(!el) return;

    const r=el.getBoundingClientRect();

    const elMid=r.top+r.height/2;

    const dist=Math.abs(elMid-(viewTop+viewH/2));

    if(dist<bestDist){bestDist=dist;best=i;}

  });

  return best;

}

document.getElementById('floatPrev').addEventListener('click',()=>{

  floatRoomIndex=findClosestRoomIndex();

  scrollToRoomByIndex(floatRoomIndex-1);

});

document.getElementById('floatNext').addEventListener('click',()=>{

  floatRoomIndex=findClosestRoomIndex();

  scrollToRoomByIndex(floatRoomIndex+1);

});



/* -- INIT ------------------------------------------------- */

loadState();

// apply persisted theme

document.documentElement.setAttribute('data-theme', state.theme || 'light');

renderHome();

doSearch();

// sync persisted filter pill

document.querySelectorAll('.filter-pill').forEach(x=>x.classList.toggle('active', x.dataset.filter===state.filter));

// restore last active view

if (state.activeView && state.activeView !== 'home') switchView(state.activeView);



// SW

if('serviceWorker' in navigator){

  navigator.serviceWorker.register('./sw.js').then(function(reg){

    reg.addEventListener('updatefound', function(){

      var nw = reg.installing;

      if(!nw) return;

      nw.addEventListener('statechange', function(){

        if(nw.state==='installed' && navigator.serviceWorker.controller){

          // nieuwe versie klaar: laad de pagina opnieuw zodat updates meteen zichtbaar zijn

          location.reload();

        }

      });

    });

    // controleer direct op een nieuwere sw.js (bijv. na een deploy)

    if(reg.update) reg.update().catch(()=>{});

  }).catch(()=>{});

}



function renderSortControls(){

  var fc = document.getElementById('sortFloorCtl');

  var zo = document.getElementById('zoneOrderCtl');

  var zr = document.getElementById('zoneRevCtl');

  if(!fc||!zo||!zr) return;

  var r = getRoute();

  var floors = [];

  r.rooms.forEach(function(rm){ var fl=floorOf(rm); if(floors.indexOf(fl)===-1) floors.push(fl); });

  if (!selectedSortFloor || floors.indexOf(selectedSortFloor)===-1) selectedSortFloor = floors[0];

  var cfg = state.roomSort[selectedSortFloor] || { zones: (DEFAULT_SORT.zones||[]).slice(), zoneRev: {} };

  // floor picker

  fc.innerHTML = floors.map(function(fl){

    return '<button class="filter-pill'+(fl===selectedSortFloor?' active':'')+'" data-floor="'+fl+'">'+fl+'</button>';

  }).join('');

  fc.querySelectorAll('[data-floor]').forEach(function(b){

    b.addEventListener('click', function(){

      selectedSortFloor = b.dataset.floor;

      renderSortControls();

    });

  });

  // zones that the selected floor actually has

  var floorZonesSet = {};

  r.rooms.forEach(function(rm){ if(floorOf(rm)===selectedSortFloor){ var z=zoneOf(rm); if(z) floorZonesSet[z]=true; } });

  var floorZones = Object.keys(floorZonesSet);

  // zone order -- drag chips to reorder (only the zones this floor has)

  var allZones = ['Noord','Midden','Zuid'];

  var revInit = {Noord:'N', Midden:'M', Zuid:'Z'};

  var order = (cfg.zones && cfg.zones.length) ? cfg.zones.slice() : allZones.slice();

  // keep only zones the floor has, preserving the saved order; append any new ones

  order = order.filter(function(z){ return floorZonesSet[z]; });

  floorZones.forEach(function(z){ if(order.indexOf(z)===-1) order.push(z); });

  zo.innerHTML = '<div class="zone-drag-wrap" id="zoneDragWrap">'

    + order.map(function(z){ return '<button type="button" class="zone-drag-chip" data-zone-drag="'+z+'"><span class="drag-handle" aria-hidden="true">&#x28FF;</span>'+revInit[z]+'</button>'; }).join('')

    + '</div>';

  // per-zone direction (only zones this floor has)

  zr.innerHTML = order.map(function(z){

    var isRev = !!cfg.zoneRev[z];

    return '<button class="filter-pill'+(isRev?' active':'')+'" data-zone="'+z+'" title="'+z+(isRev?' (omgekeerd)':'')+'">'+revInit[z]+(isRev?' &#8595;':' &#8593;')+'</button>';

  }).join('');

  initZoneDrag();

  zr.querySelectorAll('[data-zone]').forEach(function(b){

    b.addEventListener('click', function(){

      var z = b.dataset.zone;

      if (!state.roomSort[selectedSortFloor]) state.roomSort[selectedSortFloor] = { zones:(DEFAULT_SORT.zones||[]).slice(), zoneRev:{} };

      state.roomSort[selectedSortFloor].zoneRev[z] = !state.roomSort[selectedSortFloor].zoneRev[z];

      saveState(); renderSortControls(); renderRooms();

    });

  });

}

function initZoneDrag(){

  var wrap = document.getElementById('zoneDragWrap');

  if (!wrap || !window.PointerEvent) return;

  var dragEl = null, pid = null;

  function commit(){

    var seq = Array.prototype.slice.call(wrap.children).map(function(c){ return c.dataset.zoneDrag; });

    if (!state.roomSort[selectedSortFloor]) state.roomSort[selectedSortFloor] = { zones:(DEFAULT_SORT.zones||[]).slice(), zoneRev:{} };

    state.roomSort[selectedSortFloor].zones = seq;

    saveState(); renderSortControls(); renderRooms();

  }

  wrap.addEventListener('pointerdown', function(e){

    var btn = e.target.closest('.zone-drag-chip');

    if (!btn) return;

    dragEl = btn; pid = e.pointerId;

    btn.classList.add('dragging');

    try { btn.setPointerCapture(pid); } catch(err){}

    if (navigator.vibrate) navigator.vibrate(10);

  });

  wrap.addEventListener('pointermove', function(e){

    if (!dragEl || e.pointerId !== pid) return;

    var others = Array.prototype.slice.call(wrap.querySelectorAll('.zone-drag-chip:not(.dragging)'));

    var next = null;

    for (var i=0;i<others.length;i++){

      var box = others[i].getBoundingClientRect();

      if (e.clientX < box.left + box.width/2) { next = others[i]; break; }

    }

    var oldPos = {};

    others.forEach(function(b){ oldPos[b.dataset.zoneDrag] = b.getBoundingClientRect(); });

    wrap.insertBefore(dragEl, next || null);

    others.forEach(function(b){

      var ob = oldPos[b.dataset.zoneDrag];

      var nb = b.getBoundingClientRect();

      var dx = ob.left - nb.left;

      if (dx !== 0 && b.animate) {

        b.animate([{transform:'translateX('+dx+'px)'},{transform:'translateX(0)'}], {duration:180, easing:'cubic-bezier(0.2,0.8,0.2,1)'});

      }

    });

  });

  function stop(e){

    if (!dragEl || e.pointerId !== pid) return;

    dragEl.classList.remove('dragging');

    try { if (dragEl.hasPointerCapture(pid)) dragEl.releasePointerCapture(pid); } catch(err){}

    dragEl = null; pid = null;

    commit();

  }

  wrap.addEventListener('pointerup', stop);

  wrap.addEventListener('pointercancel', stop);

}

function renderInstellen(){var r=getRoute();var rooms=r?r.rooms:[];var c=document.getElementById('installenList');renderSortControls();var skipSection='<div class="skip-chips-section"><div class="skip-chips-title">Overslaan vandaag</div><div class="skip-chips-grid">';rooms.forEach(function(room){var s=peekRoomState(room.code);skipSection+='<button class="skip-chip'+(s.skipped?' skip-chip-active':'')+'" data-skip-chip="'+room.code+'">'+fmtCode(room.code)+'</button>';});skipSection+='</div></div>';if(c){c.innerHTML=skipSection;c.querySelectorAll('[data-skip-chip]').forEach(function(btn){btn.addEventListener('click',function(){var code=this.dataset.skipChip;var s=getRoomState(code);s.skipped=!s.skipped;this.classList.toggle('skip-chip-active',s.skipped);saveState();renderRooms();});});}
}

    

/* -- ALGEMENE INFO TOGGLE -- */

var _algToggle=document.getElementById('algInfoToggle');if(_algToggle)_algToggle.addEventListener('click', function() {

  var body = document.getElementById('algInfoBody');

  var chev = document.getElementById('algInfoChevron');

  var open = body.style.display === 'block';

  body.style.display = open ? 'none' : 'block';

  chev.style.transform = open ? '' : 'rotate(180deg)';

});






