/**
 * index.test.js
 */

import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'mocha';
import sinon from 'sinon';
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

  describe('Basic Map operations', () => {
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

      // Access 'a' (promotion should occur)
      assert.strictEqual(cache.get('a'), 1); // current={a}, old={b}

      // Add 'c' (current size reaches 2, triggering a swap)
      cache.set('c', 3); // current={a,c} -> Swap occurs: old={a,c}, current={}

      // 'b' was not promoted, so it is discarded
      assert.strictEqual(cache.has('b'), false);
      // 'a' was promoted, so it survives
      assert.strictEqual(cache.has('a'), true);
      assert.strictEqual(cache.has('c'), true);
    });

    it('should maintain accurate size without duplication when overwriting an existing key with set()', () => {
      cache.set('a', 1).set('b', 2); // old={a,b}, current={}

      // Overwrite 'a' which is in old (should be removed from old and added to current)
      cache.set('a', 99); // current={a}, old={b}

      assert.strictEqual(cache.get('a'), 99);
      assert.strictEqual(cache.size, 2); // Should not become 3

      // Boundary test: current={a}, old={b}, adding 1 more should trigger a swap
      cache.set('c', 3); // current={a,c} -> Swap occurs: old={a,c}, current={}
      assert.strictEqual(cache.has('b'), false); // 'b' is discarded
      assert.strictEqual(cache.has('a'), true); // 'a' survives
    });
  });

  describe('Iterators and forEach', () => {
    let cache;
    beforeEach(() => {
      cache = new GenerationalCache(4);
      cache.set('a', 1).set('b', 2); // old={a,b}, current={}
      cache.set('c', 3); // current={c}, old={a,b}
    });

    it('should yield keys in the order of current -> old using the keys() iterator', () => {
      const keys = [...cache.keys()];
      assert.deepEqual(keys, ['c', 'a', 'b']);
    });

    it('should yield values in the order of current -> old using the values() iterator', () => {
      const values = [...cache.values()];
      assert.deepEqual(values, [3, 1, 2]);
    });

    it('should yield [key, value] pairs in the order of current -> old using the entries() iterator', () => {
      const entries = [...cache.entries()];
      assert.deepEqual(entries, [
        ['c', 3],
        ['a', 1],
        ['b', 2]
      ]);
    });

    it('should work in for...of loops using [Symbol.iterator]()', () => {
      const result = [];
      for (const [key, value] of cache) {
        result.push(`${key}:${value}`);
      }
      assert.deepEqual(result, ['c:3', 'a:1', 'b:2']);
    });

    it('should execute the callback for all elements using forEach()', () => {
      const spy = sinon.spy();
      const thisArg = { prefix: 'test' };

      cache.forEach(function (value, key, map) {
        spy(value, key, map, this.prefix);
      }, thisArg);

      assert.strictEqual(spy.callCount, 3);
      // Callback arguments for forEach are (value, key, map)
      assert.deepEqual(spy.getCall(0).args, [3, 'c', cache, 'test']);
      assert.deepEqual(spy.getCall(1).args, [1, 'a', cache, 'test']);
      assert.deepEqual(spy.getCall(2).args, [2, 'b', cache, 'test']);
    });
  });
});
