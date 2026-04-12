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

Under development. Not yet published to npm.

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

**Benchmark Settings:** Cache Size = 4,096 / Operations = 1,000,000

| Operation | **generational-cache** | [quick-lru](https://www.npmjs.com/package/quick-lru) | [lru-cache](https://www.npmjs.com/package/lru-cache) |
| :--- | :--- | :--- | :--- |
| **Set (Write)** | 13,043,064 ops/sec (69.8%) | 13,935,320 ops/sec (74.6%) | **18,683,766 ops/sec (100%)** |
| **Get (Read Hit)** | 14,988,863 ops/sec (67.8%) | 7,173,508 ops/sec (32.4%) | **22,117,092 ops/sec (100%)** |
| **Eviction (Write & Drop)** | 13,520,767 ops/sec (92.4%) | **14,632,419 ops/sec (100%)** | 6,390,511 ops/sec (43.7%) |

### Key Takeaways:
* **Well-Balanced Efficiency**: While it may not claim the top spot in every individual category, Generational Cache offers a highly stable and balanced performance profile across all operations.
* **Reliable Performance**: It avoids the significant performance drops seen in other libraries (such as the low Read speeds in [quick-lru](https://www.npmjs.com/package/quick-lru) or the low Eviction speeds in [lru-cache](https://www.npmjs.com/package/lru-cache)), making it a dependable choice for general-purpose caching.

## License

MIT
