# generational-cache

[![CI](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml)
[![CodeQL](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql)
[![npm (scoped)](https://img.shields.io/npm/v/@asamuzakjp/generational-cache)](https://www.npmjs.com/package/@asamuzakjp/generational-cache)

A lightweight, **generational pseudo-LRU (Least Recently Used) cache** with strict maximum size limits.

## How it Works

`GenerationalCache` maintains two internal `Map` objects: `current` and `old`.

1. **Insertion & Validation**: New items are validated against byte size limits before being added to the `current` generation.
2. **Promotion**: If you get an item that exists in the `old` generation, it is promoted to the `current` generation to ensure it stays in the cache longer.
3. **Generation Swapping**: Once the `current` generation's size meets or exceeds the boundary threshold ($max / 2$), a generation swap is triggered: the existing `old` generation is discarded, the `current` generation becomes the new `old` generation, and a new empty `current` generation is created.

This "pseudo-LRU" approach avoids the overhead of updating timestamps or linked list pointers on every access. While not a drop-in replacement for standard LRU caches, it prioritizes raw throughput over strict eviction ordering.

## Installation

```console
npm i @asamuzakjp/generational-cache
```

## Usage

```javascript
import { GenerationalCache } from '@asamuzakjp/generational-cache';

// Initialize with a max capacity of 1024 items and custom size limits
const cache = new GenerationalCache(1024, {
  maxKeySize: 4096,         // 4 KB limit for keys
  maxValueSize: 1024 * 1024, // 1 MB limit for values
  strictValidate: true      // Enable strict deep validation for objects (default)
});
```

## API

### `new GenerationalCache(max)`

Creates a new cache instance.

* **max** *(number)*: The maximum number of items the cache can hold. If the specified value is less than 4, or if an invalid value is specified, the default value of 4 will be used.
* **opt** *(object, optional)*:
  * **maxKeySize** *(number)*: Maximum allowed size for a `key` in bytes. Defaults to 8192 (8 KB).
  * **maxValueSize** *(number)*: Maximum allowed size for a `value` in bytes. Defaults to 8388608 (8 MB).
  * **strictValidate** *(boolean)*: Strictly validate object payload structures and sizes if `true`. Defaults to `true`.

### **Properties**

* **cache.size** *(number, read-only)*: Returns the total number of underlying `entries` currently stored across both generations.
  **Note:** To maximize write throughput, this library allows temporary key duplication between the `current` and `old` generations (e.g., when an item exists in both generations simultaneously). Consequently, this value represents the combined internal map sizes and **may temporarily be higher than the actual number of unique keys**.
* **cache.max** *(number)*: Gets or sets the maximum item capacity.
  **Note:** Updating this property dynamically **will clear all existing cached items** (it implicitly invokes cache.clear() to safely recalculate boundaries).

### **Methods**

* **cache.get(key)**
  Retrieves an item. If the item is found in the `old` generation, it is automatically promoted to the `current` generation to prevent it from being evicted during the next swap.
  * **Returns** *(any | undefined)*: The value associated with the `key`, or `undefined` if the `key` is not found.
* **cache.set(key, value)**
  Adds or updates an item. It validates the byte size of both the key and value (if they are strings) before inserting. If this operation causes the `current` generation's size to meet or exceed the boundary threshold, a generation swap is triggered.
  * **Note:** Storing `undefined` as a value **is not supported**, as cache.get(`key`) treats `undefined` as a cache miss.
  * **Returns**: The cache instance itself (allows chaining).
* **cache.has(key)**
  Checks if a `key` exists in the cache (in either generation).
  * **Returns:** `true` if the key exists, otherwise `false`.
* **cache.delete(key)**
  Removes an item from the cache.
  * **Returns:** `true` if the item existed and was removed, otherwise `false`.
* **cache.clear()**
  Empties all items from the cache.

## Performance

Benchmarks are divided into two states to simulate real-world conditions:

* **Cold State**: Measured with aggressive internal Garbage Collection to observe performance before full V8 TurboFan optimizations.
* **Warm State**: Measured after sufficient warmup, representing sustained throughput under optimal JIT compilation.

*The results below reflect the sustained operations per second (ops/sec), calculated from the average latency (ns/iter). Higher values indicate better performance.*

### Benchmark Environment

* **Engine:** Node.js v24.x (V8)
* **Measurement:** [mitata](https://github.com/evanwashere/mitata).
* **Comparison:** [LRUCache](https://www.npmjs.com/package/lru-cache) (v11.x), [QuickLRU](https://www.npmjs.com/package/quick-lru) (v7.x), [Mnemonist](https://www.npmjs.com/package/mnemonist) (v0.40.x)

### 1. Small Cache (Max Size = 512)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **17,733,640 ops/sec** | 4,933,885 ops/sec | 13,506,212 ops/sec | **17,229,496 ops/sec** |
| | Warm | **23,030,861 ops/sec** | 15,216,068 ops/sec | 18,175,209 ops/sec | 19,409,937 ops/sec |
| **Get** | Cold | 17,717,930 ops/sec | 7,633,587 ops/sec | 13,734,377 ops/sec | **30,731,407 ops/sec** |
| | Warm | 21,724,961 ops/sec | 24,148,756 ops/sec | 16,385,384 ops/sec | **35,688,793 ops/sec** |
| **Eviction** | Cold | **16,700,066 ops/sec** | 6,953,619 ops/sec | 13,285,505 ops/sec | 4,925,865 ops/sec |
| | Warm | **23,148,148 ops/sec** | 9,040,773 ops/sec | 16,903,313 ops/sec | 8,037,293 ops/sec |

### 2. Medium Cache (Max Size = 2,048)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **15,987,210 ops/sec** | 4,874,957 ops/sec | 11,849,745 ops/sec | **15,309,246 ops/sec** |
| | Warm | **19,716,088 ops/sec** | 13,345,789 ops/sec | 14,755,791 ops/sec | 17,325,017 ops/sec |
| **Get** | Cold | 14,994,751 ops/sec | 7,950,389 ops/sec | 11,503,508 ops/sec | **23,651,844 ops/sec** |
| | Warm | 17,825,311 ops/sec | 18,789,928 ops/sec | 13,838,915 ops/sec | **31,289,111 ops/sec** |
| **Eviction** | Cold | **16,355,904 ops/sec** | 6,757,669 ops/sec | 12,074,378 ops/sec | 5,175,983 ops/sec |
| | Warm | **21,982,853 ops/sec** | 8,089,305 ops/sec | 15,309,246 ops/sec | 7,132,158 ops/sec |

### 3. Large Cache (Max Size = 8,192)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **13,679,890 ops/sec** | 3,954,288 ops/sec | 8,126,777 ops/sec | 10,972,130 ops/sec |
| | Warm | **20,593,080 ops/sec** | 12,054,001 ops/sec | 12,995,451 ops/sec | 15,600,624 ops/sec |
| **Get** | Cold | 11,918,951 ops/sec | 5,785,363 ops/sec | 9,067,827 ops/sec | **16,784,155 ops/sec** |
| | Warm | 16,781,339 ops/sec | 17,247,326 ops/sec | 12,733,987 ops/sec | **31,436,655 ops/sec** |
| **Eviction** | Cold | **13,561,160 ops/sec** | 5,510,249 ops/sec | 9,642,271 ops/sec | 4,040,404 ops/sec |
| | Warm | **21,128,248 ops/sec** | 7,082,152 ops/sec | 13,208,294 ops/sec | 6,023,007 ops/sec |

### 4. Non-Primitive Payload (Max Size = 8,192 / strictValidate = true)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | 374,531 ops/sec | 1,292,758 ops/sec | 4,452,161 ops/sec | **5,354,465 ops/sec** |
| | Warm | 518,134 ops/sec | 7,691,124 ops/sec | 8,514,986 ops/sec | **10,217,635 ops/sec** |
| **Get** | Cold | **7,426,661 ops/sec** | 4,289,268 ops/sec | 4,451,368 ops/sec | 6,655,574 ops/sec |
| | Warm | 15,342,129 ops/sec | 13,590,649 ops/sec | 9,823,182 ops/sec | **21,240,441 ops/sec** |
| **Eviction** | Cold | 378,787 ops/sec | 1,824,500 ops/sec | **5,031,700 ops/sec** | 1,100,666 ops/sec |
| | Warm | 529,100 ops/sec | 4,524,272 ops/sec | **7,826,563 ops/sec** | 4,026,251 ops/sec |

### 5. Non-Primitive Payload (Max Size = 8,192 / strictValidate = false)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **6,328,312 ops/sec** | 1,317,592 ops/sec | 5,003,752 ops/sec | 5,304,476 ops/sec |
| | Warm | 9,648,784 ops/sec | 8,122,817 ops/sec | 8,040,524 ops/sec | **10,378,827 ops/sec** |
| **Get** | Cold | 6,740,361 ops/sec | 4,473,472 ops/sec | 4,405,092 ops/sec | **7,171,543 ops/sec** |
| | Warm | 14,898,688 ops/sec | 13,674,278 ops/sec | 9,323,140 ops/sec | **21,748,586 ops/sec** |
| **Eviction** | Cold | **5,552,470 ops/sec** | 1,947,571 ops/sec | 4,745,859 ops/sec | 1,126,494 ops/sec |
| | Warm | **10,757,314 ops/sec** | 4,898,119 ops/sec | 9,266,123 ops/sec | 4,500,450 ops/sec |

### 6. Cyclic Access (Max Size = 8,192 / Working Set = 5,000)

| Metric | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- |
| **Hit Rate** | 78.30% | **100.00%** | **100.00%** | **100.00%** |
| **Throughput** | 10,365,916 ops/sec | 40,832,993 ops/sec | 40,950,040 ops/sec | **48,426,150 ops/sec** |

### 7. Cyclic Access (Max Size = 4,096 / Working Set = 5,000)

| Metric | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- |
| **Hit Rate** | 18.06% | 18.06% | **99.98%** | 18.06% |
| **Throughput** | **13,192,612 ops/sec** | 9,672,115 ops/sec | 10,188,487 ops/sec | 7,564,868 ops/sec |

## Key Characteristics

* **High Eviction Efficiency**: `GenerationalCache` demonstrates strong throughput during high-turnover workloads, maintaining a performance margin compared to standard LRU designs in large-scale eviction scenarios.
* **Predictable Scalability**: While other libraries may experience performance degradation as cache size increases, `GenerationalCache` maintains consistent throughput due to its generational swap mechanism.
* **Balanced Read/Write**: It provides stable and competitive performance across all basic operations (`get`, `set`), making it suitable for both read-heavy and write-heavy environments.
* **Strict Validation Toggle**: By default, non-primitive payloads undergo deep validation to ensure memory safety (DoS protection), trading off write throughput. Disabling `strictValidate` regains write performance, assuming payload sizes are managed externally (See 4 & 5).
* **Trade-offs**: In cyclic access patterns where the working set is greater than `max / 2` but smaller than `max`, `GenerationalCache` will experience frequent generation swaps and cache misses. To maximize the performance benefits of `GenerationalCache`, it is often better to keep the `max` size small enough to allow some evictions, rather than trying to fit the entire working set (See 6 & 7).

## License

MIT
