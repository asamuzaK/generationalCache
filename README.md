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
```bash
npm i @asamuzakjp/generational-cache
```

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

Benchmarks are divided into two states to simulate real-world conditions:
- **Cold State**: Measured with aggressive internal Garbage Collection to observe performance before full V8 TurboFan optimizations.
- **Warm State**: Measured after sufficient warmup, representing sustained throughput under optimal JIT compilation.

*The results below reflect the sustained operations per second (ops/sec), calculated from the average latency (`ns/iter`). Higher values indicate better performance.*

### Benchmark Environment
- **Engine:** Node.js v24.x (V8)
- **Measurement:** [mitata](https://github.com/evanwashere/mitata).
- **Comparison:** [LRUCache](https://www.npmjs.com/package/lru-cache) (v11.x), [QuickLRU](https://www.npmjs.com/package/quick-lru) (v7.x)

### 1. Small Cache (Max Size = 512)
| Scenario | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** | Cold | **17,699,115 ops/sec** | 4,343,671 ops/sec | 15,057,973 ops/sec |
| | Warm | **21,949,078 ops/sec** | 14,664,906 ops/sec | 17,067,759 ops/sec |
| **Get** | Cold | **16,136,840 ops/sec** | 8,646,779 ops/sec | 13,262,599 ops/sec |
| | Warm | 20,462,451 ops/sec | **22,351,363 ops/sec** | 15,398,829 ops/sec |
| **Eviction** | Cold | **17,391,304 ops/sec** | 7,231,703 ops/sec | 14,788,524 ops/sec |
| | Warm | **21,640,337 ops/sec** | 7,785,130 ops/sec | 15,656,802 ops/sec |

### 2. Medium Cache (Max Size = 2,048)
| Scenario | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** | Cold | **16,382,699 ops/sec** | 3,798,526 ops/sec | 12,558,081 ops/sec |
| | Warm | **19,245,573 ops/sec** | 13,097,576 ops/sec | 14,940,983 ops/sec |
| **Get** | Cold | **14,124,293 ops/sec** | 7,747,133 ops/sec | 11,675,423 ops/sec |
| | Warm | 17,870,443 ops/sec | **18,238,190 ops/sec** | 13,477,088 ops/sec |
| **Eviction** | Cold | **16,619,577 ops/sec** | 7,020,499 ops/sec | 11,646,866 ops/sec |
| | Warm | **20,635,575 ops/sec** | 7,540,909 ops/sec | 13,908,205 ops/sec |

### 3. Large Cache (Max Size = 8,192)
| Scenario | State | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- | :--- |
| **Set** | Cold | **15,216,068 ops/sec** | 3,727,587 ops/sec | 9,911,785 ops/sec |
| | Warm | **19,432,568 ops/sec** | 11,793,843 ops/sec | 13,817,880 ops/sec |
| **Get** | Cold | **11,542,012 ops/sec** | 5,955,216 ops/sec | 8,841,732 ops/sec |
| | Warm | 17,322,016 ops/sec | **17,818,959 ops/sec** | 13,342,228 ops/sec |
| **Eviction** | Cold | **13,340,448 ops/sec** | 5,236,973 ops/sec | 9,320,533 ops/sec |
| | Warm | **19,409,937 ops/sec** | 6,889,424 ops/sec | 12,671,059 ops/sec |

### Key Characteristics

* **High Eviction Efficiency**: `GenerationalCache` demonstrates strong throughput during high-turnover workloads, maintaining a performance margin compared to standard LRU designs in large-scale eviction scenarios.
* **Predictable Scalability**: While other libraries may experience performance degradation as cache size increases, `GenerationalCache` maintains consistent throughput due to its generational swap mechanism.
* **Balanced Read/Write**: It provides stable and competitive performance across all basic operations (`get`, `set`), making it suitable for both read-heavy and write-heavy environments.
* **Conclusion**: As a developer, I'm more surprised than anyone by these benchmark results.
  I'm confident in the quality of the library, but benchmark results should probably be taken with a grain of salt :)

## License

MIT
