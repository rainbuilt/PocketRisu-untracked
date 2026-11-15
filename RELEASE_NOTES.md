## PocketRisu Untracked v1.17.1

First privacy-focused release of rainbuilt/PocketRisu-untracked, based on PocketRisu 1.17.0.

- Remove persistent installation IDs, visit/user counters, and developer-bound usage reporting.
- Compare releases locally against this fork's GitHub releases, without sending installation details.
- Remove optional app attribution and Realm browser/IP metadata forwarding.
- Serve math styles/fonts locally and fetch supporter information only on explicit opening.
- Preserve chat, AI providers, local diagnostics, data storage, backups, and portable updates.

### Podman (Linux amd64 / arm64)

```sh
podman pull ghcr.io/rainbuilt/pocketrisu-untracked:v1.17.1
podman volume create pocketrisu-save
podman run -d --name pocketrisu-untracked --restart=unless-stopped \
  -p 6001:6001 -v pocketrisu-save:/app/save \
  ghcr.io/rainbuilt/pocketrisu-untracked:v1.17.1
```

Open `http://YOUR_MINIPC_IP:6001`. The named volume retains data when the container is replaced. Use the existing save volume instead when migrating an installation, and back it up before migration.

The `latest` tag tracks this fork's latest container release. Both CPU architectures are included in the image manifest. Portable archives are also attached for Windows, Linux, and macOS.

### Validation

Typecheck, production build, and privacy regression tests pass. Existing UI accessibility warnings remain. Arbitrary user-installed plugins and remote content can make their own network requests.
