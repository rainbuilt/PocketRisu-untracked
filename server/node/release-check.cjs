const GITHUB_REPO = 'rainbuilt/PocketRisu-untracked';
const LATEST_RELEASE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

function parseVersion(version) {
    if (typeof version !== 'string') return null;
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(version);
    if (!match) return null;
    const numbers = match.slice(1, 4).map(Number);
    if (!numbers.every(Number.isSafeInteger)) return null;
    return { numbers, prerelease: match[4] };
}

// GitHub's latest release is a stable release. Compare locally so the server
// never has to report its installed version or deployment details.
function isNewerStableRelease(latest, current) {
    const next = parseVersion(latest);
    const installed = parseVersion(current);
    if (!next || next.prerelease || !installed) return false;
    for (let i = 0; i < next.numbers.length; i++) {
        if (next.numbers[i] !== installed.numbers[i]) {
            return next.numbers[i] > installed.numbers[i];
        }
    }
    return !!installed.prerelease;
}

function createReleaseChecker({ fetchImpl = (...args) => fetch(...args), now = Date.now } = {}) {
    let cachedRelease = null;
    let expiresAt = 0;
    let pending = null;

    async function loadRelease() {
        if (now() < expiresAt) return cachedRelease;
        if (pending) return pending;
        cachedRelease = null;
        pending = (async () => {
            const response = await fetchImpl(LATEST_RELEASE_URL, {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'User-Agent': 'PocketRisu',
                },
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) return null;
            const release = await response.json();
            const parsed = parseVersion(release.tag_name);
            if (!parsed || parsed.prerelease || release.draft || release.prerelease) return null;
            cachedRelease = release;
            return release;
        })();
        try {
            return await pending;
        } finally {
            // Cache public metadata (including unavailable results) and merge
            // concurrent checks. Reconnect polling must not exhaust GitHub's
            // unauthenticated rate limit. Installed versions stay uncached.
            expiresAt = now() + 5 * 60_000;
            pending = null;
        }
    }

    return async (currentVersion) => {
        const release = await loadRelease();
        if (!release) return null;
        const latestVersion = release.tag_name.replace(/^v/, '');
        const hasUpdate = isNewerStableRelease(latestVersion, currentVersion);
        return {
            currentVersion,
            latestVersion,
            hasUpdate,
            severity: hasUpdate ? 'optional' : 'none',
            releaseUrl: `https://github.com/${GITHUB_REPO}/releases/tag/${encodeURIComponent(release.tag_name)}`,
            releaseName: release.name || release.tag_name,
            publishedAt: release.published_at || '',
        };
    };
}

module.exports = {
    GITHUB_REPO,
    fetchLatestRelease: createReleaseChecker(),
    createReleaseChecker,
    isNewerStableRelease,
};
