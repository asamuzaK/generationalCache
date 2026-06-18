# generational-cache

[![CI](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/ci.yaml)
[![CodeQL](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/asamuzaK/generationalCache/actions/workflows/github-code-scanning/codeql)
[![npm (scoped)](https://img.shields.io/npm/v/@asamuzakjp/generational-cache)](https://www.npmjs.com/package/@asamuzakjp/generational-cache)

A lightweight, **generational cache** with strict entry-count limits and payload validation.

## How it Works

`GenerationalCache` maintains two internal `Map` objects: `current` and `old`.
It uses an internal boundary of ($max / 2$), allowing both generations to remain bounded while keeping generation swaps inexpensive.

1. **Insertion & Validation**: New items are validated against byte size limits before being added to the `current` generation.
2. **Promotion**: If you get an item that exists in the `old` generation, it is promoted to the `current` generation to ensure it stays in the cache longer.
3. **Generation Swapping**: Once the `current` generation's size meets or exceeds the boundary threshold ($max / 2$), a generation swap is triggered: the existing `old` generation is discarded, the `current` generation becomes the new `old` generation, and a new empty `current` generation is created.

This two-generation approach avoids the overhead of updating timestamps or linked list pointers on every access. While not a drop-in replacement for standard LRU caches, it prioritizes raw throughput over strict eviction ordering.

## When NOT to Use

`GenerationalCache` may not be a good fit when:

* You require strict LRU eviction ordering.
* Cache hit rate is more important than insertion/eviction throughput.
* You already know your working set size and can provision a sufficiently large LRU cache.

## Installation

```console
npm i @asamuzakjp/generational-cache
```

## Usage

```javascript
import { GenerationalCache } from '@asamuzakjp/generational-cache';

// Initialize with a max capacity of 1024 items and custom size limits
const cache = new GenerationalCache(1024, {
  maxKeySize: 4096,          // 4 KB limit for keys
  maxValueSize: 1024 * 1024, // 1 MB limit for values
  strictValidate: true       // Enable strict deep validation for objects (default)
});
```

## API

### `new GenerationalCache(max, opt)`

Creates a new cache instance with a maximum capacity of `max` entries.

* **max** *(number)*: The maximum number of items the cache can hold. If the specified value is less than 4, or if an invalid value is specified, the default value of 4 will be used.
* **opt** *(object, optional)*:
  * **cacheFunction** *(boolean)*: Caches functions if `true`. Defaults to `false`.
  * **cacheSymbol** *(boolean)*: Caches symbols if `true`. Defaults to `false`.
  * **maxKeySize** *(number)*: Maximum allowed size for a `key` in bytes. Defaults to 8192 (8 KB).
  * **maxValueSize** *(number)*: Maximum allowed size for a `value` in bytes. Defaults to 1048576 (1 MB).
  * **strictValidate** *(boolean)*: Strictly validate object payload structures and sizes if `true`. Defaults to `true`.

### Properties

* **cache.entryCount** *(number, read-only)*: Returns the total number of underlying `entries` currently stored across both generations.
  **Note:** To maximize write throughput, this library allows temporary key duplication between the `current` and `old` generations (e.g., when an item exists in both generations simultaneously). The reported count may exceed the number of unique `keys`, but remains bounded by the cache's internal capacity.
* **cache.max** *(number)*: Gets or sets the maximum item capacity.
  **Note:** Updating this property dynamically **will clear all existing cached items** (it implicitly invokes cache.clear() to safely recalculate boundaries).

### Methods

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
| **Set** | Cold | 15,137,754 ops/sec | 4,265,484 ops/sec | 13,800,718 ops/sec | **17,844,397 ops/sec** |
| | Warm | **18,993,352 ops/sec** | 15,299,878 ops/sec | **18,132,366 ops/sec** | **19,007,793 ops/sec** |
| **Get** | Cold | 16,028,210 ops/sec | 7,566,013 ops/sec | 13,881,177 ops/sec | **30,030,030 ops/sec** |
| | Warm | 17,917,936 ops/sec | 23,523,877 ops/sec | 16,458,196 ops/sec | **39,416,634 ops/sec** |
| **Eviction** | Cold | **16,236,402 ops/sec** | 7,372,457 ops/sec | 14,547,571 ops/sec | 5,407,451 ops/sec |
| | Warm | **20,479,214 ops/sec** | 8,993,615 ops/sec | 17,123,288 ops/sec | 7,668,712 ops/sec |

### 2. Medium Cache (Max Size = 2,048)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **15,024,038 ops/sec** | 4,537,617 ops/sec | 11,818,934 ops/sec | **15,110,305 ops/sec** |
| | Warm | **17,126,220 ops/sec** | 13,299,641 ops/sec | 15,309,247 ops/sec | **17,070,673 ops/sec** |
| **Get** | Cold | 13,976,240 ops/sec | 8,134,711 ops/sec | 11,784,115 ops/sec | **26,315,789 ops/sec** |
| | Warm | 16,015,375 ops/sec | 19,425,019 ops/sec | 13,599,891 ops/sec | **35,663,338 ops/sec** |
| **Eviction** | Cold | **14,858,841 ops/sec** | 6,439,979 ops/sec | 12,425,447 ops/sec | 5,252,929 ops/sec |
| | Warm | **19,805,902 ops/sec** | 7,981,483 ops/sec | 16,108,247 ops/sec | 7,295,010 ops/sec |

### 3. Large Cache (Max Size = 8,192)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **13,292,569 ops/sec** | 3,637,686 ops/sec | 7,970,033 ops/sec | 11,318,619 ops/sec |
| | Warm | **17,652,251 ops/sec** | 11,709,602 ops/sec | 12,781,186 ops/sec | 15,225,335 ops/sec |
| **Get** | Cold | 13,840,830 ops/sec | 5,746,136 ops/sec | 11,021,713 ops/sec | **17,155,601 ops/sec** |
| | Warm | 19,116,804 ops/sec | 17,885,888 ops/sec | 15,664,160 ops/sec | **28,344,671 ops/sec** |
| **Eviction** | Cold | **14,025,245 ops/sec** | 5,358,770 ops/sec | 9,882,399 ops/sec | 4,185,501 ops/sec |
| | Warm | **19,249,278 ops/sec** | 7,029,383 ops/sec | 13,646,288 ops/sec | 6,086,798 ops/sec |

### 4. Non-Primitive Payload (Max Size = 4,096 / strictValidate = true)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | 602,410 ops/sec | 3,003,725 ops/sec | 9,948,269 ops/sec | **10,231,226 ops/sec** |
| | Warm | 757,576 ops/sec | 10,964,912 ops/sec | 14,697,237 ops/sec | **16,572,754 ops/sec** |
| **Get** | Cold | 13,180,440 ops/sec | 7,043,742 ops/sec | 11,037,528 ops/sec | **17,580,872 ops/sec** |
| | Warm | 16,170,763 ops/sec | 19,007,793 ops/sec | 14,363,689 ops/sec | **28,719,127 ops/sec** |
| **Eviction** | Cold | 617,284 ops/sec | 5,356,186 ops/sec | **12,072,920 ops/sec** | 2,607,222 ops/sec |
| | Warm | 775,194 ops/sec | 7,504,127 ops/sec | **14,981,273 ops/sec** | 6,208,481 ops/sec |

### 5. Non-Primitive Payload (Max Size = 4,096 / strictValidate = false)

| Scenario | State | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Set** | Cold | **12,315,271 ops/sec** | 2,650,060 ops/sec | 10,233,320 ops/sec | 10,884,946 ops/sec |
| | Warm | **16,100,467 ops/sec** | 10,561,893 ops/sec | 14,624,159 ops/sec | **16,672,224 ops/sec** |
| **Get** | Cold | 13,835,086 ops/sec | 7,248,478 ops/sec | 10,714,668 ops/sec | **19,015,022 ops/sec** |
| | Warm | 16,012,810 ops/sec | 18,744,142 ops/sec | 14,106,362 ops/sec | **32,927,231 ops/sec** |
| **Eviction** | Cold | 10,424,268 ops/sec | 5,473,753 ops/sec | **11,983,223 ops/sec** | 2,544,853 ops/sec |
| | Warm | **16,291,952 ops/sec** | 6,972,996 ops/sec | 13,417,416 ops/sec | 5,798,782 ops/sec |

### 6. Cyclic Access (Max Size = 8,192 / Working Set = 5,000)

| Metric | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- |
| **Hit Rate** | 78.30% | **100.00%** | **100.00%** | **100.00%** |
| **Throughput** | 8,783,487 ops/sec | 37,778,617 ops/sec | 38,550,501 ops/sec | **44,742,729 ops/sec** |

### 7. Cyclic Access (Max Size = 4,096 / Working Set = 5,000)

| Metric | GenerationalCache | LRUCache | QuickLRU | Mnemonist |
| :---- | :---- | :---- | :---- | :---- |
| **Hit Rate** | 0.00% | 0.00% | **78.30%** | 0.00% |
| **Throughput** | **9,931,472 ops/sec** | 6,396,724 ops/sec | 8,509,189 ops/sec | 6,078,288 ops/sec |

## Key Characteristics

* **High Eviction Efficiency**: `GenerationalCache` demonstrates strong throughput during high-turnover workloads, maintaining a performance margin compared to standard LRU designs in large-scale eviction scenarios.
* **Predictable Scalability**: While other libraries may experience performance degradation as cache size increases, `GenerationalCache` maintains consistent throughput due to its generational swap mechanism.
* **Balanced Read/Write**: It provides stable and competitive performance across all basic operations (`get`, `set`), making it suitable for both read-heavy and write-heavy environments.
* **Strict Validation Toggle**: By default, non-primitive payloads undergo deep validation to prevent memory exhaustion from oversized objects, which impacts write throughput. Disabling `strictValidate` restores write performance, provided that payload sizes are managed externally (See 4 & 5).
* **Trade-offs**: In cyclic access patterns where the working set is greater than `max / 2` but smaller than `max`, `GenerationalCache` will experience frequent generation swaps and cache misses. To maximize the performance benefits of `GenerationalCache`, it is often better to keep the `max` size small enough to allow some evictions, rather than trying to fit the entire working set (See 6 & 7).

## License

MIT
