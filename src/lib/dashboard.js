export function getClientProgress(client = {}) {
  if (client.workflow && typeof client.workflow === 'object') {
    const workflow = client.workflow;
    const base = ['onboarding', 'api', 'facebook-path'];
    let branch = [];
    if (workflow.facebookStatus === 'already-uses') branch = ['confirm-bm'];
    if (workflow.facebookStatus === 'used-before') branch = ['verify-facebook', 'confirm-bm'];
    if (workflow.facebookStatus === 'never-used') {
      if (workflow.createWebsite === true) branch.push('website-form');
      if (workflow.needsFacebookAccess === true || workflow.createWebsite === true) branch.push('schedule');
      branch.push('fill-bm');
    }
    const stages = [...base, ...branch, 'license-data', 'create-license', 'training', 'linking'];
    const decisionDone = Boolean(workflow.facebookStatus) && (
      workflow.facebookStatus !== 'never-used' ||
      (typeof workflow.needsFacebookAccess === 'boolean' && typeof workflow.createWebsite === 'boolean')
    );
    const done = stages.filter((id) => id === 'facebook-path'
      ? decisionDone
      : workflow.tasks?.[id]?.status === 'done').length;
    return stages.length ? Math.round((done / stages.length) * 100) : 0;
  }
  const checks = Array.isArray(client.checks) ? client.checks : [];
  const total = checks.length;
  if (total === 0) return 0;
  const done = checks.filter((step) => step && step.done).length;
  return Math.round((done / total) * 100);
}

export function summarizeDashboard(clients = [], now = new Date()) {
  const list = (Array.isArray(clients) ? clients : []).filter((client) => {
    if (!client) return false;
    if (client.deleted === true || client.deletedAt) return false;
    return true;
  });
  const currentDate = new Date(now);
  const thisWeekStart = new Date(currentDate);
  thisWeekStart.setHours(0, 0, 0, 0);
  const dayOfWeek = (thisWeekStart.getDay() + 6) % 7;
  thisWeekStart.setDate(thisWeekStart.getDate() - dayOfWeek);

  const rollingLastWeekStart = new Date(currentDate);
  rollingLastWeekStart.setDate(currentDate.getDate() - 6);
  rollingLastWeekStart.setHours(0, 0, 0, 0);

  const getStoreKey = (client) => String(client.attendanceUnit ?? client.economicGroup ?? 'Sem unidade').trim() || 'Sem unidade';

  const countStoresFinishedBetween = (start, end) => {
    const unique = new Set();
    for (const client of list) {
      if (!client.finishedAt) continue;
      const finishedAt = new Date(client.finishedAt);
      if (Number.isNaN(finishedAt.getTime())) continue;
      if (finishedAt >= start && finishedAt <= end) {
        unique.add(getStoreKey(client));
      }
    }
    return unique.size;
  };

  const totalClients = list.length;
  const activeClients = list.filter((client) => !client.finishedAt).length;
  const finishedClients = list.filter((client) => client.finishedAt).length;
  const completionRate = totalClients ? Math.round((finishedClients / totalClients) * 100) : 0;

  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 7);
  thisWeekEnd.setMilliseconds(-1);

  const storesFinishedThisWeek = countStoresFinishedBetween(thisWeekStart, thisWeekEnd);
  const storesFinishedLastWeek = countStoresFinishedBetween(rollingLastWeekStart, currentDate);

  const storeMap = new Map();

  for (const client of list) {
    const name = getStoreKey(client);
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
      unit: getStoreKey(client),
      progress: getClientProgress(client),
    }));

  return {
    totalClients,
    activeClients,
    finishedClients,
    completionRate,
    storeSummary,
    storesFinishedThisWeek,
    storesFinishedLastWeek,
    bestStore: storeSummary[0] ?? null,
    priorityClients,
  };
}
