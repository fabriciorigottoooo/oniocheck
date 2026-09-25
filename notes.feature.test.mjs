import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientNotes, clientNotesPreview } from './src/lib/clientNotes.js';

test('normaliza observações sem espaços extras', () => {
  assert.equal(normalizeClientNotes('  Cliente sensível  '), 'Cliente sensível');
});

test('gera resumo curto da observação', () => {
  assert.equal(clientNotesPreview('Observações importantes para a próxima visita', 20), 'Observações importa…');
});
