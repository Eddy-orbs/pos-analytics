// Failover lives only in memory: a full reload always starts with the primary.
// Chain endpoints are independent; paging continues on the same alternative.
export const SUBGRAPH_TIMEOUT_MS = 12000;
class QueryError extends Error {
    constructor(message: string, readonly failover: boolean) { super(message); }
}

async function request(endpoint: string, query: string): Promise<any> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new QueryError('Subgraph request timed out', true));
            controller.abort();
        }, SUBGRAPH_TIMEOUT_MS);
    });
    try {
        return await Promise.race([deadline, (async () => {
            const response = await fetch(endpoint, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }), signal: controller.signal
            });
            if (!response.ok) {
                throw new QueryError(`Subgraph HTTP ${response.status}`, ![400, 422].includes(response.status));
            }
            const payload = await response.json();
            if (payload.errors?.length) {
                const validation = payload.errors.some((error: any) =>
                    ['GRAPHQL_PARSE_FAILED', 'GRAPHQL_VALIDATION_FAILED', 'BAD_USER_INPUT'].includes(error.extensions?.code) ||
                    /Cannot query field|Unknown argument|Unknown type|Syntax Error|Variable .+ (invalid|not provided)/i.test(error.message || '')
                );
                // Never accept partial GraphQL results as a successful cached read.
                throw new QueryError('Subgraph query failed', !validation);
            }
            if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
                throw new QueryError('Invalid subgraph response', true);
            }
            return payload.data;
        })()]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

export function createSubgraphTransport() {
    let alternatives: Record<string, string> = {};
    const failedPrimaries = new Set<string>();
    return {
        configure(next: Record<string, string>) {
            // Reconfiguration of an unchanged pair must not reset a live circuit.
            for (const primary of Object.keys(alternatives)) {
                if (alternatives[primary] !== next[primary]) failedPrimaries.delete(primary);
            }
            alternatives = { ...next };
        },
        async post(primary: string, query: string): Promise<any> {
            const alternative = alternatives[primary];
            if (alternative && failedPrimaries.has(primary)) return request(alternative, query);
            try {
                return await request(primary, query);
            } catch (error) {
                if (!alternative || alternative === primary || (error instanceof QueryError && !error.failover)) throw error;
                failedPrimaries.add(primary);
                // One bounded attempt per endpoint; no multiplying retry loops.
                return request(alternative, query);
            }
        }
    };
}
