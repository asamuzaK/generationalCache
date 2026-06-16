/**
 * benchmark-non-primitive.js (powered by mitata)
 */

import { run, bench, group } from 'mitata';
import { LRUCache } from 'lru-cache';
import QuickLRU from 'quick-lru';
import { LRUCache as MnemonistLRU } from 'mnemonist';
import { GenerationalCache } from '../src/index.js';

const DEFAULT_CACHE_SIZE = 4096;

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
let STRICT_VALIDATE = true;
const validateArg = process.argv.find(arg => arg.startsWith('--validate'));
if (validateArg) {
  const parsedArg = validateArg.split('=');
  if (parsedArg[1] === 'false') {
    STRICT_VALIDATE = false;
  }
}

// ---------------------------------------------------------
// 1. Setup access patterns & Non-Primitive Payloads
// ---------------------------------------------------------
const keys = Array.from({ length: CACHE_SIZE * 2 }, (_, i) => `key-${i}`);

const hitPattern = Array.from(
  { length: 100_000 },
  () => keys[Math.floor(Math.random() * CACHE_SIZE * 1.2)]
);
const evictPattern = Array.from({ length: 100_000 }, (_, i) => `evict-${i}`);

// Generate non-primitive objects in advance to avoid object creation overhead during benchmarks
const generatePayload = (id, type) => ({
  id,
  type,
  data: [1, 2, 3, 4, 5],
  metadata: {
    active: true,
    description: `Payload for ${type}-${id}`,
    timestamp: new Date().toISOString()
  }
});

const prefillValues = Array.from({ length: CACHE_SIZE }, (_, i) => generatePayload(i, 'prefill'));
const hitValues = Array.from({ length: 100_000 }, (_, i) => generatePayload(i, 'hit'));
const evictValues = Array.from({ length: 100_000 }, (_, i) => generatePayload(i, 'evict'));

// ---------------------------------------------------------
// 2. Initialize caches
// ---------------------------------------------------------
const createCaches = () => {
  const caches = {
    Generational: new GenerationalCache(CACHE_SIZE, {
      strictValidate: STRICT_VALIDATE
    }),
    LRUCache: new LRUCache({ max: CACHE_SIZE }),
    QuickLRU: new QuickLRU({ maxSize: CACHE_SIZE }),
    Mnemonist: new MnemonistLRU(CACHE_SIZE)
  };

  // Pre-fill caches for Get scenarios with non-primitive values
  for (const cache of Object.values(caches)) {
    for (let i = 0; i < CACHE_SIZE; i++) {
      cache.set(keys[i], prefillValues[i]);
    }
  }
  return caches;
};

// Independent indices for state management
const idx = { Generational: 0, LRUCache: 0, QuickLRU: 0, Mnemonist: 0 };

console.log('==================================================');
console.log(` Benchmark (Non-Primitive): Size=${CACHE_SIZE.toLocaleString()} StrictValidate=${STRICT_VALIDATE} | Node=${process.version}`);
console.log(' Engine: mitata (Comparing Cold vs Warm)');
console.log('==================================================\n');

/**
 * Helper to register benchmarks for a specific scenario
 * @param {string} scenario - "Set" | "Get" | "Eviction"
 */
const registerScenario = (scenario) => {
  // 1. Cold State
  group(`Scenario: ${scenario} (Cold State)`, () => {
    const caches = createCaches();

    bench('Generational', () => {
      const currentIdx = idx.Generational++;
      if (scenario === 'Set') {
        caches.Generational.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.Generational.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Generational.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    }).gc('inner');

    bench('LRUCache', () => {
      const currentIdx = idx.LRUCache++;
      if (scenario === 'Set') {
        caches.LRUCache.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.LRUCache.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.LRUCache.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    }).gc('inner');

    bench('QuickLRU', () => {
      const currentIdx = idx.QuickLRU++;
      if (scenario === 'Set') {
        caches.QuickLRU.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.QuickLRU.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.QuickLRU.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    }).gc('inner');

    bench('Mnemonist', () => {
      const currentIdx = idx.Mnemonist++;
      if (scenario === 'Set') {
        caches.Mnemonist.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.Mnemonist.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Mnemonist.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    }).gc('inner');
  });

  // 2. Warm State
  group(`Scenario: ${scenario} (Warm State)`, () => {
    const caches = createCaches();

    bench('Generational', () => {
      const currentIdx = idx.Generational++;
      if (scenario === 'Set') {
        caches.Generational.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.Generational.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Generational.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    });

    bench('LRUCache', () => {
      const currentIdx = idx.LRUCache++;
      if (scenario === 'Set') {
        caches.LRUCache.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.LRUCache.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.LRUCache.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    });

    bench('QuickLRU', () => {
      const currentIdx = idx.QuickLRU++;
      if (scenario === 'Set') {
        caches.QuickLRU.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.QuickLRU.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.QuickLRU.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
      }
    });

    bench('Mnemonist', () => {
      const currentIdx = idx.Mnemonist++;
      if (scenario === 'Set') {
        caches.Mnemonist.set(hitPattern[currentIdx % hitPattern.length], hitValues[currentIdx % hitValues.length]);
      } else if (scenario === 'Get') {
        return caches.Mnemonist.get(hitPattern[currentIdx % hitPattern.length]);
      } else if (scenario === 'Eviction') {
        caches.Mnemonist.set(evictPattern[currentIdx % evictPattern.length], evictValues[currentIdx % evictValues.length]);
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
