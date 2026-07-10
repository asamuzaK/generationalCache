/**
 * @file payload-validator.js
 */

/* constants */
/**
 * Maximum number of bytes per character.
 * @type {number}
 */
const MAX_BYTES_PER_CHAR = 4;

/**
 * Flag indicating whether the current runtime environment is Node.js.
 * @type {boolean}
 */
const IS_NODE = globalThis.process?.versions?.node !== undefined;

/**
 * Validates cache payloads for forbidden types and size limits.
 */
export class PayloadValidator {
  #cacheFunction;
  #cacheSymbol;
  #encoder;

  /**
   * Creates an instance of PayloadValidator.
   * @param {object} [opt] - Optional configuration parameters.
   * @param {boolean} [opt.cacheFunction] - Allows caching functions if true.
   * @param {boolean} [opt.cacheSymbol] - Allows caching symbols if true.
   */
  constructor(opt = {}) {
    this.#cacheFunction = !!opt.cacheFunction;
    this.#cacheSymbol = !!opt.cacheSymbol;
  }

  /**
   * Validates if the given input fits within the specified maximum byte size
   * and does not contain forbidden types.
   * @param {unknown} input - The input data to validate.
   * @param {number} max - The maximum allowable size in bytes.
   * @returns {boolean} True if the input is valid, false otherwise.
   */
  validate(input, max) {
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
   * Checks if a value is forbidden from being cached based on the current
   * configuration (e.g., unallowed functions or symbols).
   * @param {unknown} value - The value to check for forbidden types.
   * @param {WeakSet<object>} visited - Tracker for visited object references.
   * @returns {boolean} True if the value is forbidden, false otherwise.
   */
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
}
