/**
 * payload-validator.test.js
 */

import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { PayloadValidator } from '../src/payload-validator.js';

describe('PayloadValidator', () => {
  describe('Constructor Options', () => {
    it('should disallow functions and symbols by default', () => {
      const validator = new PayloadValidator();
      assert.strictEqual(
        validator.validate(() => {}, 100),
        false
      );
      assert.strictEqual(validator.validate(Symbol('test'), 100), false);
    });

    it('should allow functions if cacheFunction is true', () => {
      const validator = new PayloadValidator({ cacheFunction: true });
      assert.strictEqual(
        validator.validate(() => {}, 100),
        true
      );
    });

    it('should allow symbols if cacheSymbol is true', () => {
      const validator = new PayloadValidator({ cacheSymbol: true });
      assert.strictEqual(validator.validate(Symbol('test'), 100), true);
    });
  });

  describe('Primitive Validation', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator();
    });

    it('should validate null and undefined as always true (0 bytes)', () => {
      assert.strictEqual(validator.validate(null, 1), true);
      assert.strictEqual(validator.validate(undefined, 1), true);
    });

    it('should validate booleans correctly (max >= 5)', () => {
      assert.strictEqual(validator.validate(true, 5), true);
      assert.strictEqual(validator.validate(false, 4), false);
    });

    it('should validate numbers correctly (max >= 8)', () => {
      assert.strictEqual(validator.validate(12345, 8), true);
      assert.strictEqual(validator.validate(12345, 7), false);
    });

    it('should always allow 0n and -1n due to early return', () => {
      assert.strictEqual(validator.validate(0n, 1), true);
      assert.strictEqual(validator.validate(-1n, 1), true);
    });

    it('should accurately validate positive BigInts around byte boundaries', () => {
      assert.strictEqual(validator.validate(127n, 1), true);
      assert.strictEqual(validator.validate(128n, 1), false);
    });

    it('should accurately validate negative BigInts using sign normalization', () => {
      assert.strictEqual(validator.validate(-128n, 1), true);
      assert.strictEqual(validator.validate(-129n, 1), false);
    });

    it('should validate string sizes considering multi-byte chars', () => {
      assert.strictEqual(validator.validate('a', 5), true);
      assert.strictEqual(validator.validate('ああ', 5), false);
    });
  });

  describe('Built-in Object Validation', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator();
    });

    it('should validate ArrayBuffer and TypedArrays accurately', () => {
      const buffer = new ArrayBuffer(16);
      const view = new Uint8Array(17);
      assert.strictEqual(validator.validate(buffer, 16), true);
      assert.strictEqual(validator.validate(view, 16), false);
    });

    it('should validate valid Date objects correctly near the size boundary', () => {
      const date = new Date('2026-06-19T14:39:00.000Z');
      assert.strictEqual(validator.validate(date, 26), true);
      assert.strictEqual(validator.validate(date, 25), false);
    });

    it('should safely reject Invalid Date objects without crashing', () => {
      const invalidDate = new Date('invalid-date-string');
      assert.strictEqual(validator.validate(invalidDate, 100), false);
    });

    it('should validate RegExp objects based on string length', () => {
      assert.strictEqual(validator.validate(/a/gi, 5), true);
      assert.strictEqual(validator.validate(/longer-pattern/gi, 10), false);
    });

    it('should reject Array objects whose length exceeds max - 2 during pre-validation', () => {
      const arrLength3 = [1, 2, 3];
      assert.strictEqual(validator.validate(arrLength3, 4), false);
    });

    it('should break the switch and proceed to deep validation if array length is <= max - 2', () => {
      const validArr = ['a'];
      assert.strictEqual(validator.validate(validArr, 10), true);
      const stringificationFailArr = ['super long string'];
      assert.strictEqual(validator.validate(stringificationFailArr, 4), false);
    });
  });

  describe('Deep Object Validation & Forbidden Types', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator({
        cacheFunction: false,
        cacheSymbol: false
      });
    });

    it('should reject objects containing functions deeply nested', () => {
      const evilObj = { a: 1, b: { c: () => {} } };
      assert.strictEqual(validator.validate(evilObj, 100), false);
    });

    it('should reject objects containing Symbols deeply nested', () => {
      const evilObj = { a: 1, b: [1, 2, Symbol('test')] };
      assert.strictEqual(validator.validate(evilObj, 100), false);
    });

    it('should reject Maps containing forbidden types as keys or values', () => {
      const mapWithFuncKey = new Map([[() => {}, 'valid']]);
      assert.strictEqual(validator.validate(mapWithFuncKey, 100), false);
      const mapWithSymValue = new Map([['key', Symbol('test')]]);
      assert.strictEqual(validator.validate(mapWithSymValue, 100), false);
    });

    it('should reject circular references without crashing', () => {
      const circularObj = {};
      circularObj.self = circularObj;
      assert.strictEqual(validator.validate(circularObj, 100), false);
    });

    it('should calculate JSON payload size for safe objects', () => {
      const safeObj = { a: 1 };
      assert.strictEqual(validator.validate(safeObj, 15), true);
      assert.strictEqual(validator.validate(safeObj, 6), false);
    });

    it('should validate empty Map and Set correctly without stringification limits', () => {
      assert.strictEqual(validator.validate(new Map(), 2), true);
      assert.strictEqual(validator.validate(new Set(), 1), false);
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

    it('should fall back to safe estimation (length * 4) when neither Buffer nor TextEncoder is available', () => {
      Object.defineProperty(globalThis, 'Buffer', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(globalThis, 'TextEncoder', {
        value: undefined,
        configurable: true
      });
      const validator = new PayloadValidator();
      assert.strictEqual(validator.validate('あ', 3), false);
      assert.strictEqual(validator.validate('あ', 5), true);
    });

    it('should use TextEncoder when Buffer is not available', () => {
      Object.defineProperty(globalThis, 'Buffer', {
        value: undefined,
        configurable: true
      });
      const validator = new PayloadValidator();
      assert.strictEqual(validator.validate('あ', 3), true);
      assert.strictEqual(validator.validate('あ', 2), false);
    });

    it('should prioritize globalThis.Buffer when available', () => {
      const validator = new PayloadValidator();
      assert.strictEqual(validator.validate('ああ', 6), true);
      assert.strictEqual(validator.validate('ああ', 5), false);
    });
  });

  describe('JSON Serialization Validation (Fallback)', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator();
    });

    it('should return false if JSON.stringify results in undefined (e.g., toJSON returns undefined)', () => {
      class Evil {
        toJSON() {
          return undefined;
        }
      }
      const evilObj = new Evil(); //[cite: 2]
      assert.strictEqual(validator.validate(evilObj, 100), false);
    });

    it('should return false if the serialized string exceeds the max byte limit', () => {
      const obj = { a: 'super long string' };
      assert.strictEqual(validator.validate(obj, 15), false);
    });

    it('should return true if the serialized string is within the max byte limit', () => {
      const obj = { a: 1 };
      assert.strictEqual(validator.validate(obj, 15), true);
    });
  });

  describe('Nested Map Iteration Validation (Keys and Values)', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator({
        cacheFunction: false,
        cacheSymbol: false
      });
    });

    it('should detect forbidden types during Map.keys() iteration', () => {
      const evilKeyMap = new Map();
      evilKeyMap.set(() => {}, 'safeValue');
      const objWithEvilKeyMap = { myMap: evilKeyMap };
      assert.strictEqual(validator.validate(objWithEvilKeyMap, 100), false);
    });

    it('should detect forbidden types during Map.values() iteration', () => {
      const evilValueMap = new Map();
      evilValueMap.set('safeKey', Symbol('test'));
      const objWithEvilValueMap = { myMap: evilValueMap };
      assert.strictEqual(validator.validate(objWithEvilValueMap, 100), false);
    });

    it('should detect forbidden types deeply nested within Map values', () => {
      const deepEvilValueMap = new Map();
      deepEvilValueMap.set('safeKey', { nested: () => {} });
      const objWithDeepEvilValueMap = { myMap: deepEvilValueMap };
      assert.strictEqual(
        validator.validate(objWithDeepEvilValueMap, 100),
        false
      );
    });

    it('should return false (no forbidden types) if both keys and values are safe', () => {
      const safeMap = new Map();
      safeMap.set('safeKey', 'safeValue');
      safeMap.set(123, { data: [1, 2, 3] });
      const objWithSafeMap = { myMap: safeMap }; //[cite: 2]
      assert.strictEqual(validator.validate(objWithSafeMap, 100), true);
    });
  });

  describe('Nested Set Iteration Validation', () => {
    let validator;
    beforeEach(() => {
      validator = new PayloadValidator({
        cacheFunction: false,
        cacheSymbol: false
      });
    });

    it('should detect forbidden types during Set.values() iteration', () => {
      const evilSet = new Set();
      evilSet.add(() => {});
      const objWithEvilSet = { mySet: evilSet };
      assert.strictEqual(validator.validate(objWithEvilSet, 100), false);
    });

    it('should detect forbidden types deeply nested within Set values', () => {
      const deepEvilSet = new Set();
      deepEvilSet.add({ nested: Symbol('test') });
      const objWithDeepEvilSet = { mySet: deepEvilSet };
      assert.strictEqual(validator.validate(objWithDeepEvilSet, 100), false);
    });

    it('should return false (no forbidden types) if all Set values are safe', () => {
      const safeSet = new Set();
      safeSet.add('safeValue');
      safeSet.add(123);
      const objWithSafeSet = { mySet: safeSet };
      assert.strictEqual(validator.validate(objWithSafeSet, 100), true);
    });
  });

  describe('Object Symbol Keys Validation (Object.getOwnPropertySymbols)', () => {
    it('should reject immediately if the object has Symbol keys and cacheSymbol is false', () => {
      const validator = new PayloadValidator({ cacheSymbol: false });
      const objWithSymKey = { [Symbol('key')]: 'safe value' };
      assert.strictEqual(validator.validate(objWithSymKey, 100), false);
    });

    it('should detect forbidden types in the values of Symbol keys if cacheSymbol is true', () => {
      const validator = new PayloadValidator({
        cacheSymbol: true,
        cacheFunction: false
      });
      const objWithEvilSymValue = {
        [Symbol('key')]: () => {}
      };
      assert.strictEqual(validator.validate(objWithEvilSymValue, 100), false);
    });

    it('should pass if cacheSymbol is true and all Symbol key values are safe', () => {
      const validator = new PayloadValidator({ cacheSymbol: true });
      const safeSym = Symbol('safe');
      const objWithSafeSymValue = {
        [safeSym]: 'safe value',
        normalKey: 123
      };
      assert.strictEqual(validator.validate(objWithSafeSymValue, 100), true);
    });
  });
});
