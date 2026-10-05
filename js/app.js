/* --- MODE / DUTY SWITCHER --- */
var appMode = 'ronde';
try { appMode = localStorage.getItem('cgsa_workflow_mode') || 'ronde'; } catch(e){}

function setAppMode(mode){
  appMode = mode;
  try { localStorage.setItem('cgsa_workflow_mode', mode); } catch(e){}
  var btnRonde = document.getElementById('modeBtnRonde');
  var btnStation = document.getElementById('modeBtnStation');
  if(btnRonde) btnRonde.classList.toggle('active', mode === 'ronde');
  if(btnStation) btnStation.classList.toggle('active', mode === 'station');

  var floatNav = document.getElementById('floatNav');
  var pill = document.getElementById('topbarRoutePill');

  if(mode === 'ronde'){
    if(pill) pill.style.display = '';
    var bLr = document.getElementById('bottomNavLr');
    var bSt = document.getElementById('bottomNavStation');
    if(bLr) { bLr.classList.remove('hidden'); bLr.style.display = ''; }
    if(bSt) { bSt.classList.add('hidden'); bSt.style.display = 'none'; }
    var logoSub = document.getElementById('logoSub');
    if(logoSub) logoSub.textContent = 'Lab Rondes Tracker';
    if(typeof switchView === 'function') switchView(state.activeView || 'home');
  } else {
    if(pill) pill.style.display = 'none';
    var bLr = document.getElementById('bottomNavLr');
    var bSt = document.getElementById('bottomNavStation');
    if(bLr) { bLr.classList.add('hidden'); bLr.style.display = 'none'; }
    if(bSt) { bSt.classList.remove('hidden'); bSt.style.display = ''; }
    var logoSub = document.getElementById('logoSub');
    if(logoSub) logoSub.textContent = 'CGSA-Tracker';
    if(floatNav) floatNav.style.display = 'none';
    if(typeof switchStationView === 'function') switchStationView(stationState.activeView || 'overzicht');
  }
}
window.setAppMode = setAppMode;
window.switchStationView = switchStationView;

var modeBtnRonde = document.getElementById('modeBtnRonde');
if(modeBtnRonde) modeBtnRonde.addEventListener('click', function(){ setAppMode('ronde'); });
var modeBtnStation = document.getElementById('modeBtnStation');
if(modeBtnStation) modeBtnStation.addEventListener('click', function(){ setAppMode('station'); });

/* --- INITIALIZE UNIFIED APP --- */
loadState();
loadStationState();
renderUserDropdown();
setupAdminPanelEvents();
setCurrentUser(currentUser);
setAppMode(appMode);
initCloudSync();

