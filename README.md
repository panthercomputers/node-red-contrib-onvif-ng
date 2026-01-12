# node-red-contrib-onvif-ng
[![npm version](https://img.shields.io/npm/v/node-red-contrib-onvif-ng.svg)](https://www.npmjs.com/package/node-red-contrib-onvif-ng)
[![npm downloads](https://img.shields.io/npm/dm/node-red-contrib-onvif-ng.svg)](https://www.npmjs.com/package/node-red-contrib-onvif-ng)

Modernized ONVIF nodes for Node-RED 4.x using the agsh/onvif library (ONVIF 4.7 compatible).

This project is a **maintained continuation** of  
**node-red-contrib-onvif-nodes** by Bart Butenaers, updated for modern Node-RED runtimes and real-world camera behavior.

## Legacy branch

The `bart-original` branch preserves the original upstream implementation by Bart Butenaers.
It is retained for historical reference and is not merged into `main`.
Archived screenshots and legacy documentation are preserved for reference but are not part of the current API contract.
---

## ✨ Key Features

- ✅ Node-RED 4.x compatible
- ✅ ONVIF 4.7 tested
- ✅ Centralized profile cache (no repeated device queries)
- ✅ Reliable media stream handling
- ✅ Explicit capability discovery nodes
- ✅ Clear status reporting
- ❌ PTZ intentionally excluded (for now)

---

## 📦 Included Nodes

### Configuration
- **onvif-config**  
  Handles device connection, authentication, profile caching, and connection health.

---

### Media
- **onvif-media-stream**  
  - Get Stream URI  
  - Get Snapshot URI  
  - Reconnect  

  Uses cached profiles only — no live negotiation at runtime.

- **onvif-media-profile**  
  - Get profiles  
  - Create / delete profiles  
  (Profile tokens come from the device profile cache.)

---

### Discovery / Capability Inspection

These nodes are **discovery tools**, not continuous event streams.

- **onvif-events**  
  Discovers supported ONVIF Events and topics via `GetEventProperties`.

- **onvif-recording**  
  Discovers recording capabilities and configuration.

> ℹ️ These nodes intentionally return similar payloads for each invocation.
> Their purpose is **capability inspection**, not live subscriptions.

---

## 🚫 PTZ Status

PTZ support is **not included** in this release.

Reason:
- Not used in production by the maintainers
- High UI and device-specific complexity
- Better handled as a future optional module

PTZ work done so far has been intentionally carved out and may return in a later release or as a community contribution.

---

## 🔐 Profile Cache Contract (Important)

- Profiles are fetched **once** during device initialization
- Cached centrally in `onvif-config`
- All nodes consume profiles from the cache
- No node performs live profile discovery during runtime

This ensures:
- Predictable behavior
- Faster execution
- No UI deployment deadlocks

---

## 📡 Supported Cameras

Tested with:
- Hanwha / Wisenet cameras
- Other ONVIF-compliant devices (results may vary)

ONVIF implementations vary widely — this project favors **robust behavior over strict spec assumptions**.

---

## 📜 License

Apache License 2.0

Original work:
- © 2018 Bart Butenaers

Modernization and maintenance:
- © 2025–2026 Panther Computers

---

## 🤝 Contributing

Issues and PRs are welcome.

Please:
- Target the `main` branch
- Keep changes aligned with Node-RED 4.x
- Avoid device-specific hacks unless clearly isolated

---

## 🧭 Project Status

Active maintenance  
PTZ deferred  
Stability prioritized
