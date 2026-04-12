/**
 * benchmark.js
 */

import { performance } from 'node:perf_hooks';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
import { GenerationalCache } from '../src/index.js';

const CACHE_SIZE = 8_192;
const COLD_OPS = 1_000_000; // Fixed operations for Cold test
const WARM_DURATION = 2000; // Minimum duration (ms) for Warm state test
const WARMUP_OPS = 200_000; // Warmup to trigger TurboFan optimization

// Setup access patterns
const keys = Array.from({ length: CACHE_SIZE * 2 }, (_, i) => `key-${i}`);
const hitPattern = Array.from({ length: 100_000 }, () => keys[Math.floor(Math.random() * CACHE_SIZE * 1.2)]);
const evictPattern = Array.from({ length: 100_000 }, (_, i) => `evict-${i}`);

const createCaches = () => ({
  Generational: new GenerationalCache(CACHE_SIZE),
  LRUCache: new LRUCache({ max: CACHE_SIZE }),
  QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE })
});

/**
 * Measures "Cold" performance (No warmup, fixed ops)
 */
function measureCold(cache, scenarioFn) {
  if (global.gc) global.gc();
  
  const start = performance.now();
  const checksum = scenarioFn(cache, COLD_OPS);
  const end = performance.now();
  
  const duration = end - start;
  const opsPerSec = Math.floor((COLD_OPS / duration) * 1000);
  return { opsPerSec, checksum };
}

/**
 * Measures "Warm" performance (With warmup, sustained execution)
 */
function measureWarm(cache, scenarioFn) {
  if (global.gc) global.gc();

  // 1. Warmup
  scenarioFn(cache, WARMUP_OPS);

  // 2. Timed measurement for stable throughput
  let totalOps = 0;
  let checksum = 0;
  const startTime = performance.now();
  let currentTime = startTime;

  while (currentTime - startTime < WARM_DURATION) {
    const chunk = 10000;
    checksum += scenarioFn(cache, chunk);
    totalOps += chunk;
    currentTime = performance.now();
  }

  const duration = currentTime - startTime;
  const opsPerSec = Math.floor((totalOps / duration) * 1000);
  return { opsPerSec, checksum };
}

function runBenchmark(label, scenarioFn) {
  console.log(`=== Scenario: ${label} ===`);
  
  const caches = createCaches();
  // Pre-fill for non-write tests to ensure initial hits
  if (label !== 'Set' && label !== 'Eviction') {
    for (const cache of Object.values(caches)) {
      for (let i = 0; i < CACHE_SIZE; i++) cache.set(keys[i], i);
    }
  }

  for (const [name, cache] of Object.entries(caches)) {
    // 1. Cold Test
    const cold = measureCold(cache, scenarioFn);
    // 2. Warm Test (Using the same instance to represent an optimized/aged cache)
    const warm = measureWarm(cache, scenarioFn);

    console.log(`${name.padEnd(12)} | Cold: ${cold.opsPerSec.toLocaleString().padStart(12)} ops/sec | Warm: ${warm.opsPerSec.toLocaleString().padStart(12)} ops/sec`);
  }
  console.log('');
}

const scenarios = {
  "Set": (cache, count) => {
    for (let i = 0; i < count; i++) cache.set(hitPattern[i % hitPattern.length], i);
    return count;
  },
  "Get": (cache, count) => {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      if (cache.get(hitPattern[i % hitPattern.length]) !== undefined) sum++;
    }
    return sum;
  },
  "Has": (cache, count) => {
    let sum = 0;
    for (let i = 0; i < count; i++) {
      if (cache.has(hitPattern[i % hitPattern.length])) sum++;
    }
    return sum;
  },
  "Eviction": (cache, count) => {
    for (let i = 0; i < count; i++) cache.set(evictPattern[i % evictPattern.length], i);
    return count;
  }
};

console.log('==================================================');
console.log(` Benchmark: Size=${CACHE_SIZE.toLocaleString()} | Node=${process.version}`);
console.log(' Cold: First 1M ops | Warm: Sustained avg over 2000ms');
console.log('==================================================\n');

for (const [label, fn] of Object.entries(scenarios)) {
  runBenchmark(label, fn);
}
