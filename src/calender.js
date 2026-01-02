// Regions with teams
const regions = {
  Americas: [
    "100 Thieves", "Cloud9", "Evil Geniuses", "FURIA", "KRÜ Esports",
    "Leviatán", "LOUD", "MIBR", "NRG", "Sentinels", "G2 Esports", "2GAME Esports"
  ],
  EMEA: [
    "Team Liquid", "GiantX", "Natus Vincere", "Fnatic", "BBL Esports",
    "Karmine Corp", "Team Heretics", "Vitality", "Apeks", "KOI", "FUT Esports", "Gentle Mates"
  ],
  Pacific: [
    "Zeta Divison", "Team Secret", "Paper Rex", "DetonationFocusMe", "Gen.G",
    "DRX", "T1", "Boom Esports", "Nongshim Redforce", "Talon", "Global Esports", "Rex Regum Qeon"
  ],
  China: [
    "All Gamers", "Edward Gaming", "FunPlus Phoenix", "Wolves Esports", "Bilibili Gaming",
    "JD Gaming", "Nova Esports", "Titan Esports Club", "Trace Esports", "Tyloo", "XLG Esports", "Dragon Ranger Gaming"
  ]
};

// Create random player
function generatePlayer(namePrefix) {
  return {
    name: `${namePrefix}${Math.floor(Math.random() * 1000)}`,
    rating: Math.floor(Math.random() * 100) + 50 // range: 50–150
  };
}

// Create roster of 5 players
function generateTeamRoster(team) {
  return Array.from({ length: 5 }, (_, i) => generatePlayer(team.slice(0, 3) + i));
}

// Show category page
export function showCategories() {
  const container = document.getElementById("categoriesContainer");
  container.innerHTML = "";

  Object.keys(regions).forEach(region => {
    const regionDiv = document.createElement("div");
    regionDiv.classList.add("region-block");

    const title = document.createElement("h2");
    title.textContent = region;
    regionDiv.appendChild(title);

    regions[region].forEach(team => {
      const teamDiv = document.createElement("div");
      teamDiv.classList.add("team-card");

      const roster = generateTeamRoster(team);
      const playersHTML = roster.map(p => `<li>${p.name} (Rating: ${p.rating})</li>`).join("");

      teamDiv.innerHTML = `
        <h3>${team}</h3>
        <ul>${playersHTML}</ul>
      `;

      regionDiv.appendChild(teamDiv);
    });

    container.appendChild(regionDiv);
  });
}

// Back button (goes to main menu)
export function backToMenu() {
  window.location.href = "index.html"; // Change this if your menu file is named differently
}

