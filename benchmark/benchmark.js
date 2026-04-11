/**
 * benchmark.js
 */

import { performance } from 'node:perf_hooks';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
import { GenerationalCache } from '../src/index.js';

const CACHE_SIZE = 100_000;
const OPERATIONS = 1_000_000;

console.log('==================================================');
console.log(` Benchmark: Cache Size = ${CACHE_SIZE.toLocaleString()} / Operations = ${OPERATIONS.toLocaleString()}`);
console.log('==================================================\n');

// =======================================
// Initialize caches
// =======================================
const caches = {
  Generational: new GenerationalCache(CACHE_SIZE),
  QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE }),
  LRUCache: new LRUCache({ max: CACHE_SIZE })
};

// =======================================
// Benchmark helper function
// =======================================
function runTest(testName, fn) {
  const start = performance.now();
  fn();
  const end = performance.now();
  const durationMs = end - start;
  const opsPerSec = Math.floor((OPERATIONS / durationMs) * 1000);

  // Format and output the result
  console.log(`${testName.padEnd(12)} | ${String(opsPerSec.toLocaleString()).padStart(12)} ops/sec`);
}

// =======================================
// Test scenarios
// =======================================

// 1. Set (Write) - Pure insertion until the cache is full
console.log('--- 1. Set (Write) ---');
for (const [name, cache] of Object.entries(caches)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      // Use i % CACHE_SIZE as the key to prevent eviction
      cache.set(`key-${i % CACHE_SIZE}`, i);
    }
  });
}
console.log('');

// 2. Get (Read Hit) - Accessing existing keys
console.log('--- 2. Get (Read Hit) ---');
for (const [name, cache] of Object.entries(caches)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      cache.get(`key-${i % CACHE_SIZE}`);
    }
  });
}
console.log('');

// 3. Eviction (Write & Drop) - Continuous insertion exceeding the cache limit, forcing eviction
console.log('--- 3. Eviction (Write & Drop) ---');
for (const [name, cache] of Object.entries(caches)) {
  runTest(name, () => {
    for (let i = 0; i < OPERATIONS; i++) {
      // Always generate new keys, continuously pushing out old ones
      cache.set(`evict-${i}`, i);
    }
  });
}
console.log('');

console.log('==================================================');
console.log('Done.');
