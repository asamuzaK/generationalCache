/**
 * benchmark.js (powered by mitata)
 */

import { run, bench, group } from 'mitata';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
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

// Setup access patterns
const keys = Array.from({ length: CACHE_SIZE * 2 }, (_, i) => `key-${i}`);
const hitPattern = Array.from(
  { length: 100_000 },
  () => keys[Math.floor(Math.random() * CACHE_SIZE * 1.2)]
);
const evictPattern = Array.from({ length: 100_000 }, (_, i) => `evict-${i}`);

// Initialize caches
// We will recreate these inside groups to ensure fresh state for Cold/Warm comparisons
const createCaches = () => {
  const caches = {
    Generational: new GenerationalCache(CACHE_SIZE),
    LRUCache: new LRUCache({ max: CACHE_SIZE }),
    QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE })
  };

  // Pre-fill caches for Get scenarios
  for (const cache of Object.values(caches)) {
    for (let i = 0; i < CACHE_SIZE; i++) {
      cache.set(keys[i], i);
    }
  }
  return caches;
};

// Independent indices for state management
const idx = { Generational: 0, LRUCache: 0, QuickLRU: 0 };

console.log('==================================================');
console.log(` Benchmark: Size=${CACHE_SIZE.toLocaleString()} | Node=${process.version}`);
console.log(' Engine: mitata (Comparing Cold vs Warm)');
console.log('==================================================\n');

/**
 * Helper to register benchmarks for a specific scenario
 * @param {string} scenario - "Set" | "Get" | "Eviction"
 */
const registerScenario = (scenario) => {
  // 1. Cold State (Minimize warmup and use inner GC to catch early behavior)
  group(`Scenario: ${scenario} (Cold State)`, () => {
    const caches = createCaches();

    bench('Generational', () => {
      const currentIdx = idx.Generational++;
      if (scenario === 'Set') {
        caches.Generational.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.Generational.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Generational.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    }).gc('inner');

    bench('LRUCache', () => {
      const currentIdx = idx.LRUCache++;
      if (scenario === 'Set') {
        caches.LRUCache.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.LRUCache.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.LRUCache.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    }).gc('inner');

    bench('QuickLRU', () => {
      const currentIdx = idx.QuickLRU++;
      if (scenario === 'Set') {
        caches.QuickLRU.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.QuickLRU.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.QuickLRU.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    }).gc('inner');
  });

  // 2. Warm State (Standard mitata behavior with optimized JIT)
  group(`Scenario: ${scenario} (Warm State)`, () => {
    const caches = createCaches();

    bench('Generational', () => {
      const currentIdx = idx.Generational++;
      if (scenario === 'Set') {
        caches.Generational.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.Generational.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Generational.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    });

    bench('LRUCache', () => {
      const currentIdx = idx.LRUCache++;
      if (scenario === 'Set') {
        caches.LRUCache.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.LRUCache.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.LRUCache.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    });

    bench('QuickLRU', () => {
      const currentIdx = idx.QuickLRU++;
      if (scenario === 'Set') {
        caches.QuickLRU.set(hitPattern[currentIdx % hitPattern.length], currentIdx);
      } else if (scenario === 'Get') {
        return caches.QuickLRU.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.QuickLRU.set(evictPattern[currentIdx % evictPattern.length], currentIdx);
      }
    });
  });
};

// Execute scenarios
registerScenario('Set');
registerScenario('Get');
registerScenario('Eviction');

// Final garbage collection before run
if (global.gc) {
  global.gc();
}

await run();
