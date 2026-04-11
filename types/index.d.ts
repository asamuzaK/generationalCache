export class GenerationalCache<K, V> {
    constructor(max: number);
    set max(value: number);
    get max(): number;
    get size(): number;
    get(key: K): V | undefined;
    set(key: K, value: V): GenerationalCache<K, V>;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    entries(): IterableIterator<[K, V]>;
    forEach(callbackFn: (value: V, key: K, cache: GenerationalCache<K, V>) => void, thisArg?: unknown): void;
    [Symbol.iterator](): IterableIterator<[K, V]>;
    #private;
}
