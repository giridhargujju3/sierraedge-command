# SierraEdge 3D Styles

## Goal
Add a dedicated **3D Styles** tab while preserving the current dashboard, telemetry, model interaction, and navigation. The dashboard mannequin will also be changed from glowing/translucent to a clear solid body matching the reference.

## What will be built
- Add **3D Styles** to the bottom navigation and create its own route with route-specific metadata.
- Keep mannequin selection synchronized with the existing M1–M5 fleet state.
- Build the page as a three-column SierraEdge HUD:
  - Left: mannequin selector, Stand/Walk/Run/Sit quick styles, live fleet status.
  - Center: one selected mannequin, sensor nodes and connecting lines, camera controls, play/pause/reset/data controls, digital floor.
  - Right: text-only Standard/Uniform body type selector, four pose cards, speed, loop, stop/reset, and Save Pose.
- Store independent style settings for every mannequin and restore only explicitly saved settings after reload.
- Show a clear unavailable notice for Uniform because no compatible uniform asset is currently present; Standard remains active.

## 3D and animation implementation
- Use the uploaded rigged GLB files for Walk, Run, and Sit; inspection confirms skeletal vertex data and named animation clips.
- Use the existing standing mannequin for Standing/Idle.
- Load pose assets once through the existing React Three Fiber/Three.js flow, play clips with `AnimationMixer`, and clean up mixers/actions when switching.
- Keep the body opaque and clearly lit with a neutral medical-mannequin material; remove bloom/aura/transparency from the body itself.
- Resolve sensor anchors against model bones where matching bones exist, with safe model-space fallbacks for missing anchors.
- Recalculate sensor node and connector positions during animation and camera movement.

## State and persistence
- Add a typed mannequin-style store keyed by mannequin ID with body type, pose, playback state, speed, loop, and saved state.
- Keep preview edits isolated to the selected mannequin.
- Save settings in browser persistence because this repository currently exposes no pose-settings database integration; the UI will identify this honestly as saved on this device.

## Validation
- Verify the dashboard still renders and the mannequin is clear rather than glowing.
- Test M1/M2 independence, all four poses, play/pause/stop/reset, speed, loop, save/restore, camera movement, sensor tracking, and unavailable Uniform handling.
- Check desktop and tablet layouts, route navigation, runtime console, and the latest automated build result.
