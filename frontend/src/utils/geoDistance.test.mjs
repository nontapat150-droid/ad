import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversineMeters } from './geoDistance.js';

test('calculates the straight-line distance between two coordinates', () => {
  assert.equal(haversineMeters(13.75, 100.5, 13.75, 100.5), 0);
  assert.equal(Math.round(haversineMeters(13.75, 100.5, 13.75, 100.51)), 1080);
});
