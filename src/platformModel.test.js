import test from 'node:test';
import assert from 'node:assert/strict';
import {
  apiCatalog,
  events,
  getApiGroups,
  getEventStream,
  getLiveStreams,
  getPlatformMetrics,
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
  assert.equal(metrics.criticalEvents, 2);
  assert.equal(metrics.liveStreams, 4);
  assert.equal(metrics.apiReserved, 9);
  assert.equal(metrics.averageConfidence, 86.7);
});
