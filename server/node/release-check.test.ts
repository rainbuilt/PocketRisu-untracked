import { describe, expect, it, vi } from 'vitest'
import { createReleaseChecker, isNewerStableRelease } from './release-check.cjs'

describe('release checks', () => {
    it('only sends a fixed public release request, comparing the installed version locally', async () => {
        const fetchImpl = vi.fn(async () => Response.json({
            tag_name: 'v1.18.0',
            name: 'PocketRisu 1.18.0',
            published_at: '2026-11-16T00:00:00Z',
        }))

        expect(await createReleaseChecker({ fetchImpl })('1.17.0')).toEqual({
            currentVersion: '1.17.0',
            latestVersion: '1.18.0',
            hasUpdate: true,
            severity: 'optional',
            releaseUrl: 'https://github.com/rainbuilt/PocketRisu-untracked/releases/tag/v1.18.0',
            releaseName: 'PocketRisu 1.18.0',
            publishedAt: '2026-11-16T00:00:00Z',
        })
        expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
            'https://api.github.com/repos/rainbuilt/PocketRisu-untracked/releases/latest',
            {
                headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PocketRisu' },
                signal: expect.any(AbortSignal),
            },
        )
    })

    it.each([
        ['1.10.0', '1.9.0', true],
        ['2.0.0', '1.99.99', true],
        ['1.17.0', '1.17.0', false],
        ['1.17.0', '1.18.0', false],
        ['1.17.0', '1.17.0-beta.1', true],
        ['1.17.0', '1.17.0+local', false],
        ['1.18.0-beta.1', '1.17.0', false],
        ['invalid', '1.17.0', false],
    ])('compares stable %s against installed %s', (latest, current, expected) => {
        expect(isNewerStableRelease(latest, current)).toBe(expected)
    })

    it('does not offer an update when the local version is newer', async () => {
        const check = createReleaseChecker({ fetchImpl: async () => Response.json({ tag_name: 'v1.18.0' }) })
        const result = await check('1.20.0')
        expect(result).toMatchObject({ hasUpdate: false, severity: 'none' })
    })

    it('ignores unavailable or malformed releases', async () => {
        for (const response of [
            new Response(null, { status: 403 }),
            Response.json({ tag_name: 'not-a-version' }),
            Response.json({ tag_name: 'v1.18.0', draft: true }),
        ]) {
            expect(await createReleaseChecker({ fetchImpl: async () => response })('1.17.0')).toBeNull()
        }
    })

    it('coalesces requests and caches public metadata while comparing the installed version afresh', async () => {
        let time = 0
        const fetchImpl = vi.fn(async () => Response.json({ tag_name: 'v1.18.0' }))
        const check = createReleaseChecker({ fetchImpl, now: () => time })
        const [before, after] = await Promise.all([check('1.17.0'), check('1.18.0')])
        expect(before.hasUpdate).toBe(true)
        expect(after.hasUpdate).toBe(false)
        expect(fetchImpl).toHaveBeenCalledTimes(1)
        time = 4 * 60_000
        expect((await check('1.19.0')).hasUpdate).toBe(false)
        expect(fetchImpl).toHaveBeenCalledTimes(1)
        time = 5 * 60_000
        await check('1.19.0')
        expect(fetchImpl).toHaveBeenCalledTimes(2)
    })

    it('backs off after a failed check and can retry after the cache expires', async () => {
        let time = 0
        const fetchImpl = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce(Response.json({ tag_name: 'v1.18.0' }))
        const check = createReleaseChecker({ fetchImpl, now: () => time })
        await expect(check('1.17.0')).rejects.toThrow('offline')
        expect(await check('1.17.0')).toBeNull()
        expect(fetchImpl).toHaveBeenCalledTimes(1)
        time = 5 * 60_000
        expect((await check('1.17.0')).hasUpdate).toBe(true)
        expect(fetchImpl).toHaveBeenCalledTimes(2)
    })
})
