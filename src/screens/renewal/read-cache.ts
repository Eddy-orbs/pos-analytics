// Per-network cache: navigation releases its UI subscription, not the shared read.
// Only successful results receive a five-minute TTL, measured from completion.
const TTL = 300000;
const DEADLINE = 120000;
const LIMIT = 24;
type Entry = { expires: number; pending: boolean; result: Promise<unknown> };
const scopes = new WeakMap<object, Map<string, Entry>>();
export function pageRead<T>(scope: object, key: string, read: () => Promise<T>): Promise<T> {
    let entries = scopes.get(scope);
    if (!entries) {
        entries = new Map();
        scopes.set(scope, entries);
    }
    const now = Date.now();
    for (const [id, entry] of entries) if (!entry.pending && entry.expires <= now) entries.delete(id);
    const previous = entries.get(key);
    if (previous) return previous.result as Promise<T>;
    if (entries.size >= LIMIT) {
        const completed = [...entries].find(([, entry]) => !entry.pending);
        if (completed) entries.delete(completed[0]);
        else return Promise.reject(new Error('Too many page reads in progress. Retry shortly.'));
    }
    let timer: ReturnType<typeof setTimeout>;
    // This bounds UI waiting; it does not pretend to cancel underlying Web3 transports.
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Page read timed out. Please retry.')), DEADLINE);
    });
    const entry: Entry = { expires: 0, pending: true, result: Promise.resolve() };
    entries.set(key, entry);
    entry.result = Promise.race([Promise.resolve().then(read), deadline]).then(
        (value) => {
            clearTimeout(timer);
            entry.pending = false;
            entry.expires = Date.now() + TTL;
            if (value == null && entries!.get(key) === entry) entries!.delete(key);
            return value;
        },
        (error) => {
            clearTimeout(timer);
            if (entries!.get(key) === entry) entries!.delete(key);
            throw error;
        }
    );
    return entry.result as Promise<T>;
}
