# SierraEdge Command

Build a premium, professional SierraEdge Smart Mannequin System (SMS) dashboard. Use the uploaded dashboard image as the visual design target and create a similar high-end military/medical command-center interface. The dashboard must be a real interactive web application, not a static image.

MAIN GOAL

Create a real-time Smart Mannequin monitoring dashboard where an operator can see the mannequin/soldier's health, sensor readings, body status, equipment status, alerts, location, mission information, and historical trends from one screen.

IMPORTANT 3D BODY REQUIREMENT

The central human/mannequin visualization must be a digital 3D human body rendered completely in the frontend. Do NOT require a physical mannequin or physical soldier for the UI.

Use React Three Fiber / Three.js with a GLB/GLTF human model if suitable. The 3D body should:

Be displayed prominently in the center.

Have a futuristic blue/cyan holographic appearance.

Support mouse/touch rotation and zoom.

Show glowing sensor points on different body regions.

Allow clicking a body region to display its sensor information.

Highlight body regions based on sensor status.

Use cyan/blue for normal, yellow/orange for warning, and red for critical.

Have subtle animation/glow effects.

Look like a professional digital-twin/holographic mannequin.

PAGE HEADER

Use the exact product branding:

SIERRAEDGE

SMART MANNEQUIN SYSTEM

Add a top status indicator:

● REAL-TIME MONITORING

Show connection status dynamically:

ONLINE / CONNECTED

WARNING

OFFLINE

Also show the latest synchronization time.

LEFT SIDE — SOLDIER/MANNEQUIN OVERVIEW

Create a professional card containing:

Mannequin/Soldier ID

Name

Rank

Unit

Mission

Current status

Profile image/avatar

Example data can be used initially, but structure the UI so it can later receive real backend data.

LEFT SIDE — VITAL SIGNS

Create large, visually clear cards for:

Heart Rate (BPM)

Body Temperature (°C)

SpO2 (%)

Respiration Rate (RPM)

Each card should contain:

Icon

Current value

Unit

Status

Small animated trend line

LEFT SIDE — LOCATION & ENVIRONMENT

Create a location/environment card containing:

Current location

Latitude

Longitude

Altitude

Ambient temperature

Humidity

Weather

Environmental condition

Include a professional map/location visualization placeholder that can later be connected to a real map API.

LEFT SIDE — SYSTEM STATUS

Show:

Smart Mannequin connection

Sensor count, e.g. 14/14 Active

Battery percentage

Network status

Last synchronization time

Use green/yellow/red status indicators.

CENTER — DIGITAL HUMAN / MANNEQUIN

This is the most important visual element.

Place a large interactive holographic 3D human/mannequin in the center.

Divide the body into logical monitoring zones:

HEAD

Impact

Temperature

UPPER BODY

Heart Rate

Respiration

Posture

ARMS

Motion

Temperature

CORE

Core Temperature

SpO2

Hydration

LEGS

Motion

Load

Fatigue

Display small callout panels around the 3D body connected with thin lines to the corresponding body areas.

Do not overcrowd the body. Keep the center visually clean.

When a user clicks a body sensor point, open a small detailed information panel showing the sensor name, live value, status, and recent trend.

RIGHT SIDE — SENSOR DATA

Create a vertical Sensor Data panel.

Display:

Core Body Temperature

Heart Rate

Respiration

Blood Oxygen

Stress Level

Hydration

Fatigue Level

Motion Status

Each sensor card should contain:

Sensor icon

Sensor name

Current value/status

Mini trend graph

Health/status indicator

RIGHT SIDE — MISSION & PERFORMANCE

Create a Mission & Performance card containing:

Mission name

Mission duration

Distance covered

Calories/energy

Performance score

Circular performance gauge

Use a modern circular progress indicator for the performance score.

RIGHT SIDE — ALERTS & NOTIFICATIONS

Create a real-time alerts panel.

Show alerts such as:

Temperature warning

High heart rate

Low SpO2

High fatigue

Sensor disconnected

Communication failure

Battery warning

Normal system notifications

Each alert should show:

Timestamp

Severity

Message

Status indicator

Use:

Green = Normal

Yellow/Orange = Warning

Red = Critical

Critical alerts should be visually prominent.

RIGHT SIDE — EQUIPMENT STATUS

Create an equipment monitoring card containing:

Helmet

Vest

Communication

GPS

Power system

Other configurable equipment

Show each as:

● OK

● WARNING

● FAILED

Battery should use a visual progress bar.

RIGHT SIDE — HISTORICAL TRENDS

Create professional charts for:

Heart Rate

Core Body Temperature

SpO2

Respiration

Charts should support:

Live updating

Time ranges

Tooltip on hover

Smooth line animation

Use realistic mock data initially.

BOTTOM NAVIGATION

Create a futuristic bottom navigation bar with:

Dashboard

Live Monitor

Sensor Analytics

History

Reports

Settings

Dashboard should be active by default.

Each navigation item should open a corresponding page/view. Build the structure so additional functionality can be implemented later.

VISUAL DESIGN

The design must look like a military command center / medical monitoring NOC, not a normal admin dashboard.

Use:

Very dark background

Dark navy/black panels

Cyan/blue futuristic accents

Green for healthy status

Amber/orange for warning

Red for critical

Thin glowing borders

Glassmorphism-style cards

Subtle shadows

Professional typography

Small technical labels

Clean spacing

Rounded corners

Subtle animated data-flow effects

Avoid excessive neon effects. The interface must remain professional and readable.

RESPONSIVE DESIGN

The dashboard must work on:

Desktop

Laptop

Tablet

Prioritize desktop because this is a monitoring/control-center application.

The 3D mannequin should scale correctly without overlapping the dashboard panels.

REAL-TIME DATA ARCHITECTURE

Initially use realistic mock sensor data so the UI works without hardware.

Create a clean data layer so mock data can later be replaced by:

REST API

WebSocket

Real Smart Mannequin sensor data

Do not hard-code values directly into UI components.

Create reusable data models/interfaces for:

Soldier/Mannequin

Vital signs

Sensor data

Body zones

Equipment

Alerts

Location

Mission

Historical readings

INTERACTION REQUIREMENTS

Add:

Hover effects

Clickable sensor points

Interactive 3D body

Tooltips

Alert severity visualization

Live status indicators

Animated trend charts

Smooth page transitions

Expandable sensor details

IMPORTANT SCOPE

This is a Smart Mannequin System, NOT an SMS/text-message application.

Do not interpret SMS as Short Message Service.

SMS here means:

Smart Mannequin System

The current priority is the frontend dashboard and digital 3D mannequin visualization. Do not require physical hardware to run the dashboard.

Use realistic mock data initially and make the application fully functional in frontend/demo mode.

FINAL RESULT

The final dashboard should feel like a professional SierraEdge Smart Mannequin Command & Monitoring Center, with:

LEFT:

Soldier Overview → Vital Signs → Location/Environment → System Status

CENTER:

Interactive 3D Holographic Smart Mannequin → Body Sensor Zones

RIGHT:

Sensor Data → Mission & Performance → Alerts → Equipment Status → Historical Trends

BOTTOM:

Dashboard → Live Monitor → Sensor Analytics → History → Reports → Settings

Make the result visually close in quality, layout, depth, and futuristic monitoring style to the uploaded target image while keeping the implementation clean, reusable, responsive, and ready for future backend/hardware integration.

see lovablle if u have better plan to make this UI ,implement as your thoughts

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35a97e93-3ea0-41b3-af11-4094727ef4e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
