/* -- DATA ------------------------------------------------ */

const weekSchedules = [

  { id:'week-a', label:'Week A', detail:'Verd. 0+5', routes:['0-5'] },

  { id:'week-b', label:'Week B', detail:'Verd. 2+4', routes:['2-4'] },

  { id:'week-c', label:'Week C', detail:'Verd. 3+1', routes:['3-1'] }

];

const routeData = {

'0-5':{ title:'Ronde 0 + 5', subtitle:'Verdieping 0 en 5', floors:['0','5'], rooms:[

  {code:'0.307',area:'0 Zuid',sterile:'Niet steriel',note:'Glazen deur.'},

  {code:'0.337',area:'0 Zuid',sterile:'Niet steriel',note:'Tweede glazen deur.'},

  {code:'0.207',area:'0 Midden',sterile:'Alles steriel met sticker',note:'Bij de printer.'},

  {code:'5.127',area:'5 Noord',sterile:'Niet steriel',note:'Linkerlab: spullen terugzetten.'},

  {code:'5.132',area:'5 Noord',sterile:'Niets steriel (Maarten)',note:'Klein bakje: aluminiumfolie maar niet steriel. Flessen wel steriel.'},

  {code:'5.140',area:'5 Noord',sterile:'Alleen flessen steriel met sticker',note:'Linkerlab: spullen terugzetten op werktafel.'},

  {code:'5.147',area:'5 Noord',sterile:'Alleen flessen steriel met sticker (5147F + 5147B)',note:'5147F en 5147B: alleen flessen steriel met sticker.'},

  {code:'5.149',area:'5 Noord',sterile:'Alles steriel met sticker',note:'Deur via 5.147H om de hoek. Flessen met gele MW-sticker &rarr; vullen met MilliQ + steriliseren bij vloeistoffen.'},

  {code:'5.207',area:'5 Midden',sterile:'Glaswerk steriel met sticker (indien aanwezig)',note:'Bijna altijd zakjes/doosjes, zelden naar binnen. Als er glaswerk is &rarr; steriel met sticker.'},

  {code:'5.213',area:'5 Midden',sterile:'Niets steriel',note:'Merlin, tweede deur.'},

  {code:'5.237',area:'5 Midden',sterile:'Flessen steriel zonder sticker; glaswerk alleen in aluminiumfolie (niet steriel)',note:'Tweede deur. Ronde plastic fles ook steriel in autoclaaf.'},

  {code:'5.249',area:'5 Midden',sterile:'Niets steriel',note:'Vaak dicht.'},

  {code:'5.301',area:'5 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'Plastic bakjes: in groen zakje sealen + autoclaaf.'},

  {code:'5.307',area:'5 Zuid',sterile:'Alles steriel; flessen en glaswerk zonder sticker',note:''},

  {code:'5.313',area:'5 Zuid',sterile:'Niets steriel',note:''},

  {code:'5.325',area:'5 Zuid',sterile:'Niets steriel',note:''},

  {code:'5.337',area:'5 Zuid',sterile:'Niets steriel',note:''},

  {code:'5.345',area:'5 Zuid',sterile:'Alleen flessen steriel zonder sticker',note:''}

]},

'2-4':{ title:'Ronde 2 + 4', subtitle:'Verdieping 2 en 4', floors:['2','4'], rooms:[

  {code:'2.101',area:'2 Noord',sterile:'Niet steriel',note:''},

  {code:'2.313',area:'2 Zuid',sterile:'Alles steriel met sticker',note:''},

  {code:'2.323',area:'2 Zuid',sterile:'Niets steriel',note:''},

  {code:'2.331',area:'2 Zuid',sterile:'Niets steriel',note:''},

  {code:'2.347',area:'2 Zuid',sterile:'Niet steriel',note:'Rechts van de twee.'},

  {code:'2.353',area:'2 Zuid',sterile:'Niet steriel',note:'Links.'},

  {code:'2.359',area:'2 Zuid',sterile:'Niets steriel',note:''},
  {code:'4.110',area:'4 Noord',sterile:'Niet steriel',note:''},

  {code:'4.230',area:'4 Midden',sterile:'Niets steriel',note:''},

  {code:'4.231',area:'4 Midden',sterile:'Niets steriel; alleen flessen met rode dop (plastic rondje erin) met sticker',note:'Alleen flessen met rode dop + plastic rondje &rarr; met sticker steriel.'},

  {code:'4.237',area:'4 Midden',sterile:'Niets steriel',note:''},

  {code:'4.305',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'4.305, 4.307 en 4.313 liggen aan beide kanten &ndash; zelfde lab.'},

  {code:'4.307',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'4.305, 4.307 en 4.313 liggen aan beide kanten &ndash; zelfde lab.'},

  {code:'4.313',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'4.305, 4.307 en 4.313 liggen aan beide kanten &ndash; zelfde lab.'},

  {code:'4.319',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:''},

  {code:'4.323',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'Staat op dezelfde plek als 4.329.'},

  {code:'4.329',area:'4 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:'Staat op dezelfde plek als 4.323.'},

  {code:'4.149',area:'4 Noord',sterile:'Niets steriel',note:''},

  {code:'4.159',area:'4 Noord',sterile:'Flessen steriel met sticker; gewoon glaswerk niet',note:''},

  {code:'4.161',area:'4 Noord',sterile:'Niets steriel',note:''},

  {code:'4.141',area:'4 Noord',sterile:'Niets steriel',note:'Aan linkerkant schoon neerzetten.'}

]},

'3-1':{ title:'Ronde 3 + 1', subtitle:'Verdieping 3 en 1', floors:['3','1'], rooms:[

  {code:'1.303',area:'1 Zuid',sterile:'Alles steriel; flessen zonder sticker',note:''},

  {code:'1.305',area:'1 Zuid',sterile:'Niets steriel',note:''},

  {code:'1.307',area:'1 Zuid',sterile:'Niets steriel',note:''},

  {code:'1.317',area:'1 Zuid',sterile:'Niets steriel',note:''},

  {code:'1.321',area:'1 Zuid',sterile:'Alles steriel; flessen met sticker',note:'Schoon en vuil op dezelfde plek. Plastic erlenmeyers: 4&times; aluminiumfolie + groene sticker &rarr; autoclaaf. Grote flessen: stoof met dubbel aluminiumfolie. Doppen apart in twee verschillende zakjes &rarr; autoclaaf.'},

  {code:'1.323',area:'1 Zuid',sterile:'Alles steriel; flessen met sticker',note:'Schoon en vuil op dezelfde plek.'},

  {code:'1.325',area:'1 Zuid',sterile:'Niets steriel',note:''},

  {code:'3.305',area:'3 Zuid',sterile:'Alles steriel; flessen met sticker',note:''},

  {code:'3.309',area:'3 Zuid',sterile:'Alles steriel; flessen met sticker',note:''},

  {code:'3.311',area:'3 Zuid',sterile:'Alles steriel; flessen met sticker',note:''},

  {code:'3.319',area:'3 Zuid',sterile:'Alleen flessen steriel met sticker',note:''},

  {code:'3.207',area:'3 Midden',sterile:'Zakjes en bakjes steriel',note:'Bijna altijd alleen zakjes en bakjes &rarr; moeten steriel.'},

  {code:'3.201',area:'3 Midden',sterile:'Zakjes en bakjes steriel',note:'Bijna altijd alleen zakjes en bakjes &rarr; moeten steriel.'},

  {code:'3.159',area:'3 Noord',sterile:'Alleen zakjes terugbrengen (worden gebracht)',note:'Zakjes bij de linkerdeur terugbrengen.'},

  {code:'3.143',area:'3 Noord',sterile:'Niets steriel',note:''},

  {code:'3.137',area:'3 Noord',sterile:'Alles steriel; flessen met sticker',note:'3.135 en 3.137 horen bij elkaar.'},

  {code:'3.135',area:'3 Noord',sterile:'Alles steriel; flessen met sticker',note:'3.135 en 3.137 horen bij elkaar.'},

  {code:'3.117',area:'3 Noord',sterile:'Alles steriel; flessen met sticker',note:'Na de lift (lift bij 3.100). Flessen met MQ-sticker (groen gestreept) &rarr; vullen met MilliQ + steriliseren.'},

  {code:'1.119',area:'1 Noord',sterile:'Niets steriel',note:'Grote plastic flessen bij vuil &rarr; vullen met MilliQ (niet steriel). Klein bakje met kleine glazen bakjes &rarr; spoelmachine op programma 3 (niet 1).'},

  {code:'1.132',area:'1 Noord',sterile:'Alleen driehoekige flessen steriel met sticker',note:'Driehoekige fles (dop heeft 3 puntjes) &rarr; steriel met sticker. De rest niets.'},

  {code:'1.137',area:'1 Noord',sterile:'Niet steriel',note:''}

]}

};




/* --- ALL ROOMS FOR STATION LOOKUP --- */
var allRooms = [];
Object.keys(routeData).forEach(function(k){
  allRooms = allRooms.concat(routeData[k].rooms);
});

function isNietSteriel(sterielText){
  return /^(niet|niets|nee|no\b)/i.test((sterielText||'').trim());
}
function fmtDateTime(iso){
  if(!iso) return '';
  var d = new Date(iso);
  var date = d.toLocaleDateString('nl-NL',{day:'2-digit',month:'2-digit'});
  var time = d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  return time + ' ' + date;
}

