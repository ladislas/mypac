# Integrations

## Headroom

The [`headroom`](../extensions/headroom/) extension can route supported Pi providers through a local [Headroom](https://github.com/chopratejas/headroom) context-optimization proxy.

### Install

`./scripts/install.sh` and `mise run --skip-tools sync` install the exact Headroom specification declared in [`.mise/global-environment`](../.mise/global-environment) through mise's pipx backend. The backend uses the globally declared `uv` installation, so no separate Headroom installation step is required.

### Use from Pi

```text
/headroom wrap
/headroom status
/headroom stop
```

`/headroom wrap` starts the proxy and points supported providers in the current Pi session at it.

### Optional TUI auto-start

Merge the following key into `~/.pi/agent/settings.json` without replacing other settings:

```json
{
  "headroom": {
    "enabled": true
  }
}
```

When `enabled` is absent or `false`, Headroom does not start automatically. Manual `/headroom` commands remain available.

See the [upstream Headroom documentation](https://headroom-docs.vercel.app/docs) for provider support and detailed usage.

## Desktop computer use

The upstream [`pi-computer-use`](https://github.com/injaneity/pi-computer-use) Pi package can inspect and control visible macOS applications when APIs, CLI commands, filesystem access, and other structured tools are insufficient.

`./scripts/install.sh` and `mise run --skip-tools sync` install the pinned package and its per-user macOS helper, but keep the extension disabled in normal Pi sessions. Opt in for one new session by loading the already-installed package explicitly:

```sh
PI_COMPUTER_USE_BROWSER_USE=0 pi -e "$HOME/.pi/agent/npm/node_modules/@injaneity/pi-computer-use"
```

The environment setting prevents computer use from controlling known browser windows. Omit it only when desktop-level browser interaction is specifically required. For normal browser automation, use `agent-browser` instead.

On the first interactive opt-in session, follow the setup flow and grant **Accessibility** and **Screen Recording** (called **Screen & System Audio Recording** on newer macOS versions) to:

```text
~/Applications/pi-computer-use.app
```

Enable both System Settings toggles, then choose **Recheck** in Pi. The helper requires macOS 14 or newer. Run `/computer-use` to inspect the active upstream configuration. See the [upstream troubleshooting guide](https://github.com/injaneity/pi-computer-use/blob/main/docs/troubleshooting.md) if the helper or permissions are not detected.

Use desktop computer use for native applications and visual verification only after preferring more reliable structured tools. Installing it does not replace or alter browser automation.

## Browser automation

The [`pi-agent-browser-native`](https://github.com/fitchmultz/pi-agent-browser-native) package exposes the external [`agent-browser`](https://agent-browser.dev/) runtime as a native Pi tool.

`./scripts/install.sh` and `mise run --skip-tools sync` manage the complete required setup:

- mise installs the declared `agent-browser` version globally;
- `agent-browser install` provisions or repairs its Chrome for Testing payload;
- Pi installs the declared `pi-agent-browser-native` package globally; and
- the pinned upstream one-off doctor verifies compatibility.

Screenshots created without an explicit output path are stored in `$HOME/dev/agent-browser/screenshots`. Sync creates this directory and persists it as `AGENT_BROWSER_SCREENSHOT_DIR` through mise's global environment. This does not change `pi-agent-browser-native`'s secure temporary spill-file handling.

Optional capabilities such as `ffmpeg` are not installed by mypac.

## ChatGPT Agent Skills

mypac exports five runtime-neutral workflows—`pac-deep-read`, `pac-grill-me`, `pac-zoom-out`, `pac-explore`, and `pac-slidedeck`—as individual Agent Skills while keeping each canonical `skills/<name>/SKILL.md` as the source of truth.

Build upload-ready archives through the maintainer-facing mise workflow:

```sh
mise run chatgpt-skills:export
```

The task reconciles checkout-local Node dependencies, validates the allowlist and portable content, writes deterministic archives to `dist/chatgpt-skills/packages/`, and validates every archive with the pinned Agent Skills reference implementation. A successful export is ready to upload. Upload each `<skill-name>.zip` individually through ChatGPT's skill settings; the aggregate directory is only local build output, not a bulk installer.

The task handles checkout dependencies automatically. The reference check requires `uvx`. The reference implementation is supplementary; the exporter's stricter validation remains authoritative for mypac portability rules.
