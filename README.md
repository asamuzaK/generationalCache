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
| **Set** (Write) | Cold | **19,468,661 ops/sec** | 12,253,880 ops/sec | 14,059,833 ops/sec |
| | Warm | **22,448,956 ops/sec** | 15,212,070 ops/sec | 19,564,756 ops/sec |
| **Get** (Read) | Cold | 20,476,236 ops/sec | **21,898,561 ops/sec** | 14,064,737 ops/sec |
| | Warm | **22,919,320 ops/sec** | 21,645,229 ops/sec | 17,014,971 ops/sec |
| **Has** (Check) | Cold | **29,467,406 ops/sec** | 25,214,703 ops/sec | 22,890,838 ops/sec |
| | Warm | **32,132,729 ops/sec** | 30,581,429 ops/sec | 24,231,771 ops/sec |
| **Eviction** | Cold | **15,390,582 ops/sec** | 7,747,331 ops/sec | 14,977,548 ops/sec |
| | Warm | **22,561,506 ops/sec** | 8,719,546 ops/sec | 16,666,595 ops/sec |

### 2. Medium Cache (Max Size = 2,048)
| Operation | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** (Write) | Cold | **16,717,208 ops/sec** | 12,015,129 ops/sec | 13,754,647 ops/sec |
| | Warm | **20,665,750 ops/sec** | 14,043,051 ops/sec | 15,196,877 ops/sec |
| **Get** (Read) | Cold | 18,225,625 ops/sec | **18,616,427 ops/sec** | 13,740,453 ops/sec |
| | Warm | **23,682,122 ops/sec** | 19,039,069 ops/sec | 18,642,768 ops/sec |
| **Has** (Check) | Cold | **24,056,735 ops/sec** | 20,591,766 ops/sec | 19,523,661 ops/sec |
| | Warm | **27,590,773 ops/sec** | 24,826,357 ops/sec | 21,069,831 ops/sec |
| **Eviction** | Cold | **17,541,920 ops/sec** | 7,585,705 ops/sec | 14,921,431 ops/sec |
| | Warm | **22,087,077 ops/sec** | 7,933,788 ops/sec | 14,707,521 ops/sec |

### 3. Large Cache (Max Size = 8,192)
| Operation | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** (Write) | Cold | **16,837,879 ops/sec** | 9,963,136 ops/sec | 12,286,159 ops/sec |
| | Warm | **19,945,392 ops/sec** | 17,228,602 ops/sec | 18,884,842 ops/sec |
| **Get** (Read) | Cold | 16,013,759 ops/sec | **16,450,290 ops/sec** | 12,865,658 ops/sec |
| | Warm | **19,337,312 ops/sec** | 17,065,952 ops/sec | 17,184,599 ops/sec |
| **Has** (Check) | Cold | **19,498,536 ops/sec** | 18,350,745 ops/sec | 16,538,575 ops/sec |
| | Warm | **25,538,961 ops/sec** | 23,307,309 ops/sec | 19,500,123 ops/sec |
| **Eviction** | Cold | **17,549,339 ops/sec** | 5,717,072 ops/sec | 11,841,634 ops/sec |
| | Warm | **21,743,343 ops/sec** | 6,764,521 ops/sec | 13,307,417 ops/sec |

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
