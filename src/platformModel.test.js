import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  apiCatalog,
  events,
  getApiGroups,
  getEventStream,
  getLiveStreams,
  getPlatformMetrics,
  removeById,
  upsertById,
  videoStreams,
} from './platformModel.js';

test('getLiveStreams returns enabled streams sorted by priority', () => {
  const streams = getLiveStreams(videoStreams);

  assert.deepEqual(streams.map((stream) => stream.id), ['CAM-A01', 'CAM-C05', 'CAM-B03', 'CAM-A06']);
  assert.ok(streams.every((stream) => stream.enabled));
});

test('getEventStream matches event camera id to reserved stream config', () => {
  const event = events.find((item) => item.id === 'EVT-001');
  const stream = getEventStream(event, videoStreams);

  assert.equal(stream.id, 'CAM-A01');
  assert.equal(stream.protocol, 'RTSP');
  assert.match(stream.endpoint, /^rtsp:\/\//);
});

test('getApiGroups separates backend api and agent api placeholders', () => {
  const groups = getApiGroups(apiCatalog);

  assert.equal(groups.backend.length, 5);
  assert.equal(groups.agent.length, 4);
  assert.ok(groups.backend.every((api) => api.path.startsWith('/api/')));
  assert.ok(groups.agent.every((api) => api.path.startsWith('/agents/')));
});

test('getPlatformMetrics summarizes event, stream, linkage, and notification state', () => {
  const metrics = getPlatformMetrics(events, videoStreams);

  assert.equal(metrics.totalEvents, 5);
  assert.equal(metrics.criticalEvents, 0);
  assert.equal(metrics.processingEvents, 2);
  assert.equal(metrics.liveStreams, 4);
  assert.equal(metrics.apiReserved, 9);
  assert.equal(metrics.averageConfidence, 86.7);
});

test('upsertById inserts and updates editable configuration rows', () => {
  const inserted = upsertById([{ id: 'CAM-A01', name: 'old' }], { id: 'CAM-X01', name: 'new' });
  assert.deepEqual(inserted.map((item) => item.id), ['CAM-A01', 'CAM-X01']);

  const updated = upsertById(inserted, { id: 'CAM-A01', name: 'updated' });
  assert.equal(updated.length, 2);
  assert.equal(updated.find((item) => item.id === 'CAM-A01').name, 'updated');
});

test('removeById removes editable configuration rows', () => {
  const rows = removeById([{ id: 'api-a' }, { id: 'api-b' }], 'api-a');

  assert.deepEqual(rows, [{ id: 'api-b' }]);
});

test('getPlatformMetrics uses configured api catalog instead of default catalog', () => {
  const metrics = getPlatformMetrics(events, videoStreams, [
    { id: 'only-one', group: 'backend', path: '/api/only-one' },
  ]);

  assert.equal(metrics.apiReserved, 1);
});

test('api mock contracts cover every catalog endpoint used by the prototype', () => {
  const root = process.cwd();
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/api/api-catalog.json'), 'utf8'));
  const mocks = JSON.parse(fs.readFileSync(path.join(root, 'public/api/api-mocks.json'), 'utf8'));
  const mockIds = new Set(mocks.interfaces.map((item) => item.id));

  assert.equal(mocks.summary.total, mocks.interfaces.length);
  assert.equal(mocks.summary.backend, mocks.interfaces.filter((item) => item.group === 'backend').length);
  assert.equal(mocks.summary.agent, mocks.interfaces.filter((item) => item.group === 'agent').length);

  for (const api of catalog.apis) {
    assert.ok(mockIds.has(api.id), `${api.id} is missing from api-mocks.json`);
  }

  for (const item of mocks.interfaces) {
    assert.ok(item.id);
    assert.ok(item.method);
    assert.ok(item.path);
    assert.ok(item.name);
    assert.ok(item.description);
    assert.ok(item.responseExample);
    assert.ok(Array.isArray(item.fields), `${item.id} fields must be documented`);
    assert.ok(Array.isArray(item.statusCodes), `${item.id} statusCodes must be documented`);
  }
});
