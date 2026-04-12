/**
 * benchmark.js
 */

import { performance } from 'node:perf_hooks';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
import { GenerationalCache } from '../src/index.js';

const CACHE_SIZE = 4_096;
const OPERATIONS = 1_000_000;

console.log('==================================================');
console.log(` Benchmark: Cache Size = ${CACHE_SIZE.toLocaleString()} / Operations = ${OPERATIONS.toLocaleString()}`);
console.log('==================================================\n');

// =======================================
// 1. Setup (Exclude generation cost from measurements)
// =======================================
const hitKeys = new Array(OPERATIONS);
const evictKeys = new Array(OPERATIONS);

for (let i = 0; i < OPERATIONS; i++) {
  // For basic tests
  hitKeys[i] = `key-${i % CACHE_SIZE}`;
  evictKeys[i] = `evict-${i}`;
}

// Factory function to generate clean cache instances for each test
const createCaches = () => ({
  Generational: new GenerationalCache(CACHE_SIZE),
  QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE }),
  LRUCache: new LRUCache({ max: CACHE_SIZE })
});

// =======================================
// Benchmark helper function
// =======================================
function runTest(testName, fn) {
  if (global.gc) {
    global.gc();
  }

  const start = performance.now();
  fn();
  const end = performance.now();
  
  const durationMs = end - start;
  const opsPerSec = Math.floor((OPERATIONS / durationMs) * 1000);

  console.log(`${testName.padEnd(12)} | ${String(opsPerSec.toLocaleString()).padStart(12)} ops/sec`);
}

// =======================================
// Test scenarios
// =======================================

// 1. Set (Write)
console.log('--- 1. Set (Write) ---');
let cachesSet = createCaches();
for (const [name, cache] of Object.entries(cachesSet)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      cache.set(hitKeys[i], i);
    }
  });
}
console.log('');

// 2. Get (Read Hit)
console.log('--- 2. Get (Read Hit) ---');
for (const [name, cache] of Object.entries(cachesSet)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      cache.get(hitKeys[i]);
    }
  });
}
console.log('');

// 3. Eviction (Write & Drop)
console.log('--- 3. Eviction (Write & Drop) ---');
let cachesEvict = createCaches();
for (const [name, cache] of Object.entries(cachesEvict)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      cache.set(evictKeys[i], i);
    }
  });
}
console.log('');

console.log('==================================================');
console.log('Done.');
