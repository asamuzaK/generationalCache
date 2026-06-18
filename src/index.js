/**
 * @file generational-cache.js
 * A generational cache with strict entry-count limits and payload validation.
 */

/* constants */
/**
 * Maximum number of bytes per character.
 * @type {number}
 */
const MAX_BYTES_PER_CHAR = 4;

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
 * Flag indicating whether the current runtime environment is Node.js.
 * @type {boolean}
 */
const IS_NODE = globalThis.process?.versions?.node !== undefined;

/**
 * A generational cache.
 * @template K, V
 */
export class GenerationalCache {
  #encoder;
  #boundary;
  #current = new Map();
  #old = new Map();
  #cacheFunction;
  #cacheSymbol;
  #maxItemsCount;
  #maxKeySize;
  #maxValueSize;
  #strictValidate;

  /**
   * Creates an instance of GenerationalCache.
   * @param {number} maxItems - The total maximum number of items allowed.
   * @param {object} [opt] - Optional configuration parameters.
   * @param {boolean} [opt.cacheFunction] - Caches functions if true.
   * @param {boolean} [opt.cacheSymbol] - Caches symbols if true.
   * @param {number} [opt.maxKeySize] - Maximum allowed size for a key in bytes.
   * @param {number} [opt.maxValueSize] - Maximum allowed size for a value in bytes.
   * @param {boolean} [opt.strictValidate] - Strictly validate if true.
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
    this.#cacheFunction = !!cacheFunction;
    this.#cacheSymbol = !!cacheSymbol;
    this.#maxKeySize =
      Number.isInteger(maxKeySize) && maxKeySize
        ? maxKeySize
        : DEFAULT_KEY_SIZE;
    this.#maxValueSize =
      Number.isInteger(maxValueSize) && maxValueSize
        ? maxValueSize
        : DEFAULT_VALUE_SIZE;
    this.#strictValidate =
      typeof strictValidate === 'boolean' ? strictValidate : true;
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
   * Validates if the given string fits within the specified maximum byte size.
   * @param {string} input - The input string to validate.
   * @param {number} max - The maximum allowable size in bytes.
   * @returns {boolean} True if the input is within limits, false otherwise.
   */
  #validateString(input, max) {
    if (input.length > max) {
      return false;
    }
    if (input.length * MAX_BYTES_PER_CHAR <= max) {
      return true;
    }
    if (IS_NODE && globalThis.Buffer) {
      return globalThis.Buffer.byteLength(input, 'utf8') <= max;
    }
    if (!this.#encoder && globalThis.TextEncoder) {
      this.#encoder = new globalThis.TextEncoder();
    }
    if (this.#encoder) {
      return this.#encoder.encode(input).byteLength <= max;
    }
    return false;
  }

  #isForbidden(value, visited) {
    const type = typeof value;
    if (type === 'function' && !this.#cacheFunction) {
      return true;
    }
    if (type === 'symbol' && !this.#cacheSymbol) {
      return true;
    }
    if (value !== null && type === 'object') {
      return this.#hasForbiddenTypes(value, visited);
    }
    return false;
  }

  /**
   * Recursively inspects an object to determine if it contains any forbidden
   * types (e.g., functions or symbols).
   * @param {object} obj - The target object or data structure to inspect.
   * @param {WeakSet<object>} [visited] - Tracker for visited object references.
   * @returns {boolean} True if a forbidden type is detected, false otherwise.
   */
  #hasForbiddenTypes(obj, visited = new WeakSet()) {
    if (visited.has(obj)) {
      return false;
    }
    visited.add(obj);
    if (obj instanceof Map) {
      for (const key of obj.keys()) {
        if (this.#isForbidden(key, visited)) {
          return true;
        }
      }
      for (const value of obj.values()) {
        if (this.#isForbidden(value, visited)) {
          return true;
        }
      }
      return false;
    }
    if (obj instanceof Set) {
      for (const value of obj.values()) {
        if (this.#isForbidden(value, visited)) {
          return true;
        }
      }
      return false;
    }
    const symbols = Object.getOwnPropertySymbols(obj);
    if (symbols.length) {
      if (!this.#cacheSymbol) {
        return true;
      }
      for (const sym of symbols) {
        if (this.#isForbidden(obj[sym], visited)) {
          return true;
        }
      }
    }
    const values = Object.values(obj);
    for (const value of values) {
      if (this.#isForbidden(value, visited)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Performs validation based on the specific type of built-in object.
   * @param {string} typeStr - The type string of the object.
   * @param {object} input - The object to validate.
   * @param {number} max - The maximum allowable size in bytes.
   * @returns {{ result?: boolean, input?: unknown }} The validation result, or the input.
   */
  #validateBuiltInObject(typeStr, input, max) {
    switch (typeStr) {
      case 'Array': {
        if (input.length > max - 2) {
          return { result: false };
        }
        break;
      }
      case 'Map':
      case 'Set': {
        if (input.size > max - 2) {
          return { result: false };
        }
        input = [...input];
        break;
      }
      case 'Date': {
        if (Number.isNaN(input.getTime())) {
          return { result: false };
        }
        return { result: this.#validateString(input.toISOString(), max - 2) };
      }
      case 'RegExp': {
        return { result: this.#validateString(input.toString(), max) };
      }
      case 'ArrayBuffer':
      case 'DataView':
      case 'Int8Array':
      case 'Uint8Array':
      case 'Uint8ClampedArray':
      case 'Int16Array':
      case 'Uint16Array':
      case 'Int32Array':
      case 'Uint32Array':
      case 'Float32Array':
      case 'Float64Array':
      case 'BigInt64Array':
      case 'BigUint64Array': {
        return { result: input.byteLength <= max };
      }
      default: {
        // fall through
      }
    }
    return { input };
  }

  /**
   * Validates if the given input fits within the specified maximum byte size.
   * @param {K|V} input - The input data to validate (usually a string).
   * @param {number} max - The maximum allowable size in bytes.
   * @returns {boolean} True if the input is within limits, false otherwise.
   */
  #validate(input, max) {
    if (input === null || input === undefined) {
      return true;
    }
    const type = typeof input;
    switch (type) {
      case 'string': {
        return this.#validateString(input, max);
      }
      case 'boolean': {
        return max >= 5;
      }
      case 'number': {
        return max >= 8;
      }
      case 'bigint': {
        // Normalize negative bigint for bit-length calculation.
        const signNormalized = input < 0n ? ~input : input;
        if (signNormalized === 0n) {
          return true;
        }
        const hex = signNormalized.toString(16);
        const firstCharBits = parseInt(hex[0], 16).toString(2).length;
        const bitLength = (hex.length - 1) * 4 + firstCharBits + 1;
        return bitLength <= max * 8;
      }
      case 'function': {
        return this.#cacheFunction;
      }
      case 'symbol': {
        return this.#cacheSymbol;
      }
      default: {
        if (!this.#strictValidate) {
          return true;
        }
        const typeStr = Object.prototype.toString.call(input).slice(8, -1);
        const typeCheck = this.#validateBuiltInObject(typeStr, input, max);
        if (typeCheck.result !== undefined) {
          return typeCheck.result;
        }
        input = typeCheck.input;
        if (this.#hasForbiddenTypes(input)) {
          return false;
        }
        try {
          const serialized = JSON.stringify(input);
          if (serialized === undefined) {
            return false;
          }
          return this.#validateString(serialized, max);
        } catch {
          return false;
        }
      }
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
      this.#validate(key, this.#maxKeySize) &&
      this.#validate(value, this.#maxValueSize)
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
