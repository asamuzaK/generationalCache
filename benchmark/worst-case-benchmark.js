/**
 * worst-case-benchmark.js (powered by mitata)
 */

import { run, bench, group } from 'mitata';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
import { LRUCache as MnemonistLRU } from 'mnemonist';
import { GenerationalCache } from '../src/index.js';

const DEFAULT_CACHE_SIZE = 8192;

// Parse `--size=XXX` from command line arguments
let CACHE_SIZE = DEFAULT_CACHE_SIZE;
const sizeArg = process.argv.find(arg => arg.startsWith('--size='));
if (sizeArg) {
  const parsedSize = parseInt(sizeArg.split('=')[1], 10);
  if (!isNaN(parsedSize) && parsedSize > 0) {
    CACHE_SIZE = parsedSize;
  } else {
    console.warn(`\n⚠️ Invalid size argument provided. Falling back to default: ${DEFAULT_CACHE_SIZE}\n`);
  }
}

// The Achilles' heel for GenerationalCache:
// Working set size is greater than max / 2 (4096), but smaller than total max (8192).
const WORKING_SET_SIZE = 5_000; 
const SIMULATION_OPS = 100_000;

const keys = Array.from({ length: CACHE_SIZE }, (_, i) => `key-${i}`);

const createCaches = () => {
  return {
    Generational: new GenerationalCache(CACHE_SIZE),
    LRUCache: new LRUCache({ max: CACHE_SIZE }),
    QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE }),
    Mnemonist: new MnemonistLRU(CACHE_SIZE)
  };
};

console.log('==================================================');
console.log(` Worst-Case Scenario Benchmark`);
console.log(` Cache Size: ${CACHE_SIZE} | Working Set: ${WORKING_SET_SIZE}`);
console.log('==================================================\n');

// --- 1. Pre-calculation: Hit Rate Simulation ---
console.log('--- Hit Rate Simulation (100,000 cyclic operations) ---');
const simCaches = createCaches();

for (const [name, cache] of Object.entries(simCaches)) {
  // Pre-fill the cache with the working set
  for (let i = 0; i < WORKING_SET_SIZE; i++) {
    cache.set(keys[i], 'val');
  }

  let hits = 0;
  for (let i = 0; i < SIMULATION_OPS; i++) {
    const key = keys[i % WORKING_SET_SIZE];
    if (cache.get(key) !== undefined) {
      hits++;
    } else {
      // Re-cache on miss (Simulating actual application behavior)
      cache.set(key, 'val');
    }
  }
  console.log(`${name.padEnd(12)}: Hit Rate = ${((hits / SIMULATION_OPS) * 100).toFixed(2)}%`);
}
console.log('\n');

// --- 2. Throughput Benchmark ---
const idx = { Generational: 0, LRUCache: 0, QuickLRU: 0, Mnemonist: 0 };

group('Worst-Case: Cyclic Access (Miss Penalty Included)', () => {
  const caches = createCaches();
  
  // Pre-fill caches to simulate steady state
  for (const cache of Object.values(caches)) {
    for (let i = 0; i < WORKING_SET_SIZE; i++) {
      cache.set(keys[i], 'val');
    }
  }

  bench('Generational', () => {
    const currentIdx = idx.Generational++;
    const key = keys[currentIdx % WORKING_SET_SIZE];
    if (caches.Generational.get(key) === undefined) {
      // Cache Miss! Re-computing and setting incurs a penalty.
      caches.Generational.set(key, 'val');
    }
  });

  bench('LRUCache', () => {
    const currentIdx = idx.LRUCache++;
    const key = keys[currentIdx % WORKING_SET_SIZE];
    if (caches.LRUCache.get(key) === undefined) {
      caches.LRUCache.set(key, 'val');
    }
  });

  bench('QuickLRU', () => {
    const currentIdx = idx.QuickLRU++;
    const key = keys[currentIdx % WORKING_SET_SIZE];
    if (caches.QuickLRU.get(key) === undefined) {
      caches.QuickLRU.set(key, 'val');
    }
  });

  bench('Mnemonist', () => {
    const currentIdx = idx.Mnemonist++;
    const key = keys[currentIdx % WORKING_SET_SIZE];
    if (caches.Mnemonist.get(key) === undefined) {
      caches.Mnemonist.set(key, 'val');
    }
  });
});

if (global.gc) {
  global.gc();
}

await run();
