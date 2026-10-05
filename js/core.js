/* -- HELPERS ---------------------------------------------- */

function fmtCode(code){ return code ? code.replace(/\./g,'') : code; }

function routeRoomArea(code){ var r=getRoute(); if(!r||!r.rooms) return ''; for(var i=0;i<r.rooms.length;i++){ if(r.rooms[i].code===code) return r.rooms[i].area; } return ''; }



/* -- STATE ----------------------------------------------- */

const state = {

  weekId: weekSchedules[0].id,

  routeId: weekSchedules[0].routes[0],

  filter: 'all',

  roomStates: {},

  activeView: 'home',

  theme: 'light',

  customFloorOrder: [],

  roomSort: {}

};



function loadState(){ try{ const s=localStorage.getItem('labRondes2'); if(s){const p=JSON.parse(s);if(p.roomStates){state.roomStates=p.roomStates;if(p.weekId)state.weekId=p.weekId;if(p.routeId&&routeData[p.routeId])state.routeId=p.routeId;if(p.filter)state.filter=p.filter;if(p.customFloorOrder&&Array.isArray(p.customFloorOrder))state.customFloorOrder=p.customFloorOrder;if(p.activeView)state.activeView=p.activeView;if(p.theme)state.theme=p.theme;if(p.roomSort&&!Array.isArray(p.roomSort.zones))state.roomSort=p.roomSort;}else{state.roomStates=p;}} if(state.theme){ document.documentElement.setAttribute('data-theme', state.theme); } }catch(e){} }

function saveState(){ try{ localStorage.setItem('labRondes2',JSON.stringify({roomStates:state.roomStates,weekId:state.weekId,routeId:state.routeId,filter:state.filter,activeView:state.activeView,theme:state.theme,customFloorOrder:state.customFloorOrder,roomSort:state.roomSort})); }catch(e){} }

function getRoomState(code){ if(!state.roomStates[code]) state.roomStates[code]={visited:null,picked:null,checks:[false,false,false,false],skipped:false}; if(!state.roomStates[code].checks) state.roomStates[code].checks=[false,false,false,false]; if(state.roomStates[code].skipped===undefined)state.roomStates[code].skipped=false; return state.roomStates[code]; }

function peekRoomState(code){ var s=state.roomStates[code]; if(!s) return {visited:null,picked:null,checks:[false,false,false,false],skipped:false}; return {visited:s.visited==null?null:s.visited,picked:s.picked==null?null:s.picked,checks:s.checks||[false,false,false,false],skipped:!!s.skipped}; }

function zoneOf(room){ var a=(room.area||'').split(' '); return a[1] || ''; }

function floorOf(room){ var a=(room.area||'').split(' '); return a[0] || ''; }

var DEFAULT_SORT = { zones: ['Noord','Midden','Zuid'], zoneRev: {} };

var selectedSortFloor = null;

function getFloorSort(fl){ return state.roomSort[fl] || DEFAULT_SORT; }

function applyRoomSort(rooms){

  // group by floor, sort each floor independently with its own settings

  var byFloor = {};

  var floorOrder = [];

  rooms.forEach(function(rm){

    var fl = floorOf(rm);

    if (!byFloor[fl]) { byFloor[fl] = []; floorOrder.push(fl); }

    byFloor[fl].push(rm);

  });

  var out = [];

  floorOrder.forEach(function(fl){

    var cfg = getFloorSort(fl);

    var order = cfg.zones || ['Noord','Midden','Zuid'];

    var rev = cfg.zoneRev || {};

    var idx = {}; order.forEach(function(z,i){ idx[z]=i; });

    var arr = byFloor[fl].slice();

    arr.sort(function(a,b){

      var za = idx[zoneOf(a)]; if(za===undefined) za=999;

      var zb = idx[zoneOf(b)]; if(zb===undefined) zb=999;

      if (za !== zb) return za - zb;

      var dir = rev[zoneOf(a)] ? -1 : 1;

      return (a.code < b.code ? -1 : (a.code > b.code ? 1 : 0)) * dir;

    });

    out = out.concat(arr);

  });

  return out;

}

function haptic(kind){ try{ if(!navigator.vibrate) return; if(kind==='yes') navigator.vibrate(12); else if(kind==='no') navigator.vibrate([10,20,10]); else navigator.vibrate(8); }catch(e){} }

function jumpToRoom(code){

  if (state.activeView !== 'rooms') switchView('rooms');

  setTimeout(function(){

    var cardId = 'rc-' + code.replace(/\./g,'-');

    var el = document.getElementById(cardId);

    if (el) el.scrollIntoView({behavior:'smooth', block:'center'});

  }, 260);

}

function getRoute() {

  const ord = state.customFloorOrder || [];



  // Use the normal Week A / B / C route if no custom route is started

  if (!ord.length) {

    return routeData[state.routeId] || {

      title: 'Nog geen route',

      subtitle: '',

      floors: [],

      rooms: []

    };

  }



  const allRooms = [];

  const floorNames = [];



  ord.forEach(function(f) {

    Object.values(routeData).forEach(function(rd) {

      if (rd.floors && rd.floors.includes(f)) {

        rd.rooms

          .filter(function(r) {

            return r.code.startsWith(f + '.');

          })

          .forEach(function(r) {

            if (!allRooms.find(function(x) {

              return x.code === r.code;

            })) {

              allRooms.push(r);

            }

          });



        if (!floorNames.includes(f)) {

          floorNames.push(f);

        }

      }

    });

  });



  return {

    title: 'Verd. ' + ord.join('+'),

    subtitle: 'Verdieping ' + ord.join(' en '),

    floors: floorNames,

    rooms: allRooms,

    custom: true

  };

}

/* -- TOAST ----------------------------------------------- */

let toastTimer;

function showToast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2000); }



/* -- NAVIGATION ------------------------------------------ */

function switchView(viewId){

  state.activeView=viewId;

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));

  var target = document.getElementById('view-'+viewId);
  if(!target){ console.warn('switchView: unknown viewId', viewId); return; }
  target.classList.add('active');

  document.querySelectorAll('#bottomNavLr .nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===viewId));

  state.activeView=viewId; saveState();

  // show float scroll nav only on rooms view

  document.getElementById('floatNav').style.display=viewId==='rooms'?'flex':'none';

  if(viewId==='rooms'){renderRooms(); setTimeout(function(){
    updateFloatCounter();
    var cards=Array.from(document.querySelectorAll('#roomsList .room-card'));
    if(!cards.length) return;
    function isPending(card){ var code=card.id.replace('rc-','').replace(/-/g,'.'); var st=peekRoomState(code); return st.visited!==true&&!st.skipped; }

    // If no rooms have been visited yet (fresh day or after Dag afsluiten), always show the first room!
    var anyVisited = cards.some(function(card){
      var code = card.id.replace('rc-','').replace(/-/g,'.');
      return peekRoomState(code).visited === true;
    });

    var target = null;
    if(!anyVisited || !lastTouchedRoom){
      target = cards[0];
    } else {
      // Find anchor: card of lastTouchedRoom in the visible list
      var anchorIdx=-1;
      var anchorId='rc-'+lastTouchedRoom.replace(/\./g,'-');
      for(var ai=0;ai<cards.length;ai++){if(cards[ai].id===anchorId){anchorIdx=ai;break;}}
      
      // Scan forward from anchor for first pending room
      for(var ni=anchorIdx+1;ni<cards.length;ni++){if(isPending(cards[ni])){target=cards[ni];break;}}
      // Fallback: first pending from top
      if(!target){for(var ni2=0;ni2<cards.length;ni2++){if(isPending(cards[ni2])){target=cards[ni2];break;}}}
      // Fallback: anchor card itself
      if(!target&&anchorIdx>=0) target=cards[anchorIdx];
      // Fallback: first card
      if(!target) target=cards[0];
    }

    if(target){
      floatRoomIndex=cards.indexOf(target);
      updateFloatCounter();
      target.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },80); }

  if(viewId==='summary') renderSummary();

  if(viewId==='home') renderHome();

  if(viewId==='instellen') renderInstellen();

  if(viewId==='search'){
    var inp = document.getElementById('searchInput');
    if(inp) focusSearchInput(inp);
    if(typeof doSearch === 'function') doSearch();
  }
}

function focusSearchInput(inp){
  if(!inp) return;
  inp.focus();
  setTimeout(function(){
    try {
      inp.focus();
      var len = inp.value.length;
      inp.setSelectionRange(len, len);
    } catch(e){}
  }, 40);
}

document.querySelectorAll('#bottomNavLr .nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    var v = btn.dataset.view;
    switchView(v);
    if(v === 'search'){
      var inp = document.getElementById('searchInput');
      if(inp) focusSearchInput(inp);
    }
  });
});



/* -- THEME ----------------------------------------------- */

document.getElementById('themeBtn').addEventListener('click',()=>{

  const root=document.documentElement;

  root.setAttribute('data-theme',root.getAttribute('data-theme')==='dark'?'light':'dark');

  state.theme=root.getAttribute('data-theme');

  saveState();

});


