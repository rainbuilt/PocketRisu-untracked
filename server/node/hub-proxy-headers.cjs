// Realm needs content negotiation, authentication, and resource cache/range
// headers. Browser identity, local credentials, and reverse-proxy metadata
// must stay on this server instead of being copied to the external hub.
const HUB_REQUEST_HEADERS = new Set([
    'accept',
    'authorization',
    'content-type',
    'range',
    'if-range',
    'if-match',
    'if-none-match',
    'if-modified-since',
    'if-unmodified-since',
    'x-risu-api-version',
]);

function normalizeHubRequestHeaders(headers) {
    const result = {};
    for (const [name, value] of Object.entries(headers)) {
        const key = name.toLowerCase();
        if (!HUB_REQUEST_HEADERS.has(key) || value === undefined) continue;
        if (typeof value === 'string') result[key] = value;
        else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
            result[key] = value.join(', ');
        }
    }
    return result;
}

module.exports = { normalizeHubRequestHeaders };
