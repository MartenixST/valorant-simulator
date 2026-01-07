function getActiveSave() {
  try {
    const id = localStorage.getItem('activeSaveId');
    if (!id) return null;
    const localSave = localStorage.getItem(`save_${id}`);
    return localSave ? JSON.parse(localSave) : null;
  } catch (e) {
    console.error("getActiveSave: Error retrieving active save:", e);
    return null;
  }
}

function updateActiveSave(updatedSave) {
  console.log("updateActiveSave: Received updatedSave:", updatedSave);
  try {
    if (updatedSave && updatedSave.id) {
      localStorage.setItem(`save_${updatedSave.id}`, JSON.stringify(updatedSave));
      console.log("updateActiveSave: Successfully updated and stored save.");
    }
  } catch (e) {
    console.error("updateActiveSave: Error updating active save:", e);
  }
}

function ensureOffseasonState(save) {
  if (!save.offseason) {
    save.offseason = { week: 1, offers: [], phase: 'offseason' };
  }
  if (!('phase' in save.offseason)) save.offseason.phase = 'offseason';
  if (typeof save.seasonWeek !== 'number') save.seasonWeek = 0;
}

function generateOffer() {
  const roles = ['Duelist','Initiator','Controller','Sentinel','Flex'];
  const names = ['Raze','Jett','Sage','Breach','Omen','Skye','Viper','Killjoy','Fade','Reyna'];
  const name = names[Math.floor(Math.random()*names.length)] + '_' + Math.floor(Math.random()*1000);
  const role = roles[Math.floor(Math.random()*roles.length)];
  const salary = (Math.floor(Math.random()*15)+5) * 10_000; // 50k - 200k
  const acceptChance = Math.random()*0.6 + 0.2; // 20%-80%
  return { id: Date.now() + Math.random().toString(36).substr(2, 9), name, role, salary, acceptChance };
}

export function renderOffseason() {
  const save = getActiveSave();
  const meta = document.getElementById('offseasonMeta');
  const offers = document.getElementById('offers');
  if (!save || !meta || !offers) return;
  ensureOffseasonState(save);


  if (save.offseason.phase === 'offseason' && save.offseason.week <= 7) {
    meta.innerHTML = `Offseason — Week ${save.offseason.week}: Build your roster. Make offers and press Next Week.`;
    if (save.offseason.offers.length === 0) {
      // seed some offers at the start of a week
      for (let i=0; i<5; i++) save.offseason.offers.push(generateOffer());
      updateActiveSave(save);
    }
    offers.style.display = '';
    offers.innerHTML = '';
    save.offseason.offers.forEach(o => {
      const div = document.createElement('div');
      div.className = 'offer-card';
      div.innerHTML = `<strong>${o.name}</strong> - ${o.role} — $${o.salary.toLocaleString()} / season `;
      const btn = document.createElement('button');
      btn.textContent = 'Offer Contract';
      btn.onclick = function() {
        o.offered = true; updateActiveSave(save); renderOffseason();
      };
      div.appendChild(btn);
      offers.appendChild(div);
    });
  } else {
    // Regular season phase
    offers.style.display = 'none';
    const weekLabel = save.seasonWeek > 0 ? save.seasonWeek : 1;
    meta.innerHTML = `Season — Game Day ${weekLabel}. Press Next Week to advance toward playoffs and LANs.`;
  }
}

export function simulateNextWeek() {
  let save = getActiveSave();
  if (!save) return;
  save = JSON.parse(JSON.stringify(save)); // Deep copy to ensure modifications are on a new object
  ensureOffseasonState(save);

  if (save.offseason.phase === 'offseason' && save.offseason.week <= 7) {
    // resolve offers
    const accepted = [];
    save.offseason.offers.forEach(o => {
      if (o.offered && Math.random() < o.acceptChance) accepted.push(o);
    });
    if (!save.roster) save.roster = [];
    accepted.forEach(o => {
      save.roster.push({ name: o.name, stats: { aim: 5, gamesense:5, teamplay:5, mental:5, consistency:5 }, salary: o.salary });
    });

    // next week or transition to season
    if (save.offseason.week >= 7) {
      console.log("simulateNextWeek: Transitioning to season. Current save.offseason.week:", save.offseason.week);
      save.offseason.phase = 'season';
      save.offseason.offers = [];
      save.week = 1; // Set save.week to 1 for the start of the regular season
      window.location.href = 'kickoff.html'; // Redirect to kickoff.html
    } else {
      console.log("simulateNextWeek: Advancing offseason week. Current save.offseason.week:", save.offseason.week);
      save.offseason.week += 1;
      save.offseason.offers = [];
    }
    console.log("simulateNextWeek: Save object BEFORE updateActiveSave:", save);
    updateActiveSave(save);
    renderOffseason();
    updateSeasonInfo(save);
    return;
  }

  // Season mode: advance game day counter
  if (save.offseason.phase !== 'offseason') {
    console.log("simulateNextWeek: Advancing season week. Current save.week:", save.week);
    save.week = (typeof save.week === 'number' ? save.week : 0) + 1; // Increment save.week during regular season
    updateActiveSave(save);
    renderOffseason();
    updateSeasonInfo(save);
  }
}