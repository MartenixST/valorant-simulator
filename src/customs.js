export function startCustomMatch(bestOf) {
  let playerScore = 0;
  let aiScore = 0;
  let log = "";

  for (let game = 1; game <= bestOf; game++) {
    let playerRound = 0;
    let aiRound = 0;

    for (let round = 1; round <= 13; round++) {
      const playerChance = Math.random() * 10;
      const aiChance = Math.random() * 10;

      if (playerChance + Math.random() > aiChance) {
        playerRound++;
      } else {
        aiRound++;
      }

      if (playerRound >= 13 || aiRound >= 13) break;
    }

    const isPlayerWin = playerRound > aiRound;
    if (isPlayerWin) {
      playerScore++;
    } else {
      aiScore++;
    }

    const colorClass = isPlayerWin ? "text-val-red" : "text-gray-400";
    // Updated styling for glassmorphism
    const bgClass = isPlayerWin ? "bg-val-red/10 border-val-red/20" : "bg-white/5 border-white/10";
    
    log += `
      <div class="mb-3 p-4 rounded-lg border ${bgClass} flex justify-between items-center hover:scale-[1.01] transition-transform backdrop-blur-sm">
        <span class="font-bold text-white font-valorant tracking-wide">Game ${game}</span>
        <span class="${colorClass} font-mono font-bold text-lg">${isPlayerWin ? 'VICTORY' : 'DEFEAT'}</span>
        <span class="text-white font-mono text-xl bg-black/20 px-3 py-1 rounded border border-white/5">${playerRound} - ${aiRound}</span>
      </div>
    `;

    if (playerScore > bestOf / 2 || aiScore > bestOf / 2) break;
  }

  const finalResultClass = playerScore > aiScore ? "text-val-red" : "text-gray-400";
  const finalResultText = playerScore > aiScore ? "MATCH WON" : "MATCH LOST";

  document.getElementById("match-log").innerHTML = `
    <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div class="flex justify-between items-end border-b border-white/10 pb-4 mb-4 bg-val-dark-grey/50 p-6 rounded-xl border border-white/5 backdrop-blur-md shadow-lg">
        <div>
           <h3 class="text-2xl font-bold text-white font-valorant tracking-wide mb-1">Match Result</h3>
           <p class="text-sm text-gray-400">Custom Game • Best of ${bestOf}</p>
        </div>
        <div class="text-right">
          <div class="text-4xl font-bold ${finalResultClass} font-valorant tracking-wider drop-shadow-lg">${finalResultText}</div>
          <div class="text-lg text-gray-300 mt-1 font-mono bg-black/30 px-3 py-1 rounded inline-block">Score: <span class="text-white font-bold">${playerScore} - ${aiScore}</span></div>
        </div>
      </div>
      <div class="space-y-2">
        ${log}
      </div>
    </div>
  `;
}

// Attach to window for legacy HTML access
window.startCustomMatch = startCustomMatch;
