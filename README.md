<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>node-red-contrib-onvif</title>
</head>
<body>

<h1>node-red-contrib-onvif (Panther fork)</h1>

<p>
    <strong>Modern ONVIF discovery and media access nodes for Node-RED 4.x</strong><br>
    Maintained by Panther Computers
</p>

<hr>

<h2>Overview</h2>

<p>
    This project provides <strong>Node-RED nodes for interacting with ONVIF-compliant devices</strong>,
    with a focus on:
</p>

<ul>
    <li>Capability discovery</li>
    <li>Media profile inspection</li>
    <li>Stream and snapshot access</li>
    <li>Standards-compliant ONVIF 4.0 / 4.7 devices</li>
</ul>

<p>
    This repository is a <strong>modernized fork</strong> of the original work by Bart Butenaers,
    updated for:
</p>

<ul>
    <li>Node-RED 4.x</li>
    <li>Current <code>agsh/onvif</code> behavior</li>
    <li>Explicit capability discovery semantics</li>
    <li>Clear separation between discovery and control</li>
</ul>

<p>
    <strong>Important:</strong> This project emphasizes <em>what a device supports</em>,
    not implicit control actions.
</p>

<hr>

<h2>Key Design Principles</h2>

<h3>1. Discovery First, Control Second</h3>

<p>
    Most nodes are <strong>capability discovery nodes</strong>, not continuous service clients.
</p>

<p>They answer questions like:</p>

<ul>
    <li>What media profiles exist?</li>
    <li>Does the device support Events?</li>
    <li>What recording services are advertised?</li>
</ul>

<p>They do <strong>not</strong>:</p>

<ul>
    <li>Subscribe to event streams</li>
    <li>Maintain long-lived listeners</li>
    <li>Implicitly invoke device actions</li>
</ul>

<h3>2. Explicit Actions</h3>

<p>
    Nodes expect <strong>explicit <code>msg.action</code> values</strong> when multiple ONVIF
    operations exist.
</p>

<p>
    If a node supports only discovery:
</p>

<ul>
    <li>All actions return the same discovery result</li>
    <li>The node help explicitly states this</li>
</ul>

<h3>3. Runtime Profile Cache</h3>

<p>
    The ONVIF Config node maintains a <strong>runtime-only profile cache</strong>:
</p>

<ul>
    <li>Profiles are fetched at connect time</li>
    <li>Exposed to media nodes and editor dropdowns</li>
    <li>Never persisted to disk</li>
</ul>

<p>
    This avoids stale tokens and aligns with ONVIF expectations.
</p>

<hr>

<h2>Node Summary</h2>

<table border="1" cellpadding="6" cellspacing="0">
    <thead>
        <tr>
            <th>Node</th>
            <th>Purpose</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>ONVIF Config</td>
            <td>Device connection, authentication, profile discovery</td>
        </tr>
        <tr>
            <td>ONVIF Media Profile</td>
            <td>Media profile discovery and profile-scoped operations</td>
        </tr>
        <tr>
            <td>ONVIF Media</td>
            <td>Stream URI and snapshot access</td>
        </tr>
        <tr>
            <td>ONVIF Events</td>
            <td><strong>Event Capability Discovery</strong></td>
        </tr>
        <tr>
            <td>ONVIF Recording</td>
            <td><strong>Recording Capability Discovery</strong></td>
        </tr>
    </tbody>
</table>

<hr>

<h2>ONVIF Config Node</h2>

<p>
    The ONVIF Config node represents a <strong>single ONVIF device</strong>.
</p>

<h3>Responsibilities</h3>

<ul>
    <li>Establish authenticated ONVIF connection</li>
    <li>Maintain connection health</li>
    <li>Cache media profiles at runtime</li>
    <li>Emit connection status changes</li>
</ul>

<h3>Status States</h3>

<ul>
    <li><code>not configured</code></li>
    <li><code>connecting</code></li>
    <li><code>connected</code></li>
    <li><code>disconnected</code></li>
</ul>

<p>
    These states are propagated to dependent nodes.
</p>

<hr>

<h2>Media Profile Node</h2>

<h3>Purpose</h3>

<p>
    Discovers and operates on <strong>media profiles</strong>.
</p>

<h3>Discovery Behavior</h3>

<ul>
    <li><code>getProfiles</code> returns all available profiles</li>
    <li>Profile names and tokens are normalized</li>
    <li>Tokens are resolved automatically when a profile name is provided</li>
</ul>

<h3>Profile Tokens</h3>

<p>
    Users typically <strong>do not need to manually supply tokens</strong>.
</p>

<p>Supported methods:</p>

<ul>
    <li>Select profile by name (preferred)</li>
    <li>Use token directly (advanced usage)</li>
    <li>Resolve via runtime cache</li>
</ul>

<hr>

<h2>Events Node — Event Capability Discovery</h2>

<p>
    <strong>This node does NOT subscribe to events.</strong>
</p>

<h3>Purpose</h3>

<p>
    Determines whether the device:
</p>

<ul>
    <li>Advertises ONVIF Events services</li>
    <li>Responds to <code>GetEventProperties</code></li>
</ul>

<h3>Behavior</h3>

<ul>
    <li>All actions invoke event capability discovery</li>
    <li>Output reflects supported event topics, filters, and message descriptions</li>
</ul>

<h3>Status Meaning</h3>

<ul>
    <li><code>connected</code> – Events service reachable</li>
    <li><code>unsupported</code> – Device does not advertise Events</li>
    <li><code>disconnected</code> – Device unavailable</li>
</ul>

<p>
    Use this node to decide whether external event subscription logic is viable.
</p>

<hr>

<h2>Recording Node — Recording Capability Discovery</h2>

<p>
    <strong>This node does NOT manage recordings.</strong>
</p>

<h3>Purpose</h3>

<p>
    Determines whether the device:
</p>

<ul>
    <li>Advertises ONVIF Recording services</li>
    <li>Responds to recording discovery calls</li>
</ul>

<h3>Behavior</h3>

<ul>
    <li>All actions perform recording service discovery</li>
    <li>Output reflects available recording endpoints and metadata</li>
</ul>

<h3>Status Meaning</h3>

<ul>
    <li><code>connected</code> – Recording service reachable</li>
    <li><code>unsupported</code> – Device does not advertise Recording</li>
    <li><code>disconnected</code> – Device unavailable</li>
</ul>

<hr>

<h2>Status Consistency</h2>

<table border="1" cellpadding="6" cellspacing="0">
    <thead>
        <tr>
            <th>Status</th>
            <th>Meaning</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>connected</td>
            <td>Service reachable and responding</td>
        </tr>
        <tr>
            <td>unsupported</td>
            <td>Service not advertised by device</td>
        </tr>
        <tr>
            <td>disconnected</td>
            <td>Device unreachable</td>
        </tr>
        <tr>
            <td>not configured</td>
            <td>Missing config or credentials</td>
        </tr>
    </tbody>
</table>

<hr>

<h2>PTZ Support (Deferred)</h2>

<p>
    PTZ functionality is currently <strong>excluded</strong> from this package.
</p>

<p>Reasons:</p>

<ul>
    <li>High device-specific variance</li>
    <li>Complex state handling</li>
    <li>Not required for Panther internal usage</li>
</ul>

<p>
    PTZ may return in a future release or as a community-maintained extension.
</p>

<hr>

<h2>Compatibility</h2>

<ul>
    <li>Node-RED: <strong>4.x</strong></li>
    <li>ONVIF: <strong>4.0 / 4.7</strong></li>
    <li>Tested with: Hanwha, Axis (partial), generic ONVIF cameras</li>
</ul>

<hr>

<h2>Licensing</h2>

<p>
    Apache License 2.0<br>
    Original work © 2018 Bart Butenaers<br>
    Modifications © 2025–2026 Panther Computers
</p>

</body>
</html>
