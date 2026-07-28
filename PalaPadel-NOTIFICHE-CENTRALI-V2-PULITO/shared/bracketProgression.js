const sourceFields = ["team1SourceMatchId", "team2SourceMatchId"];

export function validateBracketSources(match, matchesById) {
  for (const field of sourceFields) {
    const sourceId = match[field];
    if (!sourceId) continue;
    if (sourceId === match.id || !matchesById.has(sourceId)) {
      throw new Error("INVALID_BRACKET_SOURCE");
    }

    const visit = (currentId, path) => {
      if (!currentId) return;
      if (path.has(currentId)) throw new Error("CIRCULAR_BRACKET_SOURCE");
      const current = matchesById.get(currentId);
      if (!current) return;
      const nextPath = new Set(path).add(currentId);
      sourceFields.forEach((sourceField) => visit(current[sourceField], nextPath));
    };
    visit(sourceId, new Set([match.id]));
  }
}

export function propagateBracketWinner(matchesById, sourceId, winnerTeamId) {
  const state = new Map([...matchesById].map(([id, match]) => [id, { ...match }]));
  const updates = new Map();
  const pending = [{ sourceId, winnerTeamId: winnerTeamId || null }];
  const processed = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    const marker = `${current.sourceId}:${current.winnerTeamId || ""}`;
    if (processed.has(marker)) continue;
    processed.add(marker);

    for (const dependent of state.values()) {
      if (dependent.id === sourceId) continue;
      const usesTeam1 = dependent.team1SourceMatchId === current.sourceId;
      const usesTeam2 = dependent.team2SourceMatchId === current.sourceId;
      if (!usesTeam1 && !usesTeam2) continue;

      const changed = { ...dependent };
      if (usesTeam1) changed.team1Id = current.winnerTeamId;
      if (usesTeam2) changed.team2Id = current.winnerTeamId;
      if (changed.winnerTeamId && ![changed.team1Id, changed.team2Id].includes(changed.winnerTeamId)) {
        changed.winnerTeamId = null;
        pending.push({ sourceId: changed.id, winnerTeamId: null });
      }
      state.set(changed.id, changed);
      updates.set(changed.id, changed);
    }
  }

  return updates;
}
