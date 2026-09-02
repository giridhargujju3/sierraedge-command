#!/usr/bin/env node
/**
 * Mock ESP32 rig — simulates firmware/sierraedge_mannequin.ino without hardware.
 *
 *   node scripts/mock-esp32.mjs            # listens on :8080
 *   PORT=8080 node scripts/mock-esp32.mjs
 *
 * Then in the dashboard: Settings -> ESP32 Configuration ->
 * enter http://localhost:8080 (or your LAN IP) -> SAVE.
 * Every panel switches to live mode exactly as with the real board.
 */
import http from "node:http";
import os from "node:os";

const PORT = Number(process.env.PORT ?? 8080);
const POLL_MS = 2000;

const startedAt = Date.now();
let seq = 0;
let impactHeadUntil = 0;
let impactChestUntil = 0;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const drift = (v, amt, min, max) => clamp(v + (Math.random() - 0.5) * amt, min, max);

const state = {
  sound_left_db: 42,
  sound_right_db: 41,
  gas_ppm: 420,
  temp_forehead_c: 36.6,
  temp_chest_c: 36.8,
  temp_left_arm_c: 36.4,
  temp_right_arm_c: 36.5,
};

// Random-walk sensor drift + occasional events so alerts fire on the dashboard.
setInterval(() => {
  state.sound_left_db = drift(state.sound_left_db, 6, 30, 95);
  state.sound_right_db = drift(state.sound_right_db, 6, 30, 95);
  state.gas_ppm = drift(state.gas_ppm, 40, 350, 1100); // occasionally crosses warn/crit
  state.temp_forehead_c = drift(state.temp_forehead_c, 0.15, 35.2, 38.9);
  state.temp_chest_c = drift(state.temp_chest_c, 0.15, 35.2, 38.9);
  state.temp_left_arm_c = drift(state.temp_left_arm_c, 0.2, 35.2, 38.9);
  state.temp_right_arm_c = drift(state.temp_right_arm_c, 0.2, 35.2, 38.9);
  if (Math.random() < 0.04) impactHeadUntil = Date.now() + 2000; // ~1 hit / 50 s
  if (Math.random() < 0.04) impactChestUntil = Date.now() + 2000;
}, POLL_MS);

function payload() {
  return {
    device_id: "SE-MOCK",
    seq_no: ++seq,
    uptime_s: Math.floor((Date.now() - startedAt) / 1000),
    rssi: -55 - Math.round(Math.random() * 10),
    interval_ms: POLL_MS,
    battery_pct: 87,
    sound_left_db: Number(state.sound_left_db.toFixed(1)),
    sound_right_db: Number(state.sound_right_db.toFixed(1)),
    gas_ppm: Math.round(state.gas_ppm),
    impact_forehead: Date.now() < impactHeadUntil ? 1 : 0,
    impact_chest: Date.now() < impactChestUntil ? 1 : 0,
    temp_forehead_c: Number(state.temp_forehead_c.toFixed(1)),
    temp_chest_c: Number(state.temp_chest_c.toFixed(1)),
    temp_left_arm_c: Number(state.temp_left_arm_c.toFixed(1)),
    temp_right_arm_c: Number(state.temp_right_arm_c.toFixed(1)),
  };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;
  if (pathname !== "/data") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }
  const packet = payload();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(packet, null, 2));
  console.log(
    `[/data] #${packet.seq_no} chest=${packet.temp_chest_c}°C gas=${packet.gas_ppm}ppm ` +
      `L/R=${packet.sound_left_db}/${packet.sound_right_db}dB impact=${packet.impact_forehead}${packet.impact_chest}`,
  );
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const lan = Object.values(nets)
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  console.log(`Mock ESP32 rig on  http://localhost:${PORT}/data`);
  for (const ip of lan) console.log(`LAN address        http://${ip}:${PORT}/data`);
  console.log("Enter one of these in the dashboard ESP32 Configuration panel.");
});
