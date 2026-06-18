/**
 * index.test.js
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
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

  describe('#validate (via set)', () => {
    describe('Primitive & Built-in Object Validation', () => {
      it('should validate null and undefined inputs as 0 bytes', () => {
        const cache = new GenerationalCache(4, {
          maxKeySize: 1,
          maxValueSize: 1
        });
        cache.set(undefined, 'a');
        assert.strictEqual(cache.get(undefined), 'a');

        cache.set(null, 'b');
        assert.strictEqual(cache.get(null), 'b');

        cache.set('c', null);
        assert.strictEqual(cache.get('c'), null);
      });

      it('should validate booleans and numbers correctly', () => {
        const cache = new GenerationalCache(4, {
          maxKeySize: 10,
          maxValueSize: 10
        });
        cache.set(true, 12345);
        assert.strictEqual(cache.get(true), 12345);
      });

      it('should always allow 0n and -1n due to early return', () => {
        const tinyCache = new GenerationalCache(4, { maxValueSize: 1 });
        tinyCache.set('zero', 0n);
        tinyCache.set('minusOne', -1n);
        assert.strictEqual(tinyCache.get('zero'), 0n);
        assert.strictEqual(tinyCache.get('minusOne'), -1n);
      });

      it('should accurately validate positive BigInts around byte boundaries', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 1 });
        cache.set('fit', 127n);
        assert.strictEqual(cache.get('fit'), 127n);
        cache.set('exceed', 128n);
        assert.strictEqual(cache.has('exceed'), false);
      });

      it('should accurately validate negative BigInts using sign normalization', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 1 });
        cache.set('fitNeg', -128n);
        assert.strictEqual(cache.get('fitNeg'), -128n);
        cache.set('exceedNeg', -129n);
        assert.strictEqual(cache.has('exceedNeg'), false);
      });

      it('should handle huge BigInts efficiently without heavy toString(2) overhead', () => {
        const hugeBigInt = 1n << 1000n;
        const smallCache = new GenerationalCache(4, { maxValueSize: 100 });
        smallCache.set('huge', hugeBigInt);
        assert.strictEqual(smallCache.has('huge'), false);
        const largeCache = new GenerationalCache(4, { maxValueSize: 200 });
        largeCache.set('huge', hugeBigInt);
        assert.strictEqual(largeCache.get('huge'), hugeBigInt);
      });

      it('should validate string sizes considering multi-byte chars', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 5 });
        cache.set('key1', 'a');
        assert.strictEqual(cache.get('key1'), 'a');

        cache.set('key2', 'ああ'); // Usually 6 bytes in UTF-8
        assert.strictEqual(cache.has('key2'), false);
      });

      it('should validate ArrayBuffer and TypedArrays accurately', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 16 });
        const buffer = new ArrayBuffer(16);
        const view = new Uint8Array(17);

        cache.set('buf', buffer);
        assert.strictEqual(cache.get('buf'), buffer);

        cache.set('view', view);
        assert.strictEqual(cache.has('view'), false);
      });

      it('should validate valid Date objects correctly near the size boundary', () => {
        const date = new Date('2026-06-19T14:39:00.000Z');
        const cacheFit = new GenerationalCache(4, { maxValueSize: 26 });
        cacheFit.set('date', date);
        assert.strictEqual(cacheFit.get('date'), date);
        const cacheExceed = new GenerationalCache(4, { maxValueSize: 25 });
        cacheExceed.set('date', date);
        assert.strictEqual(cacheExceed.has('date'), false);
      });

      it('should safely reject Invalid Date objects without crashing', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 100 });
        const invalidDate = new Date('invalid-date-string');
        cache.set('invalid', invalidDate);
        assert.strictEqual(cache.has('invalid'), false);
      });

      it('should validate RegExp objects based on string length', () => {
        const cache = new GenerationalCache(4, { maxValueSize: 5 });
        cache.set('regex1', /a/gi);
        assert.strictEqual(cache.has('regex1'), true);
        assert.strictEqual(cache.get('regex1').source, 'a');
        const tinyCache = new GenerationalCache(4, { maxValueSize: 20 });
        cache.set('regex2', /longer-pattern/gi);
        assert.strictEqual(tinyCache.has('regex2'), false);
      });

      it('should reject Array objects whose length exceeds max - 2 during pre-validation', () => {
        const cacheMax5 = new GenerationalCache(4, { maxValueSize: 5 });
        const arrLength3 = [1, 2, 3];
        cacheMax5.set('arr3', arrLength3);
        assert.strictEqual(cacheMax5.has('arr3'), false);
        const arrLength4 = [1, 2, 3, 4];
        cacheMax5.set('arr4', arrLength4);
        assert.strictEqual(cacheMax5.has('arr4'), false);
      });
    });

    describe('Deep Object Validation & Forbidden Types', () => {
      let cache;
      beforeEach(() => {
        cache = new GenerationalCache(4, { maxValueSize: 100 });
      });

      it('should reject objects containing functions deeply nested', () => {
        const evilObj = { a: 1, b: { c: () => {} } };
        cache.set('key', evilObj);
        assert.strictEqual(cache.has('key'), false);
      });

      it('should reject objects containing Symbols deeply nested', () => {
        const evilObj = { a: 1, b: [1, 2, Symbol('test')] };
        cache.set('key', evilObj);
        assert.strictEqual(cache.has('key'), false);
      });

      it('should reject objects with Symbol keys', () => {
        const evilObj = { [Symbol('key')]: 'value' };
        cache.set('key', evilObj);
        assert.strictEqual(cache.has('key'), false);
      });

      it('should reject Maps containing forbidden types as keys', () => {
        const mapWithFuncKey = new Map();
        mapWithFuncKey.set(() => {}, 'valid value');
        cache.set('mapFuncKey', mapWithFuncKey);
        assert.strictEqual(cache.has('mapFuncKey'), false);

        const mapWithSymKey = new Map();
        mapWithSymKey.set(Symbol('key'), 'valid value');
        cache.set('mapSymKey', mapWithSymKey);
        assert.strictEqual(cache.has('mapSymKey'), false);

        const mapWithDeepFuncKey = new Map();
        mapWithDeepFuncKey.set({ deeply: { nested: () => {} } }, 'valid value');
        cache.set('mapDeepFuncKey', mapWithDeepFuncKey);
        assert.strictEqual(cache.has('mapDeepFuncKey'), false);
      });

      it('should inspect Map and Set values deeply', () => {
        const map = new Map([
          ['a', 1],
          ['b', () => {}]
        ]);
        cache.set('map', map);
        assert.strictEqual(cache.has('map'), false);

        const set = new Set([1, 2, Symbol('test')]);
        cache.set('set', set);
        assert.strictEqual(cache.has('set'), false);
      });

      it('should calculate JSON payload size for objects', () => {
        const tinyCache = new GenerationalCache(4, { maxValueSize: 15 });

        // JSON string is '{"a":1}' -> 7 bytes
        tinyCache.set('obj', { a: 1 });
        assert.deepEqual(tinyCache.get('obj'), { a: 1 });

        // Map -> converted to array of entries '[["a",1]]' -> 9 bytes
        const map = new Map([['a', 1]]);
        tinyCache.set('map', map);
        assert.strictEqual(tinyCache.get('map'), map);

        // This object exceeds 15 bytes when stringified
        tinyCache.set('obj2', { a: 'super long string' });
        assert.strictEqual(tinyCache.has('obj2'), false);
      });

      it('should reject circular references without crashing', () => {
        const circularObj = {};
        circularObj.self = circularObj;

        // #hasForbiddenTypes guards against infinite loops, and JSON.stringify
        // throws a TypeError which is caught by the try-catch block, resulting
        // in a false validation.
        cache.set('circular', circularObj);
        assert.strictEqual(cache.has('circular'), false);
      });

      it('should handle un-stringifyable values', () => {
        cache.set('bigint-obj', { a: 10n });
        assert.strictEqual(cache.has('bigint-obj'), false);
      });

      it('should reject objects whose toJSON() returns undefined', () => {
        class Evil {
          toJSON() {
            return undefined;
          }
        }
        const evilObj = new Evil();
        cache.set('evil', evilObj);
        assert.strictEqual(cache.has('evil'), false);
      });

      it('should reject objects whose toJSON() returns undefined', () => {
        const funcCache = new GenerationalCache(4, { cacheFunction: true });
        const evilObj = {
          data: 'looks normal',
          toJSON: () => undefined
        };
        funcCache.set('evil', evilObj);
        assert.strictEqual(funcCache.has('evil'), false);
      });

      it('should validate empty Map and Set correctly without stringification', () => {
        const cacheMax2 = new GenerationalCache(4, { maxValueSize: 2 });
        cacheMax2.set('emptyMap', new Map());
        cacheMax2.set('emptySet', new Set());
        assert.strictEqual(cacheMax2.has('emptyMap'), true);
        assert.strictEqual(cacheMax2.has('emptySet'), true);
        const cacheMax1 = new GenerationalCache(4, { maxValueSize: 1 });
        cacheMax1.set('emptyMap', new Map());
        cacheMax1.set('emptySet', new Set());
        assert.strictEqual(cacheMax1.has('emptyMap'), false);
        assert.strictEqual(cacheMax1.has('emptySet'), false);
      });

      it('should serialize and validate non-empty Map and Set sizes', () => {
        const cacheMax5 = new GenerationalCache(4, { maxValueSize: 5 });
        cacheMax5.set('set', new Set(['a']));
        assert.strictEqual(cacheMax5.has('set'), true);
        const cacheMax4 = new GenerationalCache(4, { maxValueSize: 4 });
        cacheMax4.set('set', new Set(['a']));
        assert.strictEqual(cacheMax4.has('set'), false);
        const cacheMax9 = new GenerationalCache(4, { maxValueSize: 9 });
        cacheMax9.set('map', new Map([['a', 1]]));
        assert.strictEqual(cacheMax9.has('map'), true);
        const cacheMax8 = new GenerationalCache(4, { maxValueSize: 8 });
        cacheMax8.set('map', new Map([['a', 1]]));
        assert.strictEqual(cacheMax8.has('map'), false);
      });

      it('should deeply inspect Set instances nested inside objects', () => {
        const objWithSafeSet = {
          mySet: new Set(['valid_string', 123])
        };
        cache.set('safe-nested-set', objWithSafeSet);
        assert.strictEqual(cache.has('safe-nested-set'), true);
        const objWithEvilSet = {
          mySet: new Set([() => {}])
        };
        cache.set('evil-nested-set', objWithEvilSet);
        assert.strictEqual(cache.has('evil-nested-set'), false);
      });

      it('should deeply inspect Map instances nested inside objects for both keys and values', () => {
        const objWithSafeMap = {
          myMap: new Map([['safeKey', 'safeValue']])
        };
        cache.set('safe-nested-map', objWithSafeMap);
        assert.strictEqual(cache.has('safe-nested-map'), true);
        const objWithEvilKeyMap = {
          myMap: new Map([[() => {}, 'safeValue']]) // キーが関数
        };
        cache.set('evil-key-nested-map', objWithEvilKeyMap);
        assert.strictEqual(cache.has('evil-key-nested-map'), false);
        const objWithEvilValueMap = {
          myMap: new Map([['safeKey', () => {}]]) // 値が関数
        };
        cache.set('evil-value-nested-map', objWithEvilValueMap);
        assert.strictEqual(cache.has('evil-value-nested-map'), false);
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
          maxValueSize: 10, // Very small limit
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

      it('should validate primitives even if strictValidate is false', () => {
        const cache = new GenerationalCache(4, {
          maxValueSize: 5,
          strictValidate: false
        });

        // Primitive string validation is not skipped
        cache.set('primitive', 'abcdefghij');
        assert.strictEqual(cache.has('primitive'), false);
      });
    });

    describe('Internal Fallback Mechanics (Buffer / TextEncoder)', () => {
      let originalBuffer;
      let originalTextEncoder;

      beforeEach(() => {
        originalBuffer = globalThis.Buffer;
        originalTextEncoder = globalThis.TextEncoder;
      });

      afterEach(() => {
        Object.defineProperty(globalThis, 'Buffer', {
          value: originalBuffer,
          writable: true,
          configurable: true
        });
        Object.defineProperty(globalThis, 'TextEncoder', {
          value: originalTextEncoder,
          writable: true,
          configurable: true
        });
      });

      it('should fall back to safe estimation (length * 4)', () => {
        Object.defineProperty(globalThis, 'Buffer', {
          value: undefined,
          configurable: true
        });
        Object.defineProperty(globalThis, 'TextEncoder', {
          value: undefined,
          configurable: true
        });

        const cache = new GenerationalCache(4, { maxKeySize: 3 });
        cache.set('あ', 'value'); // 'あ'.length * 4 = 4 > 3 -> fails
        assert.strictEqual(cache.has('あ'), false);

        const cache2 = new GenerationalCache(4, { maxKeySize: 5 });
        cache2.set('あ', 'value'); // 'あ'.length * 4 = 4 <= 5 -> passes
        assert.strictEqual(cache2.has('あ'), true);
      });

      it('should use TextEncoder when Buffer is not available', () => {
        Object.defineProperty(globalThis, 'Buffer', {
          value: undefined,
          configurable: true
        });

        const cache = new GenerationalCache(4, { maxKeySize: 3 });
        // First call triggers new TextEncoder()
        cache.set('あ', 'value'); // 'あ' is 3 bytes in UTF-8 -> 3 <= 3 -> passes
        assert.strictEqual(cache.has('あ'), true);

        // Second call uses cached this.#encoder
        cache.set('い', 'value');
        assert.strictEqual(cache.has('い'), true);
      });

      it('should prioritize globalThis.Buffer when available', () => {
        const cache = new GenerationalCache(4, { maxKeySize: 3 });
        cache.set('あ', 'value');
        assert.strictEqual(cache.has('あ'), true);

        cache.set('ああ', 'value'); // 6 bytes
        assert.strictEqual(cache.has('ああ'), false);
      });
    });
  });
});
