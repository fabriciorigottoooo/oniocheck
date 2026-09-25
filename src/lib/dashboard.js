export function getClientProgress(client = {}) {
  const checks = Array.isArray(client.checks) ? client.checks : [];
  const total = checks.length;
  if (total === 0) return 0;
  const done = checks.filter((step) => step && step.done).length;
  return Math.round((done / total) * 100);
}

export function summarizeDashboard(clients = []) {
  const list = Array.isArray(clients) ? clients : [];
  const totalClients = list.length;
  const activeClients = list.filter((client) => !client.finishedAt).length;
  const finishedClients = list.filter((client) => client.finishedAt).length;
  const completionRate = totalClients ? Math.round((finishedClients / totalClients) * 100) : 0;

  const storeMap = new Map();

  for (const client of list) {
    const name = String(client.attendanceUnit ?? client.economicGroup ?? 'Sem unidade').trim() || 'Sem unidade';
    const current = storeMap.get(name) ?? {
      name,
      total: 0,
      active: 0,
      done: 0,
      progressSum: 0,
    };

    current.total += 1;
    if (client.finishedAt) {
      current.done += 1;
    } else {
      current.active += 1;
    }
    current.progressSum += getClientProgress(client);
    storeMap.set(name, current);
  }

  const storeSummary = [...storeMap.values()]
    .map((store) => ({
      name: store.name,
      total: store.total,
      active: store.active,
      done: store.done,
      progress: store.total ? Math.round(store.progressSum / store.total) : 0,
      completion: store.total ? Math.round((store.done / store.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || b.progress - a.progress);

  const priorityClients = [...list]
    .filter((client) => !client.finishedAt)
    .sort((a, b) => getClientProgress(a) - getClientProgress(b))
    .slice(0, 4)
    .map((client) => ({
      id: client.id,
      name: client.name,
      unit: String(client.attendanceUnit ?? client.economicGroup ?? 'Sem unidade').trim() || 'Sem unidade',
      progress: getClientProgress(client),
    }));

  return {
    totalClients,
    activeClients,
    finishedClients,
    completionRate,
    storeSummary,
    bestStore: storeSummary[0] ?? null,
    priorityClients,
  };
}
