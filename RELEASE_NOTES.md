## PocketRisu Untracked v1.17.2

Sponsorship-free update for rainbuilt/PocketRisu-untracked.

- Remove all built-in sponsorship buttons, links, supporter lists, and name registration UI.
- Delete the supporter client, server proxy/cache, and external service URLs; the removed API returns 404 without making outbound requests.
- Remove GitHub funding configuration and unused translations in all seven languages.
- Update all current READMEs with fork release links, sponsorship removal details, and Podman instructions.
- Preserve the previous telemetry removal and normal chat, storage, backup, and update functionality.

### Podman (Linux amd64 / arm64)

```sh
podman pull ghcr.io/rainbuilt/pocketrisu-untracked:v1.17.2
podman volume create pocketrisu-save
podman run -d --name pocketrisu-untracked --restart=unless-stopped \
  -p 6001:6001 -v pocketrisu-save:/app/save \
  ghcr.io/rainbuilt/pocketrisu-untracked:v1.17.2
```

Open `http://YOUR_MINIPC_IP:6001`. The named volume retains data when the container is replaced. Use the existing save volume instead when migrating an installation, and back it up before migration.

The `latest` tag tracks this fork's latest container release. Both CPU architectures are included in the image manifest. Portable archives are also attached for Windows, Linux, and macOS.

### Validation

Typecheck, production build, and privacy regression tests pass. Existing UI accessibility warnings remain. Arbitrary user-installed plugins and remote content can make their own network requests.
