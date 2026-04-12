# generational-cache

A lightweight, **generational pseudo-LRU (Least Recently Used) cache** for JavaScript.

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

### Initialization
```javascript
import { GenerationalCache } from '@asamuzakjp/generational-cache';

// Initialize with a max capacity of 1024 items
const cache = new GenerationalCache(1024);
```

### Basic Operations
```javascript
// Adding items
cache.set('key', 'value');

// Retrieving items (automatically promotes from old generation)
const value = cache.get('key');

// Checking existence
if (cache.has('key')) {
  console.log('Exists!');
}

// Removing an item
cache.delete('key');
```

## API

### `new GenerationalCache(max)`

Creates a new cache instance.

```javascript
const cache = new GenerationalCache(1024);
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

## Performance Benchmark

### 1. Small Cache (Max Size = 512)
| Operation | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- |
| **Set (Write)** | 16,248,854 ops/sec | 20,164,908 ops/sec | **22,025,703 ops/sec** |
| **Get (Read Hit)** | 27,754,957 ops/sec | **30,751,442 ops/sec** | 10,050,473 ops/sec |
| **Eviction (Write & Drop)** | 14,543,846 ops/sec | 8,483,030 ops/sec | **15,655,528 ops/sec** |

### 2. Medium Cache (Max Size = 2,048)
| Operation | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- |
| **Set (Write)** | 14,474,126 ops/sec | **18,440,930 ops/sec** | 16,359,275 ops/sec |
| **Get (Read Hit)** | 18,302,313 ops/sec | **29,124,630 ops/sec** | 8,153,813 ops/sec |
| **Eviction (Write & Drop)** | 14,070,535 ops/sec | 8,218,095 ops/sec | **16,193,650 ops/sec** |

### 3. Large Cache (Max Size = 8,192)
| Operation | **GenerationalCache** | LRUCache | QuickLRU |
| :--- | :--- | :--- | :--- |
| **Set (Write)** | 12,024,592 ops/sec | **15,474,007 ops/sec** | 13,605,923 ops/sec |
| **Get (Read Hit)** | 12,797,592 ops/sec | **14,580,150 ops/sec** | 6,519,168 ops/sec |
| **Eviction (Write & Drop)** | 13,097,062 ops/sec | 6,341,982 ops/sec | **13,440,733 ops/sec** |

### Well-Balanced Efficiency
* As the max size increases, [LRUCache](https://www.npmjs.com/package/lru-cache) becomes bottlenecked in `Eviction (Write & Drop)`, and [QuickLRU](https://www.npmjs.com/package/quick-lru) becomes bottlenecked in `Get (Read Hit)`.
  However, `GenerationalCache` does not exhibit the significant performance degradation seen in other libraries.
* While it may not hold the top spot in any individual operation, `GenerationalCache` delivers a stable and well-balanced performance profile across all operations.

## License

MIT
