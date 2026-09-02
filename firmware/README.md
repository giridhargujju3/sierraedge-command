# SierraEdge Phase-1 — ESP32 Rig Setup

Firmware for the 10-sensor smart mannequin rig and the dashboard contract it feeds.

| Sensor | Location | Rig pin | ESP32 GPIO |
| --- | --- | --- | --- |
| MAX9814 mic (left ear) | Head L | AO | 34 |
| MAX9814 mic (right ear) | Head R | AO | 35 |
| MQ-135 gas | Nose | AO | 32 |
| SW-420 shock | Forehead | DO | 25 |
| SW-420 shock | Chest | DO | 26 |
| DS18B20 × 4 | Forehead / chest / L arm / R arm | DATA (shared, 4.7k pull-up) | 27 |

## Flash the rig

1. Arduino IDE → Boards Manager → install **esp32 by Espressif Systems**.
2. Library Manager → install **OneWire** (Paul Stoffregen) and **DallasTemperature** (Miles Burton).
3. Open `sierraedge_mannequin.ino`, set `WIFI_SSID` / `WIFI_PASS`, Board = *ESP32 Dev Module**, Upload.
4. Serial Monitor @ **115200** → after connecting it prints:
   `WiFi OK — use this IP in the dashboard: 192.168.x.x`
   (No router? It starts its own hotspot **SierraEdge-M1** / `sierraedge` at `http://192.168.4.1` — join it from the PC running the dashboard.)

## Connect the dashboard

1. Open the app over **http://** (not https) — e.g. `http://localhost:5173` or your LAN IP.
2. Settings → **ESP32 Configuration** → type the IP from the serial monitor → **SAVE**.
3. Optional: press **TEST** — shows `✓ Connected in NN ms · SE-M1` on success.
4. The TopBar flips to `LIVE · ESP32 RIG` and **Packets RX** climbs every ~2 s.
   Every panel (sensors, trends, 3D zones, alerts, live monitor) now renders rig data.

## Test without hardware

```bash
node scripts/mock-esp32.mjs        # serves the exact same JSON on :8080
PORT=8123 node scripts/mock-esp32.mjs   # or any free port via PORT=
```

Enter `http://localhost:8080` in the ESP32 Configuration panel — full live pipeline,
no board required.

## Serial log ↔ dashboard

`handleData()` prints the exact JSON it serves:

```
[/data] {
  "device_id": "SE-M1",
  "seq_no": 132,
  ...
  "temp_chest_c": 36.62,
}
```

Those numbers **are** what the dashboard shows (dashboard polls every 2 s, so values
move slightly between the serial print and the panel refresh — that is normal).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| TEST shows `✗ No response` | Wrong IP, PC and rig on different networks, or dashboard opened over https (mixed content blocked). Use http. |
| Browser console shows CORS error | Firmware in this repo sends `Access-Control-Allow-Origin: *` — make sure the flashed sketch includes `sendCors()` on every reply. |
| Panel values show `--` | Packet JSON keys don't match the contract — compare the serial JSON with Settings → *Expected /data JSON contract*. Field names are case-sensitive. |
| Some temp channels offline | That DS18B20 probe returned -127 (disconnected) — firmware omits it; check wiring/pull-up. |
| Board reboots on request | Brownout — power MQ-135 from 5V/VIN, never from the 3.3V rail. |
