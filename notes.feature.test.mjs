import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientNotes, clientNotesPreview } from './src/lib/clientNotes.js';
import { summarizeDashboard } from './src/lib/dashboard.js';

test('normaliza observações sem espaços extras', () => {
  assert.equal(normalizeClientNotes('  Cliente sensível  '), 'Cliente sensível');
});

test('gera resumo curto da observação', () => {
  assert.equal(clientNotesPreview('Observações importantes para a próxima visita', 20), 'Observações importa…');
});

test('resume a situação operacional por loja e cliente', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const summary = summarizeDashboard([
    { id: '1', name: 'Loja Norte', attendanceUnit: 'Loja 01', economicGroup: 'Grupo A', finishedAt: null, checks: [{ done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }] },
    { id: '2', name: 'Loja Sul', attendanceUnit: 'Loja 01', economicGroup: 'Grupo A', finishedAt: '2026-09-23T10:00:00Z', checks: [{ done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }, { done: true, by: 'Ana', at: '2024-01-01' }] },
    { id: '3', name: 'Loja Centro', attendanceUnit: 'Loja 02', economicGroup: 'Grupo B', finishedAt: '2026-09-10T10:00:00Z', checks: [{ done: true, by: 'Bia', at: '2024-01-01' }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }, { done: false, by: null, at: null }] },
  ], now);

  assert.equal(summary.totalClients, 3);
  assert.equal(summary.activeClients, 1);
  assert.equal(summary.finishedClients, 2);
  assert.equal(summary.storeSummary.length, 2);
  assert.equal(summary.storeSummary[0].name, 'Loja 01');
  assert.equal(summary.storeSummary[0].progress, 60);
  assert.equal(summary.priorityClients[0].name, 'Loja Norte');
  assert.equal(summary.storesFinishedThisWeek, 1);
  assert.equal(summary.storesFinishedLastWeek, 1);
});
