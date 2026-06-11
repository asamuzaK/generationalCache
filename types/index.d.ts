export class GenerationalCache<K, V> {
    constructor(maxItems: number, opt?: {
        cacheFunction?: boolean | undefined;
        cacheSymbol?: boolean | undefined;
        maxKeySize?: number | undefined;
        maxValueSize?: number | undefined;
        strictValidate?: boolean | undefined;
    });
    set max(value: number);
    get max(): number;
    get size(): number;
    get(key: K): V | undefined;
    set(key: K, value: V): GenerationalCache<any, any>;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    #private;
}
