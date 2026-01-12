node-red-contrib-onvif (Panther fork)

Modern ONVIF discovery and media access nodes for Node-RED 4.x
Maintained by Panther Computers

Overview

This project provides Node-RED nodes for interacting with ONVIF-compliant devices, with a focus on:

Capability discovery

Media profile inspection

Stream and snapshot access

Standards-compliant ONVIF 4.0 / 4.7 devices

This repository is a modernized fork of the original work by Bart Butenaers, updated for:

Node-RED 4.x

Current agsh/onvif behavior

Explicit capability discovery semantics

Clear separation between discovery and control

⚠️ This project emphasizes what a device supports, not implicit control actions.

Key Design Principles
1. Discovery First, Control Second

Most nodes are capability discovery nodes, not continuous service clients.

They answer questions like:

What media profiles exist?

Does the device support Events?

What recording services are advertised?

They do not:

Subscribe to event streams

Maintain long-lived listeners

Implicitly invoke device actions

2. Explicit Actions

Nodes expect explicit msg.action values when multiple ONVIF operations exist.

If a node supports only discovery:

All actions will return the same discovery result

The node help will explicitly state this

3. Runtime Profile Cache

The ONVIF Config node maintains a runtime-only profile cache:

Profiles are fetched at connect time

Exposed to:

Media nodes

Editor dropdowns

Never persisted to disk

This avoids stale tokens and aligns with ONVIF expectations.

Node Summary
Node	Purpose
ONVIF Config	Device connection, authentication, profile discovery
ONVIF Media Profile	Media profile discovery and profile-scoped operations
ONVIF Media	Stream URI and snapshot access
ONVIF Events	Event Capability Discovery
ONVIF Recording	Recording Capability Discovery
ONVIF Config Node

The ONVIF Config node represents a single ONVIF device.

Responsibilities

Establish authenticated ONVIF connection

Maintain connection health

Cache media profiles at runtime

Emit connection status changes

Status States

not configured

connecting

connected

disconnected

These states are propagated to dependent nodes.

Media Profile Node
Purpose

Discovers and operates on media profiles.

Discovery Behavior

getProfiles returns all available profiles

Profile names and tokens are normalized

Tokens are resolved automatically when a profile name is provided

Profile Tokens

Users typically do not need to manually supply tokens.

Supported methods:

Select profile by name (preferred)

Use token directly (advanced usage)

Resolve via runtime cache

Events Node — Event Capability Discovery

This node does NOT subscribe to events.

Purpose

Determines whether the device:

Advertises ONVIF Events services

Responds to GetEventProperties

Behavior

All actions invoke event capability discovery

Output reflects:

Supported event topics

Filter capabilities

Message descriptions

Status Meaning

connected → Events service reachable

unsupported → Device does not advertise Events

disconnected → Device unavailable

Use this node to decide whether external event subscription logic is viable.

Recording Node — Recording Capability Discovery

This node does NOT manage recordings.

Purpose

Determines whether the device:

Advertises ONVIF Recording services

Responds to recording discovery calls

Behavior

All actions perform recording service discovery

Output reflects available recording endpoints and metadata

Status Meaning

connected → Recording service reachable

unsupported → Device does not advertise Recording

disconnected → Device unavailable

Status Consistency

All discovery nodes use consistent status language:

Status	Meaning
connected	Service reachable and responding
unsupported	Service not advertised by device
disconnected	Device unreachable
not configured	Missing config or credentials
PTZ Support (Deferred)

PTZ functionality is currently excluded from this package.

Reasons:

High device-specific variance

Complex state handling

Not required for Panther internal usage

PTZ may return in a future release or as a community-maintained extension.

Compatibility

Node-RED: 4.x

ONVIF: 4.0 / 4.7

Tested with: Hanwha, Axis (partial), generic ONVIF cameras

Licensing

Apache License 2.0
Original work © 2018 Bart Butenaers
Modifications © 2025–2026 Panther Computers
