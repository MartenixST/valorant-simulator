function getActiveSave() {
  try {
    const id = localStorage.getItem('activeSaveId');
    if (!id) return null;
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    return saves.find(s => String(s.id) === String(id)) || null;
  } catch (e) {
    return null;
  }
}

function getEventTeams() {
  // First event uses ALL 12 teams from the region (no groups)
  const active = getActiveSave();
  if (!active || !active.standingsOrder) return null;

  // Determine player's region by where their team exists
  let regionOfPlayer = null;
  Object.keys(active.standingsOrder).forEach(region => {
    if (active.standingsOrder[region].includes(active.team)) regionOfPlayer = region;
  });
  if (!regionOfPlayer) regionOfPlayer = 'Americas';

  const order = active.standingsOrder[regionOfPlayer];
  const twelve = order.slice(0, 12);

  return { region: regionOfPlayer, teams12: twelve, playerTeam: active.team };
}

function buildPlayIns(teams12) {
  // First round of upper bracket
  // Pairings: (1 vs 8), (4 vs 5), (2 vs 7), (3 vs 6)
  // Teams 9-12 start in lower bracket
  return [
    [teams12[0], teams12[7]],
    [teams12[3], teams12[4]],
    [teams12[1], teams12[6]],
    [teams12[2], teams12[5]],
  ];
}

function buildQuarterFromPlayIns(playInWinners) {
  // Second round of upper bracket
  // Winners of first round face each other
  return [
    [playInWinners[0], playInWinners[1]],
    [playInWinners[2], playInWinners[3]],
  ];
}

function buildLowerBracket(teams12, playInLosers) {
  // First round of lower bracket
  // Teams 9-12 face losers from upper bracket first round
  return [
    [teams12[8], playInLosers[0]],
    [teams12[9], playInLosers[1]],
    [teams12[10], playInLosers[2]],
    [teams12[11], playInLosers[3]],
  ];
}

function createTeamEl(name, playerTeam) {
  const div = document.createElement('div');
  div.className = 'team-slot';
  div.textContent = name;
  if (name === playerTeam) div.classList.add('my-team');
  return div;
}

export function getEventsState() {
  const save = getActiveSave();
  if (!save) return null;
  if (!save.events) save.events = {};
  if (!save.events.bestOf) save.events.bestOf = 3;
  if (!save.events.series) save.events.series = {};
  // persist
  try {
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    const idx = saves.findIndex(s => String(s.id) === String(save.id));
    if (idx !== -1) { saves[idx] = save; localStorage.setItem('careerSaves', JSON.stringify(saves)); }
  } catch (e) {}
  return save.events;
}

function setEventsBestOf(value) {
  const st = getEventsState();
  if (!st) return;
  st.bestOf = Math.max(1, Math.min(5, parseInt(value, 10) || 3));
  // reset ongoing series scores when switching BO
  st.series = {};
  try {
    const save = getActiveSave();
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    const idx = saves.findIndex(s => String(s.id) === String(save.id));
    if (idx !== -1) { saves[idx] = save; localStorage.setItem('careerSaves', JSON.stringify(saves)); }
  } catch (e) {}
  renderBracket();
}

function simulateSeries(teamA, teamB, bestOf) {
  // Map-level simulation to provide per-map scores
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  let seriesA = 0, seriesB = 0;
  const maps = [];
  while (seriesA < winsNeeded && seriesB < winsNeeded) {
    let mapState = createNewMapState(teamA, teamB, maps.length + 1);
    while (!isMapComplete(mapState)) {
      playOneRound(mapState, teamA, teamB);
    }
    maps.push({ name: mapState.name, a: mapState.a, b: mapState.b });
    if (mapState.a > mapState.b) seriesA++; else seriesB++;
  }
  return { a: seriesA, b: seriesB, winner: seriesA > seriesB ? teamA : teamB, maps };
}

function simulateAllEvents() {
  const data = getEventTeams();
  const st = getEventsState();
  if (!data || !st) return;

  // QF
  const quarters = buildQuarterMatchups(data.a, data.b);
  const qWinners = quarters.map(([t1, t2], idx) => {
    const id = `QF${idx+1}-${t1}-vs-${t2}`;
    const res = simulateSeries(t1, t2, st.bestOf);
    st.series[id] = res;
    return res.winner;
  });

  // SF
  const semisPairs = [ [qWinners[0], qWinners[1]], [qWinners[2], qWinners[3]] ];
  const sWinners = semisPairs.map(([t1, t2], idx) => {
    const id = `SF${idx+1}-${t1}-vs-${t2}`;
    const res = simulateSeries(t1, t2, 5); // Semifinals are BO5
    st.series[id] = res;
    return res.winner;
  });

  // Final
  const finalPair = [sWinners[0], sWinners[1]];
  const finalId = `F-${finalPair[0]}-vs-${finalPair[1]}`;
  const finalRes = simulateSeries(finalPair[0], finalPair[1], 5); // Grand Final is BO5
  st.series[finalId] = finalRes;

  // Persist state
  try {
    const save = getActiveSave();
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    const idx = saves.findIndex(s => String(s.id) === String(save.id));
    if (idx !== -1) { saves[idx] = save; localStorage.setItem('careerSaves', JSON.stringify(saves)); }
  } catch (e) {}

  // Re-render bracket with winners present
  renderBracket();
}

window.setEventsBestOf = setEventsBestOf;
window.simulateAllEvents = simulateAllEvents;

// --- Watch series ---
function watchSeries(id, teamA, teamB, forceBestOf) {
  const st = getEventsState();
  if (!st) return;
  const bestOf = Math.max(1, forceBestOf || st.bestOf || 3);
  if (!st.live) st.live = {};
  if (!st.live[id]) st.live[id] = { a: 0, b: 0, bestOf };
  if (!st.live[id].map) st.live[id].map = createNewMapState(teamA, teamB);

  const panel = document.getElementById('eventWatch');
  if (!panel) return;
  panel.style.display = '';

  function renderPanel() {
    const state = st.live[id];
    const need = Math.floor(state.bestOf/2)+1;
    const map = state.map;
    panel.innerHTML = `Watching: ${teamA} vs ${teamB} — First to ${need}<br>` +
      `Series: ${state.a}-${state.b} | Map ${map.index} (${map.name}) — Rounds ${map.a}-${map.b} (Round ${map.round})<br>`;

    const logDiv = document.createElement('div');
    logDiv.style.maxHeight = '160px';
    logDiv.style.overflowY = 'auto';
    logDiv.style.margin = '8px 0';
    logDiv.style.padding = '6px';
    logDiv.style.border = '1px solid #2a2a2a';
    logDiv.style.borderRadius = '6px';
    logDiv.style.background = '#0f1117';
    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.paddingLeft = '18px';
    map.logs.slice(-30).forEach(entry => {
      const li = document.createElement('li');
      li.textContent = entry;
      ul.appendChild(li);
    });
    logDiv.appendChild(ul);
    panel.appendChild(logDiv);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Play Next Round';
    nextBtn.onclick = function(){
      const state = st.live[id];
      const need = Math.floor(state.bestOf/2)+1;
      if (state.a >= need || state.b >= need) return; // series done
      const map = state.map;
      playOneRound(map, teamA, teamB);
      if (isMapComplete(map)) {
        if (map.a > map.b) state.a++; else state.b++;
        if (state.a < need && state.b < need) {
          state.map = createNewMapState(teamA, teamB, map.index + 1);
        }
      }
      if (state.a >= need || state.b >= need) {
        const res = { a: state.a, b: state.b, winner: state.a > state.b ? teamA : teamB };
        st.series[id] = res;
        try { delete st.live[id]; } catch(e) {}
        panel.style.display = 'none';
      }
      renderPanel();
      renderBracket();
      persistEvents();
    };
    const finishBtn = document.createElement('button');
    finishBtn.textContent = 'Finish Series';
    finishBtn.onclick = function(){
      // fast-forward maps until series completion
      const need = Math.floor(state.bestOf/2)+1;
      while (state.a < need && state.b < need) {
        while (!isMapComplete(state.map)) {
          playOneRound(state.map, teamA, teamB);
        }
        if (state.map.a > state.map.b) state.a++; else state.b++;
        if (state.a >= need || state.b >= need) break;
        state.map = createNewMapState(teamA, teamB, state.map.index + 1);
      }
      const res = { a: state.a, b: state.b, winner: state.a > state.b ? teamA : teamB };
      st.series[id] = res;
      // clear live and hide panel
      try { delete st.live[id]; } catch(e) {}
      panel.style.display = 'none';
      // do not re-render panel contents once hidden
      renderBracket();
      persistEvents();
    };
    panel.appendChild(nextBtn);
    panel.appendChild(finishBtn);
  }

  renderPanel();
  persistEvents();
}

function simulateOneMatch(id, teamA, teamB, forceBestOf) {
  const st = getEventsState();
  if (!st) return;
  const res = simulateSeries(teamA, teamB, forceBestOf || st.bestOf || 3);
  st.series[id] = res;
  persistEvents();
  renderBracket();
}

export function persistEvents() {
  try {
    const save = getActiveSave();
    const saves = JSON.parse(localStorage.getItem('careerSaves')) || [];
    const idx = saves.findIndex(s => String(s.id) === String(save.id));
    if (idx !== -1) { saves[idx] = save; localStorage.setItem('careerSaves', JSON.stringify(saves)); }
  } catch (e) {}
}

// --- Map / Round simulation helpers ---
const MAP_POOL = [
  { name: 'Ascent', sites: ['A','B'] },
  { name: 'Bind', sites: ['A','B'] },
  { name: 'Haven', sites: ['A','B','C'] },
  { name: 'Split', sites: ['A','B'] },
  { name: 'Lotus', sites: ['A','B','C'] },
  { name: 'Sunset', sites: ['A','B'] },
];

function createNewMapState(teamA, teamB, index = 1) {
  const map = MAP_POOL[Math.floor(Math.random()*MAP_POOL.length)].name;
  return {
    index,
    name: map,
    a: 0,
    b: 0,
    round: 1,
    half: 1, // swap after 12 rounds
    atk: 'A', // which team is attacking this half: 'A' or 'B'
    logs: [],
  };
}

function playOneRound(map, teamA, teamB) {
  const cfg = MAP_POOL.find(m => m.name === map.name) || MAP_POOL[0];
  const site = cfg.sites[Math.floor(Math.random()*cfg.sites.length)];
  const attacker = map.atk === 'A' ? teamA : teamB;

  const aWins = Math.random() < 0.5;
  if (aWins) map.a++; else map.b++;

  const winnerTeam = aWins ? teamA : teamB;
  const line = `R${map.round}: ${attacker} executes ${map.name} ${site}-site — ${winnerTeam} win (${map.a}-${map.b})`;
  map.logs.push(line);

  map.round++;
  // halftime swap after 12 rounds (start of round 13)
  if (map.round === 13 && map.half === 1) {
    map.half = 2;
    map.atk = map.atk === 'A' ? 'B' : 'A';
    map.logs.push('— Halftime — sides swapped');
  }
}

function isMapComplete(map) {
  // First to 13 but must win by 2 once 12-12 is reached (simple OT)
  if (map.a >= 13 || map.b >= 13) {
    return Math.abs(map.a - map.b) >= 2;
  }
  return false;
}


