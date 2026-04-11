/**
 * @file generational-cache.js
 * A Map-like, generational pseudo-LRU cache with strict maximum size limits
 * and O(1) operations.
 */

/* global IterableIterator */

/**
 * @template K, V
 */
export class GenerationalCache {
  #max;
  #boundary;
  #current;
  #old;

  /**
   * Initializes a new instance of the GenerationalCache class.
   * @param {number} max - The maximum number of items the cache can hold.
   */
  constructor(max) {
    /** @type {Map<K, V>} */
    this.#current = new Map();
    /** @type {Map<K, V>} */
    this.#old = new Map();
    this.max = max;
  }

  /**
   * Returns the total number of items currently in the cache.
   * @returns {number} The current size of the cache.
   */
  get size() {
    return this.#current.size + this.#old.size;
  }

  /**
   * Returns the maximum capacity of the cache.
   * @returns {number} The maximum size limit.
   */
  get max() {
    return this.#max;
  }

  /**
   * Sets the maximum capacity of the cache and recalculates the boundary.
   * Clears the cache when updated.
   * @param {number} value - The new maximum capacity to set.
   */
  set max(value) {
    if (Number.isFinite(value) && value > 4) {
      this.#max = value;
      this.#boundary = Math.ceil(value / 2);
    } else {
      this.#max = 4;
      this.#boundary = 2;
    }
    this.clear();
  }

  /**
   * Retrieves an item from the cache.
   * If the item is in the older generation, it gets promoted to the current
   * generation.
   * @param {K} key - The key of the element to return.
   * @returns {V | undefined} The element associated with the specified key, or
   * undefined if the key cannot be found.
   */
  get(key) {
    if (this.#current.has(key)) {
      return this.#current.get(key);
    }
    if (this.#old.has(key)) {
      const value = this.#old.get(key);
      // Promote the accessed item to the current generation.
      this.set(key, value);
      return value;
    }
    return undefined;
  }

  /**
   * Adds or updates an element with a specified key and a value to the cache.
   * @param {K} key - The key of the element to add.
   * @param {V} value - The value of the element to add.
   * @returns {GenerationalCache<K, V>} The cache object itself to allow for
   * chaining.
   */
  set(key, value) {
    // Prevent duplicate keys between #current and #old to ensure accurate size
    // counting
    if (this.#old.has(key)) {
      this.#old.delete(key);
    }
    this.#current.set(key, value);
    // Swap generations if the current map reaches the boundary
    if (this.#current.size >= this.#boundary) {
      this.#old = this.#current;
      this.#current = new Map();
    }
    return this;
  }

  /**
   * Returns a boolean indicating whether an element with the specified key
   * exists or not.
   * @param {K} key - The key of the element to test for presence.
   * @returns {boolean} true if an element with the specified key exists in the
   * cache; otherwise false.
   */
  has(key) {
    return this.#current.has(key) || this.#old.has(key);
  }

  /**
   * Removes the specified element from the cache.
   * @param {K} key - The key of the element to remove.
   * @returns {boolean} true if an element in the cache existed and has been
   * removed, or false if the element does not exist.
   */
  delete(key) {
    return this.#current.delete(key) || this.#old.delete(key);
  }

  /**
   * Removes all elements from the cache.
   */
  clear() {
    this.#current.clear();
    this.#old.clear();
  }

  /**
   * Returns a new Iterator object that contains the keys for each element in
   * the cache.
   * @yields {K} A key from the cache.
   * @returns {IterableIterator<K>} An iterator for the keys.
   */
  *keys() {
    for (const key of this.#current.keys()) {
      yield key;
    }
    for (const key of this.#old.keys()) {
      yield key;
    }
  }

  /**
   * Returns a new Iterator object that contains the values for each element in
   * the cache.
   * @yields {V} A value from the cache.
   * @returns {IterableIterator<V>} An iterator for the values.
   */
  *values() {
    for (const value of this.#current.values()) {
      yield value;
    }
    for (const value of this.#old.values()) {
      yield value;
    }
  }

  /**
   * Returns a new Iterator object that contains an array of [key, value] for
   * each element in the cache.
   * @yields {[K, V]} A key-value pair from the cache.
   * @returns {IterableIterator<[K, V]>} An iterator for the key-value
   * pairs.
   */
  *entries() {
    for (const entry of this.#current.entries()) {
      yield entry;
    }
    for (const entry of this.#old.entries()) {
      yield entry;
    }
  }

  /**
   * Returns a new Iterator object that contains an array of [key, value] for
   * each element.
   * Allows the cache to be used in for...of loops.
   * @returns {IterableIterator<[K, V]>} An iterator for the key-value
   * pairs.
   */
  [Symbol.iterator]() {
    return this.entries();
  }

  /**
   * Executes a provided function once per each key/value pair in the cache.
   * @param {(value: V, key: K, cache: GenerationalCache<K, V>) => void} callbackFn - Function to execute for each element.
   * @param {unknown} [thisArg] - Value to use as `this` when executing callbackFn.
   */
  forEach(callbackFn, thisArg) {
    for (const [key, value] of this) {
      callbackFn.call(thisArg, value, key, this);
    }
  }
}
