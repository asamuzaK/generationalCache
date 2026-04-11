# generational-cache

A Map-like, generational pseudo-LRU cache with strict maximum size limits and O(1) operations.

## Overview

`GenerationalCache` is a zero-dependency cache library designed for environments where **execution speed** and **memory management** are critical (e.g., Edge functions, IoT devices, or massive DOM manipulation tasks).

It implements a dual-generation pseudo-LRU algorithm.
Unlike strict LRU caches that require linked-list pointer updates, this cache swaps and drops entire generations of data at once, taking advantage of the V8 JavaScript engine's garbage collection to achieve efficient eviction.

## Features

* **Zero Dependencies:** Lightweight with no risk of transitive breakages.
* **Map-Like:** Implements `get`, `set`, `has`, `delete`, `clear`, `forEach`, and all standard iterators (`keys`, `values`, `entries`, `Symbol.iterator`).
* **Strict Size Bounds:** The combined size of the internal generations will not exceed your configured `max` value, mitigating OOM (Out of Memory) issues.
* **O(1) Operations:** Uses Hash Table operations without additional arrays or linked lists.

## Installation

```bash
npm install @asamuzakjp/generational-cache
````

## Usage

```javascript
import { GenerationalCache } from '@asamuzakjp/generational-cache';

// Initialize with a maximum size (e.g., 100)
const cache = new GenerationalCache(100);

// Acts just like a standard Map
cache.set('foo', 'bar');
console.log(cache.get('foo')); // 'bar'
console.log(cache.has('foo')); // true

// Supports chaining
cache.set('a', 1).set('b', 2);

// Supports all iterators without memory overhead
for (const [key, value] of cache) {
  console.log(`${key}: ${value}`);
}

// When the cache exceeds the internal boundary (max / 2), 
// it automatically slides generations and evicts the oldest unseen items.
```

## API

### `new GenerationalCache(max)`

Creates a new cache instance.

```javascript
const cache = new GenerationalCache(100);
```

  * **`max`** *(number)*: The absolute maximum number of items the cache can hold.
    If the specified value is less than 4, or if an invalid value is specified, the default value of 4 will be used.

### Properties

  * **`cache.size`** *(number, read-only)*: Returns the total number of items currently in the cache.
  * **`cache.max`** *(number)*: Gets or sets the maximum capacity.
    **Note:** Updating this property dynamically will invoke `cache.clear()` to safely recalculate boundaries.

### Methods

  * **`cache.get(key)`**
    Retrieves an item.
    If the item is found in the older generation, it is automatically promoted to the current generation to prevent it from being evicted during the next swap.
      * **Returns:** The value associated with the key, or `undefined`.
  * **`cache.set(key, value)`**
    Adds or updates an item. If adding this item pushes the current generation's size to the boundary threshold (`max / 2`), a generation swap is triggered, and the oldest generation is discarded.
      * **Returns:** The cache instance itself (allows chaining).
  * **`cache.has(key)`**
    Checks if a key exists in the cache (in either generation).
      * **Returns:** `true` if the key exists, otherwise `false`.
  * **`cache.delete(key)`**
    Removes an item from the cache.
      * **Returns:** `true` if the item existed and was removed, otherwise `false`.
  * **`cache.clear()`**
    Empties all items from the cache by dropping references to the internal Maps.

### Iterators

  * **`cache.forEach(callbackFn, [thisArg])`**
    Executes `callbackFn(value, key, cache)` once for each key/value pair.
    Elements are iterated from the newest generation to the oldest.
  * **`cache.keys()`**
    Returns a new Iterable Iterator containing the keys.
  * **`cache.values()`**
    Returns a new Iterable Iterator containing the values.
  * **`cache.entries()`** (also `cache[Symbol.iterator]()`)
    Returns a new Iterable Iterator containing an array of `[key, value]` for each element.
    Allows the cache to be used directly in `for...of` loops.

## Performance & Trade-offs

`GenerationalCache` is designed as a balanced O(1) cache.
It prioritizes strict memory bounds and consistent speed across reads and evictions, which comes with specific architectural trade-offs compared to other popular libraries like [`quick-lru`](https://www.npmjs.com/package/quick-lru) and [`lru-cache`](https://www.npmjs.com/package/lru-cache).

**Overall Assessment:**
While `GenerationalCache` may not always be the absolute fastest in every single category, it offers a **highly practical and well-balanced performance profile**.
It avoids the significant bottlenecks found in other implementations under specific workloads (such as read hits in `quick-lru` or high-volume evictions in `lru-cache`), making it a reliable choice for general-purpose use.

**Benchmark Results (Node.js)**
*Cache Size: 100,000 / Operations: 1,000,000*

| Operation | GenerationalCache | [QuickLRU](https://www.npmjs.com/package/quick-lru) | [LRUCache](https://www.npmjs.com/package/lru-cache) |
| :--- | :--- | :--- | :--- |
| **Set (Write)** | \~3.9M ops/sec | \~4.8M ops/sec | **\~4.8M ops/sec** |
| **Get (Read Hit)** | \~4.6M ops/sec | \~2.7M ops/sec | **\~4.9M ops/sec** |
| **Eviction (Drop)**| \~4.6M ops/sec | **\~5.3M ops/sec** | \~2.5M ops/sec |

### Strengths

  * **Fast Reads:** `GenerationalCache` does not mutate data structures on read hits.
    In our benchmarks, read operations performed at **166% the speed** of `quick-lru` and reached **93% the speed** of the top-performing `lru-cache`.
  * **Efficient Eviction:** By dropping the entire older generation map at once, it avoids the linked-list pointer updates of `lru-cache`.
    It performed at **184% the speed** of `lru-cache` and maintained **86% the speed** of the specialized `quick-lru`.
  * **Balanced Set Performance:** While `lru-cache` leads in pure insertion speed, `GenerationalCache` maintains a competitive throughput at **81% the speed** of the top-tier libraries while enforcing stricter memory boundaries.
  * **Strict Size Bound:** The total size never exceeds the configured `max`. This provides a predictable memory footprint without sacrificing O(1) performance.

### Weaknesses & Trade-offs

  * **Insertion Overhead (Set):** `GenerationalCache` is slightly slower than the alternatives during pure insertions due to an extra check (`if (old.has(key)) { old.delete(key); }`) required to guarantee strict memory boundaries and accurate sizing.
  * **Pseudo-LRU vs. Strict LRU:** This is a *generational* cache, not a strict LRU.
    When the current generation fills up, the older generation is discarded.
    An item added just before a generation swap might be dropped as "collateral damage" if another swap occurs before it is accessed, even if it was added more recently than some surviving items in a strict LRU cache.

## License

MIT © asamuzaK
