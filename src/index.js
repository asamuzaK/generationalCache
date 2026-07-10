/**
 * @file generational-cache.js
 * A generational cache with strict entry-count limits and payload validation.
 */

import { PayloadValidator } from '../src/payload-validator.js';

/* constants */
/**
 * Default maximum allowed size for a key in bytes (8 KB).
 * @type {number}
 */
const DEFAULT_KEY_SIZE = 8 * 1024;

/**
 * Default maximum allowed size for a value in bytes (1 MB).
 * @type {number}
 */
const DEFAULT_VALUE_SIZE = 1024 * 1024;

/**
 * A generational cache.
 * @template K, V
 */
export class GenerationalCache {
  #boundary;
  #current = new Map();
  #old = new Map();
  #maxItemsCount;
  #maxKeySize;
  #maxValueSize;
  #validator;

  /**
   * Creates an instance of GenerationalCache.
   * @param {number} maxItems - The total maximum number of items allowed.
   * @param {object} [opt] - Optional configuration parameters.
   * @param {boolean} [opt.cacheFunction] - Caches functions if true.
   * @param {boolean} [opt.cacheSymbol] - Caches symbols if true.
   * @param {number} [opt.maxKeySize] - Maximum allowed size for a key in bytes.
   * @param {number} [opt.maxValueSize] - Maximum allowed size for a value in bytes.
   * @param {boolean} [opt.strictValidate] - Strictly validate payloads if true.
   * If false, validation is disabled and other options (e.g., maxKeySize,
   * maxValueSize, cacheFunction, cacheSymbol) are ignored.
   */
  constructor(maxItems, opt = {}) {
    const {
      cacheFunction,
      cacheSymbol,
      maxKeySize,
      maxValueSize,
      strictValidate
    } = opt;
    this.max = maxItems;
    this.#maxKeySize =
      Number.isInteger(maxKeySize) && maxKeySize
        ? maxKeySize
        : DEFAULT_KEY_SIZE;
    this.#maxValueSize =
      Number.isInteger(maxValueSize) && maxValueSize
        ? maxValueSize
        : DEFAULT_VALUE_SIZE;
    const isStrict =
      typeof strictValidate === 'boolean' ? strictValidate : true;
    this.#validator = isStrict ? new PayloadValidator(opt) : null;
  }

  /**
   * Promotes old key/value to current generation.
   * @param {K} key - The key to promote.
   * @param {V} value - The value to promote.
   */
  #promote(key, value) {
    this.#current.set(key, value);
    if (this.#current.size >= this.#boundary) {
      this.#old = this.#current;
      this.#current = new Map();
    }
  }

  /**
   * Gets the total number of cached entries across both generations.
   * @note To optimize for write speed, this library allows temporary key
   * duplication between generations. Therefore, this value reflects the total
   * count of internal entries rather than the exact number of unique keys.
   * @type {number}
   */
  get entryCount() {
    return this.#current.size + this.#old.size;
  }

  /**
   * Gets the maximum item capacity configured for the cache.
   * @type {number}
   */
  get max() {
    return this.#maxItemsCount;
  }

  /**
   * Sets the maximum item capacity and recalculates internal boundaries.
   * Setting this will clear all currently cached items.
   * @param {number} value - The new maximum capacity.
   */
  set max(value) {
    if (Number.isInteger(value) && value >= 4) {
      this.#maxItemsCount = value;
      this.#boundary = Math.ceil(value / 2);
    } else {
      this.#maxItemsCount = 4;
      this.#boundary = 2;
    }
    this.clear();
  }

  /**
   * Retrieves a value associated with the specified key.
   * If the item exists in the old generation, it is promoted to the current.
   * @param {K} key - The key of the item to retrieve.
   * @returns {V|undefined} The cached value, or undefined.
   */
  get(key) {
    let value = this.#current.get(key);
    if (value !== undefined) {
      return value;
    }
    value = this.#old.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.#old.delete(key);
    this.#promote(key, value);
    return value;
  }

  /**
   * Stores a key-value pair in the cache.
   * @note `undefined` values are not cached.
   * @param {K} key - The key to associate with the value.
   * @param {V} value - The value to store.
   * @returns {GenerationalCache} The GenerationalCache instance for chaining.
   */
  set(key, value) {
    if (value === undefined) {
      return this;
    }
    if (
      !this.#validator ||
      (this.#validator.validate(key, this.#maxKeySize) &&
        this.#validator.validate(value, this.#maxValueSize))
    ) {
      this.#promote(key, value);
    }
    return this;
  }

  /**
   * Checks whether an entry with the specified key exists in either generation.
   * @param {K} key - The key to search for.
   * @returns {boolean} True if the key exists; otherwise false.
   */
  has(key) {
    return this.#current.has(key) || this.#old.has(key);
  }

  /**
   * Removes the specified element from the cache by its key.
   * @param {K} key - The key of the element to remove.
   * @returns {boolean} True if an element in the cache existed and removed; false otherwise.
   */
  delete(key) {
    const deletedFromCurrent = this.#current.delete(key);
    const deletedFromOld = this.#old.delete(key);
    return deletedFromCurrent || deletedFromOld;
  }

  /**
   * Empties the cache completely, resetting both current and old generations.
   */
  clear() {
    this.#current = new Map();
    this.#old = new Map();
  }
}
