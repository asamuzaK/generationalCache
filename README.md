# generational-cache

[![CI](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml)
[![CodeQL](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql)
[![npm (scoped)](https://img.shields.io/npm/v/@asamuzakjp/generational-cache)](https://www.npmjs.com/package/@asamuzakjp/generational-cache)

A lightweight, **generational pseudo-LRU (Least Recently Used) cache** with strict maximum size limits.

`GenerationalCache` uses a two-generation strategy (Current and Old) to provide a balance between memory efficiency and high-speed access, making it particularly effective for workloads with frequent evictions.

## How it Works

`GenerationalCache` maintains two internal `Map` objects: `current` and `old`.

1.  **Insertion**: New items are always added to the `current` generation.
2.  **Promotion**: If you `get` an item that exists in the `old` generation, it is promoted to the `current` generation to ensure it stays in the cache longer.
3.  **Generation Swapping**: Once the `current` generation reaches the boundary size ($max / 2$), the `old` generation is discarded, the `current` generation becomes the `old` generation, and a new empty `current` generation is created.

This "pseudo-LRU" approach avoids the overhead of updating timestamps or complex linked list pointers on every single access.

## Installation

(Under development. Not yet published to npm.)

## Usage
```javascript
import { GenerationalCache } from '@asamuzakjp/generational-cache';

// Initialize with a max capacity of 1024 items
const cache = new GenerationalCache(1024);
```

## API

### `new GenerationalCache(max)`

Creates a new cache instance.

* **`max`** *(number)*: The maximum number of items the cache can hold.
  If the specified value is less than 4, or if an invalid value is specified, the default value of 4 will be used.

### Properties

* **`cache.size`** *(number, read-only)*: Returns the total number of *entries* currently in the cache.
  **Note:** To optimize for write speed, this library allows temporary key duplication between generations.
  Therefore, this value may not always reflect the exact count of unique *keys*.
* **`cache.max`** *(number)*: Gets or sets the maximum capacity.
  **Note:** Updating this property dynamically will invoke `cache.clear()` to safely recalculate boundaries.

### Methods

* **`cache.get(key)`**
  Retrieves an item.
  If the item is found in the older generation, it is automatically promoted to the current generation to prevent it from being evicted during the next swap.
    * **Returns:** The value associated with the key, or `undefined`.
* **`cache.set(key, value)`**
  Adds or updates an item. If adding this item pushes the current generation's size to the boundary threshold (`max / 2`), a generation swap is triggered, and the old generation is discarded.
    * **Returns:** The cache instance itself (allows chaining).
* **`cache.has(key)`**
  Checks if a key exists in the cache (in either generation).
    * **Returns:** `true` if the key exists, otherwise `false`.
* **`cache.delete(key)`**
  Removes an item from the cache.
    * **Returns:** `true` if the item existed and was removed, otherwise `false`.
* **`cache.clear()`**
  Empties all items from the cache by dropping references to the internal Maps.

## Performance

Benchmarks are conducted under two distinct states:
- **Cold**: Measured during the first 1,000,000 operations (initial execution/interpreted state).
- **Warm**: Measured over a sustained period (minimum 2 seconds) after a 200,000 operation warmup.

### Benchmark Environment
- **Engine:** Node.js v24.x (V8)
- **Comparison:** [LRUCache](https://www.npmjs.com/package/lru-cache) (v11.x), [QuickLRU](https://www.npmjs.com/package/quick-lru) (v7.x)

### 1. Small Cache (Max Size = 512)
| Operation | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** (Write) | Cold | **19,887,239 ops/sec** | 14,087,900 ops/sec | 16,806,807 ops/sec |
| | Warm | **21,584,459 ops/sec** | 14,904,413 ops/sec | 19,311,201 ops/sec |
| **Get** (Read) | Cold | 20,610,609 ops/sec | **20,978,434 ops/sec** | 16,025,846 ops/sec |
| | Warm | 23,032,528 ops/sec | **25,448,338 ops/sec** | 18,482,769 ops/sec |
| **Has** (Check) | Cold | **29,734,913 ops/sec** | 24,906,910 ops/sec | 20,799,750 ops/sec |
| | Warm | **31,387,459 ops/sec** | 30,892,880 ops/sec | 25,644,508 ops/sec |
| **Eviction** | Cold | **19,354,938 ops/sec** | 2,121,395 ops/sec | 12,118,788 ops/sec |
| | Warm | **22,021,226 ops/sec** | 2,137,790 ops/sec | 14,613,687 ops/sec |

### 2. Medium Cache (Max Size = 2,048)
| Operation | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** (Write) | Cold | **16,232,896 ops/sec** | 12,363,950 ops/sec | 14,230,783 ops/sec |
| | Warm | **19,730,122 ops/sec** | 13,807,557 ops/sec | 15,766,171 ops/sec |
| **Get** (Read) | Cold | 17,704,253 ops/sec | **18,134,010 ops/sec** | 12,607,621 ops/sec |
| | Warm | **22,794,329 ops/sec** | 20,627,632 ops/sec | 19,183,657 ops/sec |
| **Has** (Check) | Cold | **24,606,541 ops/sec** | 20,186,401 ops/sec | 19,395,594 ops/sec |
| | Warm | **28,206,400 ops/sec** | 25,866,308 ops/sec | 22,220,654 ops/sec |
| **Eviction** | Cold | **19,353,140 ops/sec** | 2,090,788 ops/sec | 10,765,896 ops/sec |
| | Warm | **23,006,473 ops/sec** | 2,083,787 ops/sec | 13,650,451 ops/sec |

### 3. Large Cache (Max Size = 8,192)
| Operation | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** (Write) | Cold | **18,146,547 ops/sec** | 10,762,270 ops/sec | 13,988,263 ops/sec |
| | Warm | **19,761,427 ops/sec** | 17,268,525 ops/sec | 18,342,775 ops/sec |
| **Get** (Read) | Cold | 16,416,641 ops/sec | **17,362,316 ops/sec** | 13,026,753 ops/sec |
| | Warm | 19,624,929 ops/sec | **19,648,275 ops/sec** | 18,292,695 ops/sec |
| **Has** (Check) | Cold | **23,778,555 ops/sec** | 19,508,731 ops/sec | 17,462,978 ops/sec |
| | Warm | **26,344,654 ops/sec** | 22,837,556 ops/sec | 19,423,611 ops/sec |
| **Eviction** | Cold | **16,391,642 ops/sec** | 2,000,574 ops/sec | 10,262,451 ops/sec |
| | Warm | **21,538,604 ops/sec** | 1,980,739 ops/sec | 13,656,256 ops/sec |

*Note: Higher values (ops/sec) indicate better performance.*

### Key Characteristics

* **High Eviction Efficiency**: `GenerationalCache` demonstrates strong throughput during high-turnover workloads, maintaining a performance margin compared to standard LRU designs in large-scale eviction scenarios.
* **Predictable Scalability**: While other libraries may experience performance degradation as cache size increases, `GenerationalCache` maintains consistent throughput due to its generational swap mechanism.
* **High JIT Affinity**: The library is designed with a simple internal structure that the V8 engine can optimize effectively.
  This results in notable performance gains once the execution state becomes **Warm**.
* **Balanced Read/Write**: It provides stable and competitive performance across all basic operations (`get`, `set`, `has`), making it suitable for both read-heavy and write-heavy environments.
* **Conclusion**: As a developer, I'm more surprised than anyone by these benchmark results.
  I'm confident in the quality of the library, but benchmark results should probably be taken with a grain of salt :)

## License

MIT
