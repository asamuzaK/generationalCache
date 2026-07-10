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
      assert.strictEqual(cache.entryCount, 0);
    });

    it('should fall back to default values (max: 4, boundary: 2) when an invalid or <= 4 value is provided', () => {
      const cache1 = new GenerationalCache(2);
      assert.strictEqual(cache1.max, 4);

      const cache2 = new GenerationalCache('invalid');
      assert.strictEqual(cache2.max, 4);

      const cache3 = new GenerationalCache(NaN);
      assert.strictEqual(cache3.max, 4);
    });

    it('should use the provided maxKeySize if it is a truthy integer', () => {
      const cache = new GenerationalCache(4, { maxKeySize: 10 });
      const validKey = 'a'.repeat(10);
      cache.set(validKey, 1);
      assert.strictEqual(cache.has(validKey), true);
      const invalidKey = 'a'.repeat(11);
      cache.set(invalidKey, 1);
      assert.strictEqual(cache.has(invalidKey), false);
    });

    it('should fall back to DEFAULT_KEY_SIZE if maxKeySize is not an integer', () => {
      const cache = new GenerationalCache(4, { maxKeySize: 10.5 });
      const defaultKeySize = 8 * 1024;
      const validKey = 'a'.repeat(defaultKeySize);
      cache.set(validKey, 1);
      assert.strictEqual(cache.has(validKey), true);
      const invalidKey = 'a'.repeat(defaultKeySize + 1);
      cache.set(invalidKey, 1);
      assert.strictEqual(cache.has(invalidKey), false);
    });

    it('should fall back to DEFAULT_KEY_SIZE if maxKeySize is 0 (falsy integer)', () => {
      const cache = new GenerationalCache(4, { maxKeySize: 0 });
      const defaultKeySize = 8 * 1024;
      const validKey = 'a'.repeat(defaultKeySize);
      cache.set(validKey, 1);
      assert.strictEqual(cache.has(validKey), true);
      const invalidKey = 'a'.repeat(defaultKeySize + 1);
      cache.set(invalidKey, 1);
      assert.strictEqual(cache.has(invalidKey), false);
    });

    it('should clear the cache when the max property is reset', () => {
      const cache = new GenerationalCache(10);
      cache.set('a', 1);
      assert.strictEqual(cache.entryCount, 1);

      cache.max = 6;
      assert.strictEqual(cache.max, 6);
      assert.strictEqual(cache.entryCount, 0);
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
      assert.strictEqual(cache.entryCount, 2);
    });

    it('should retrieve the set value using get()', () => {
      cache.set('a', 1);
      assert.strictEqual(cache.get('a'), 1);
      assert.strictEqual(cache.get('b'), undefined);
    });

    it('should prevent storing undefined (by design for optimization)', () => {
      cache.set('a', undefined);
      assert.strictEqual(cache.entryCount, 0);
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
      assert.strictEqual(cache.entryCount, 0);

      assert.strictEqual(cache.delete('b'), false); // Non-existent key
    });

    it('should remove all elements using clear()', () => {
      cache.set('a', 1).set('b', 2);
      cache.clear();
      assert.strictEqual(cache.entryCount, 0);
      assert.strictEqual(cache.has('a'), false);
    });
  });

  describe('Generational Logic (Eviction & Promotion)', () => {
    let cache;
    beforeEach(() => {
      cache = new GenerationalCache(4);
    });

    it('should trigger a generation swap and discard old generation', () => {
      cache.set('a', 1);
      cache.set('b', 2); // current={a,b} -> Swap occurs: old={a,b}, current={}
      assert.strictEqual(cache.entryCount, 2);
      assert.strictEqual(cache.has('a'), true);

      cache.set('c', 3); // current={c}, old={a,b}
      assert.strictEqual(cache.entryCount, 3);

      // current={c,d} -> Swap occurs: old={c,d}, current={}.
      cache.set('d', 4);
      assert.strictEqual(cache.entryCount, 2);

      // 'a' and 'b' should be discarded
      assert.strictEqual(cache.has('a'), false);
      assert.strictEqual(cache.has('b'), false);
      // 'c' and 'd' should remain
      assert.strictEqual(cache.has('c'), true);
      assert.strictEqual(cache.has('d'), true);
    });

    it('should promote from the older generation to the current', () => {
      cache.set('a', 1).set('b', 2); // old={a,b}, current={}

      // Access 'a' (promotion should occur, adding it to current map)
      assert.strictEqual(cache.get('a'), 1); // current={a}, old={b}
      // Note: entryCount remains 2 as 'a' moves from old to current
      assert.strictEqual(cache.entryCount, 2);

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

  describe('Configurable Permissions (cacheFunction & cacheSymbol)', () => {
    it('should allow functions if cacheFunction is true', () => {
      const cache = new GenerationalCache(4, { cacheFunction: true });
      const fn = () => {};
      cache.set('fn', fn);
      cache.set('obj', { method: fn });

      assert.strictEqual(cache.get('fn'), fn);
      assert.deepEqual(cache.get('obj'), { method: fn });
    });

    it('should allow symbols if cacheSymbol is true', () => {
      const cache = new GenerationalCache(4, { cacheSymbol: true });
      const sym = Symbol('test');
      cache.set('sym', sym);

      // Even if symbols are allowed, JSON.stringify skips symbol keys/values.
      // As long as the serialized size is within limits, it should pass.
      const obj = { [sym]: 'value', a: sym };
      cache.set('obj', obj);

      assert.strictEqual(cache.get('sym'), sym);
      assert.strictEqual(cache.get('obj'), obj);
    });

    it('should inspect values of Symbol keys', () => {
      const cacheWithSym = new GenerationalCache(4, { cacheSymbol: true });
      const sym = Symbol('secret');
      const evilObj = {
        [sym]: () => {}
      };
      cacheWithSym.set('key', evilObj);
      assert.strictEqual(cacheWithSym.has('key'), false);

      const safeObj = {
        [sym]: 'safe string'
      };
      cacheWithSym.set('safeKey', safeObj);
      assert.strictEqual(cacheWithSym.has('safeKey'), true);
    });
  });

  describe('strictValidate Escape Hatch (strictValidate: false)', () => {
    it('should bypass deep object inspection and size limitations', () => {
      const cache = new GenerationalCache(4, {
        maxValueSize: 10,
        strictValidate: false
      });

      const massiveObj = { data: 'X'.repeat(1000) };
      const forbiddenObj = { fn: () => {}, sym: Symbol('a') };

      // Should bypass size check and forbidden type check
      cache.set('massive', massiveObj);
      cache.set('forbidden', forbiddenObj);

      assert.strictEqual(cache.get('massive'), massiveObj);
      assert.strictEqual(cache.get('forbidden'), forbiddenObj);
    });

    it('should skip primitive validation if strictValidate is false', () => {
      const cache = new GenerationalCache(4, {
        maxValueSize: 5,
        strictValidate: false
      });
      cache.set('primitive', 'abcdefghij');
      assert.strictEqual(cache.has('primitive'), true);
    });
  });
});
