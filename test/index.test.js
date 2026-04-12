/**
 * index.test.js
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'mocha';
import { GenerationalCache } from '../src/index.js';

describe('GenerationalCache', () => {
  describe('Constructor & max property', () => {
    it('should initialize properly when a valid max value is set', () => {
      const cache = new GenerationalCache(10);
      assert.strictEqual(cache.max, 10);
      // boundary = Math.ceil(10 / 2) = 5
      assert.strictEqual(cache.size, 0);
    });

    it('should fall back to default values (max: 4, boundary: 2) when an invalid or <= 4 value is provided', () => {
      const cache1 = new GenerationalCache(2);
      assert.strictEqual(cache1.max, 4);

      const cache2 = new GenerationalCache('invalid');
      assert.strictEqual(cache2.max, 4);

      const cache3 = new GenerationalCache(NaN);
      assert.strictEqual(cache3.max, 4);
    });

    it('should clear the cache when the max property is reset', () => {
      const cache = new GenerationalCache(10);
      cache.set('a', 1);
      assert.strictEqual(cache.size, 1);

      cache.max = 6;
      assert.strictEqual(cache.max, 6);
      assert.strictEqual(cache.size, 0); // clear() is called
      assert.strictEqual(cache.has('a'), false);
    });
  });

  describe('Basic operations', () => {
    let cache;
    beforeEach(() => {
      // boundary: 3
      cache = new GenerationalCache(6);
    });

    it('should allow chaining for set()', () => {
      cache.set('a', 1).set('b', 2);
      assert.strictEqual(cache.size, 2);
    });

    it('should retrieve the set value using get()', () => {
      cache.set('a', 1);
      assert.strictEqual(cache.get('a'), 1);
      assert.strictEqual(cache.get('b'), undefined);
    });

    it('should treat storing undefined as a cache miss (by design for optimization)', () => {
      cache.set('a', undefined);
      assert.strictEqual(cache.get('a'), undefined);
      // Even if set, it won't be retrievable as a valid hit
    });

    it('should check the existence of a key using has()', () => {
      cache.set('a', 1);
      assert.strictEqual(cache.has('a'), true);
      assert.strictEqual(cache.has('b'), false);
    });

    it('should remove an element and return a boolean using delete()', () => {
      cache.set('a', 1);
      assert.strictEqual(cache.delete('a'), true);
      assert.strictEqual(cache.has('a'), false);
      assert.strictEqual(cache.size, 0);

      assert.strictEqual(cache.delete('b'), false); // Non-existent key
    });

    it('should remove all elements using clear()', () => {
      cache.set('a', 1).set('b', 2);
      cache.clear();
      assert.strictEqual(cache.size, 0);
      assert.strictEqual(cache.has('a'), false);
    });
  });

  describe('Generational Logic (Eviction & Promotion)', () => {
    // When max=4, boundary=2
    // Once the current size reaches 2, it slides: current -> old, and current becomes empty
    let cache;
    beforeEach(() => {
      cache = new GenerationalCache(4);
    });

    it('should trigger a generation swap and discard the older generation when the boundary is exceeded', () => {
      cache.set('a', 1);
      cache.set('b', 2); // At this point, current={a,b} -> Swap occurs: old={a,b}, current={}
      assert.strictEqual(cache.size, 2);
      assert.strictEqual(cache.has('a'), true);

      cache.set('c', 3); // current={c}, old={a,b}
      assert.strictEqual(cache.size, 3);

      cache.set('d', 4); // current={c,d} -> Swap occurs: old={c,d}, current={}. (The older {a,b} is discarded)
      assert.strictEqual(cache.size, 2);

      // 'a' and 'b' should be discarded
      assert.strictEqual(cache.has('a'), false);
      assert.strictEqual(cache.has('b'), false);
      // 'c' and 'd' should remain
      assert.strictEqual(cache.has('c'), true);
      assert.strictEqual(cache.has('d'), true);
    });

    it('should promote an item from the older generation to the current generation upon get()', () => {
      cache.set('a', 1).set('b', 2); // old={a,b}, current={}

      // Access 'a' (promotion should occur, adding it to current map)
      assert.strictEqual(cache.get('a'), 1); // current={a}, old={a,b}
      // Note: size becomes 3 temporarily due to allowing duplicates across maps
      assert.strictEqual(cache.size, 3);

      // Add 'c' (current size reaches 2, triggering a swap)
      cache.set('c', 3); // current={a,c} -> Swap occurs: old={a,c}, current={}

      // 'b' was not promoted, so it is discarded
      assert.strictEqual(cache.has('b'), false);
      // 'a' was promoted, so it survives
      assert.strictEqual(cache.has('a'), true);
      assert.strictEqual(cache.has('c'), true);
    });

    it('should safely delete an item from BOTH generations (preventing short-circuit zombie bugs)', () => {
      cache.set('a', 1).set('b', 2); // old={a,b}, current={}

      // Overwrite 'a'. 'a' will temporarily exist in both maps.
      cache.set('a', 99); // current={a}, old={a,b}

      // Delete 'a'. It MUST be deleted from both #current and #old.
      assert.strictEqual(cache.delete('a'), true);
      assert.strictEqual(cache.get('a'), undefined);
      assert.strictEqual(cache.has('a'), false);
    });
  });
});
