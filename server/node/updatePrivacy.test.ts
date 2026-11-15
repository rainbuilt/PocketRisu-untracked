import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_PATH = fileURLToPath(new URL('./server.cjs', import.meta.url))
let tmpDir: string
let base: string
let child: ChildProcessWithoutNullStreams
let output = ''

function outboundRequests() {
    const log = path.join(tmpDir, 'outbound.jsonl')
    return fs.existsSync(log)
        ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
        : []
}

beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-privacy-'))
    fs.mkdirSync(path.join(tmpDir, 'save'))
    fs.writeFileSync(path.join(tmpDir, 'save', '__instance_id'), 'legacy-tracking-id')
    fs.writeFileSync(path.join(tmpDir, 'save', 'keep-me'), 'user data')
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ version: '1.17.0' }))
    fs.writeFileSync(path.join(tmpDir, '.portable'), '')
    const preload = path.join(tmpDir, 'fake-network.cjs')
    // Record every outbound request without actually using the network.
    fs.writeFileSync(preload, `
const fs = require('node:fs');
globalThis.fetch = async (url, init = {}) => {
    fs.appendFileSync('outbound.jsonl', JSON.stringify({ url: String(url), headers: init.headers, body: init.body }) + '\\n');
    return Response.json({ tag_name: 'v1.18.0', name: 'Next release' });
};
`)
    const listener = net.createServer()
    await new Promise<void>((resolve, reject) => {
        listener.once('error', reject)
        listener.listen(0, '127.0.0.1', resolve)
    })
    const port = (listener.address() as net.AddressInfo).port
    await new Promise<void>(resolve => listener.close(() => resolve()))
    base = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['--require', preload, SERVER_PATH], {
        cwd: tmpDir,
        env: {
            ...process.env,
            PORT: String(port),
            RISU_UPDATE_CHECK: 'true',
            // Existing installations may still configure the old telemetry worker.
            RISU_UPDATE_URL: 'https://legacy-telemetry.invalid/check',
            RISU_TUNNEL_DISABLED: 'true',
            POCKETRISU_BACKUP_INTERVAL_MS: String(60 * 60 * 1000),
        },
    })
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`server exited: ${output}`)
        try {
            if ((await fetch(`${base}/api/test_auth`)).ok) return
        } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error(`server did not start: ${output}`)
})

afterAll(async () => {
    if (child && child.exitCode === null) {
        const exited = new Promise<void>(resolve => child.once('exit', () => resolve()))
        const killTimer = setTimeout(() => child.kill('SIGKILL'), 3000)
        child.kill('SIGTERM')
        await exited
        clearTimeout(killTimer)
    }
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('update privacy', () => {
    it('does not contact outside services on server startup and removes only the legacy tracking file', () => {
        expect(outboundRequests()).toEqual([])
        expect(fs.existsSync(path.join(tmpDir, 'save', '__instance_id'))).toBe(false)
        expect(fs.readFileSync(path.join(tmpDir, 'save', 'keep-me'), 'utf8')).toBe('user data')
    })

    it.each(['/api/public-stats', '/api/supporters'])('does not proxy removed reporting or sponsorship endpoint %s', async (endpoint) => {
        expect((await fetch(`${base}${endpoint}`)).status).toBe(404)
        expect(outboundRequests()).toEqual([])
    })

    it('keeps manual updates working without forwarding client or installation details', async () => {
        const response = await fetch(`${base}/api/update-check?lang=ko&id=client-identifier`, {
            headers: { 'User-Agent': 'private-browser', Cookie: 'private-cookie', 'risu-auth': 'private-auth' },
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
            currentVersion: '1.17.0', latestVersion: '1.18.0', hasUpdate: true,
            severity: 'optional', deploymentType: 'portable', canSelfUpdate: true,
        })
        expect(outboundRequests()).toEqual([{
            url: 'https://api.github.com/repos/rainbuilt/PocketRisu-untracked/releases/latest',
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PocketRisu' },
        }])
        expect(fs.existsSync(path.join(tmpDir, 'save', '__instance_id'))).toBe(false)
    })
})
