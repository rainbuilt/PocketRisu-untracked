import { describe, expect, it } from 'vitest'
import pkg from './hub-proxy-headers.cjs'

const { normalizeHubRequestHeaders } = pkg as {
    normalizeHubRequestHeaders: (headers: Record<string, string | string[] | undefined>) => Record<string, string>
}

describe('Realm request headers', () => {
    it('keeps card, authenticated action, and conditional asset requests functional', () => {
        const input = {
            Accept: ['application/json', 'image/webp'],
            Authorization: 'Bearer realm-token',
            'Content-Type': 'application/json',
            Range: 'bytes=0-1023',
            'If-Range': '"asset-revision"',
            'If-None-Match': '"cached-asset"',
            'If-Match': '"current-card"',
            'If-Modified-Since': 'Mon, 16 Nov 2026 00:00:00 GMT',
            'If-Unmodified-Since': 'Mon, 16 Nov 2026 00:00:00 GMT',
            'X-Risu-Api-Version': '4',
        }

        expect(normalizeHubRequestHeaders(input)).toEqual({
            accept: 'application/json, image/webp',
            authorization: 'Bearer realm-token',
            'content-type': 'application/json',
            range: 'bytes=0-1023',
            'if-range': '"asset-revision"',
            'if-none-match': '"cached-asset"',
            'if-match': '"current-card"',
            'if-modified-since': 'Mon, 16 Nov 2026 00:00:00 GMT',
            'if-unmodified-since': 'Mon, 16 Nov 2026 00:00:00 GMT',
            'x-risu-api-version': '4',
        })
        expect(input.Authorization).toBe('Bearer realm-token')
    })

    it('does not forward local credentials, browser identity, or proxy-added client metadata', () => {
        expect(normalizeHubRequestHeaders({
            Host: 'private-server.example',
            Cookie: 'risu-session=private-session',
            'Risu-Auth': 'private-password',
            'X-Session-Id': 'private-writer',
            'X-Risu-Node-Path': 'https://other.example',
            'X-Risuai-Info': '1.17.0;node',
            'User-Agent': 'Browser OS Version',
            Referer: 'https://private-server.example/chat',
            Origin: 'https://private-server.example',
            'Accept-Language': 'ko-KR',
            'Sec-CH-UA': 'Browser Version',
            'Sec-CH-UA-Platform': 'Private OS',
            'Sec-Fetch-Site': 'same-origin',
            Forwarded: 'for=192.0.2.1',
            'X-Forwarded-For': '192.0.2.1',
            'X-Real-IP': '192.0.2.1',
            'CF-Connecting-IP': '192.0.2.1',
            'X-Custom-Visitor-ID': 'unrecognized-client-metadata',
            accept: undefined,
        })).toEqual({})
    })
})
