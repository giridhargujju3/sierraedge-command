/*
 * SierraEdge 3D Smart Mannequin — Phase-1 Sensor Rig Firmware
 * Board: ESP32 DevKit V1
 *
 * Serves live sensor JSON on  GET http://<device-ip>/data
 * The SierraEdge dashboard polls that endpoint and prints the SAME
 * payload to the Serial Monitor on every request, so you can compare
 * the Arduino serial log with the dashboard values 1:1.
 *
 * Arduino IDE setup:
 *   1. Boards Manager URL: http://arduino.esp8266.com/stable/package_esp8266com_index.json
 *      is NOT needed — install "esp32 by Espressif Systems" from Boards Manager.
 *   2. Libraries (Library Manager): "OneWire" (Paul Stoffregen),
 *      "DallasTemperature" (Miles Burton).
 *   3. Board: "ESP32 Dev Module", upload, open Serial Monitor @ 115200.
 *   4. The IP address prints after WiFi connects — enter it in the
 *      dashboard: Settings -> ESP32 Configuration -> SAVE.
 *
 * Wiring (Phase-1 hardware):
 *   MAX9814 (left ear)  AO -> GPIO 34  (ADC1)
 *   MAX9814 (right ear) AO -> GPIO 35  (ADC1)
 *   MQ-135              AO -> GPIO 32  (ADC1)
 *   SW-420 (forehead)   DO -> GPIO 25
 *   SW-420 (chest)      DO -> GPIO 26
 *   DS18B20 x4          DATA -> GPIO 27 (shared bus + 4.7k pull-up to 3.3V)
 *   All VCC -> 3.3V (MAX9814/MQ-135 may use 5V/VIN; AO must stay <= 3.3V —
 *   use a voltage divider on the MQ-135 AO when powering it from 5V).
 *
 * NOTE: ADC2 pins cannot be used while WiFi is active — this sketch only
 * uses ADC1 pins (32/34/35).
 */

#include <WiFi.h>
#include <WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>

/* ----------------- CONFIGURE BEFORE FLASHING ----------------- */
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

/* Fallback access point: if the router is unreachable the rig starts its
 * own WiFi "SierraEdge-M1" (password "sierraedge") at http://192.168.4.1 */
const char* AP_SSID = "SierraEdge-M1";
const char* AP_PASS = "sierraedge";

const char* DEVICE_ID  = "SE-M1";
const uint8_t PIN_MIC_LEFT    = 34;  // MAX9814 left  ear AO
const uint8_t PIN_MIC_RIGHT   = 35;  // MAX9814 right ear AO
const uint8_t PIN_GAS         = 32;  // MQ-135 AO
const uint8_t PIN_IMPACT_HEAD = 25;  // SW-420 forehead DO
const uint8_t PIN_IMPACT_CHEST= 26;  // SW-420 chest DO
const uint8_t PIN_ONEWIRE     = 27;  // DS18B20 x4 shared data
const unsigned long LATCH_MS  = 2000; // impact stays "1" this long after a hit
/* --------------------------------------------------------------- */

WebServer server(80);
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature ds18b20(&oneWire);

unsigned long seqNo = 0;
unsigned long startedAt = 0;
unsigned long headHoldUntil = 0;
unsigned long chestHoldUntil = 0;
bool apFallback = false;

/* Peak-to-peak over a 50 ms window -> rough dB SPL estimate.
 * Calibrate the offset against a phone dB meter if you need accuracy. */
float readSoundDb(uint8_t pin) {
  int mn = 4095, mx = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < 50) {
    int v = analogRead(pin);
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  float pp = mx - mn;
  if (pp < 1.0f) pp = 1.0f;
  return 20.0f * log10f(pp) + 33.0f;
}

/* MQ-135 AO averaged over 16 samples -> crude ppm estimate.
 * For real accuracy calibrate R0 in clean air and use the MQ-135 curve. */
float readGasPpm(uint8_t pin) {
  long sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(pin); delay(2); }
  return (sum / 16.0f) / 4095.0f * 1000.0f;
}

/* SW-420 pulls LOW on vibration — latch the hit so short knocks are visible. */
bool readImpact(uint8_t pin, unsigned long& holdUntil) {
  if (digitalRead(pin) == LOW) holdUntil = millis() + LATCH_MS;
  return millis() < holdUntil;
}

/* JSON field helper — keeps commas valid (no trailing comma). */
String payloadJson() {
  float dbL = readSoundDb(PIN_MIC_LEFT);
  float dbR = readSoundDb(PIN_MIC_RIGHT);
  float ppm = readGasPpm(PIN_GAS);
  bool impactH = readImpact(PIN_IMPACT_HEAD, headHoldUntil);
  bool impactC = readImpact(PIN_IMPACT_CHEST, chestHoldUntil);

  ds18b20.requestTemperatures();
  float tF = ds18b20.getTempCByIndex(0);
  float tC = ds18b20.getTempCByIndex(1);
  float tLA = ds18b20.getTempCByIndex(2);
  float tRA = ds18b20.getTempCByIndex(3);

  String j = "{";
  auto field = [&](const String& f) {
    if (j.length() > 1) j += ",";
    j += "\n  " + f;
  };

  field("\"device_id\": \"" + String(DEVICE_ID) + "\"");
  field("\"seq_no\": " + String(seqNo));
  field("\"uptime_s\": " + String((millis() - startedAt) / 1000));
  field("\"rssi\": " + String(WiFi.RSSI()));

  field("\"sound_left_db\": " + String(dbL, 1));
  field("\"sound_right_db\": " + String(dbR, 1));
  field("\"gas_ppm\": " + String(ppm, 0));
  field("\"impact_forehead\": " + String(impactH ? 1 : 0));
  field("\"impact_chest\": " + String(impactC ? 1 : 0));

  /* DS18B20 returns -127 when a probe is missing — omit that field so the
   * dashboard shows the channel as OFFLINE instead of a bogus temperature. */
  auto tempField = [&](const char* name, float v) {
    if (v <= -126.0f) return;
    field(String(name) + ": " + String(v, 2));
  };
  tempField("\"temp_forehead_c\"", tF);
  tempField("\"temp_chest_c\"", tC);
  tempField("\"temp_left_arm_c\"", tLA);
  tempField("\"temp_right_arm_c\"", tRA);

  j += "\n}";
  return j;
}

void sendCors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Cache-Control", "no-store");
}

void handleData() {
  String body = payloadJson();
  seqNo++;
  sendCors();
  server.send(200, "application/json", body);
  /* Serial log === dashboard payload. Compare these numbers with the panels. */
  Serial.print("[/data] ");
  Serial.println(body);
}

void handleRoot() {
  sendCors();
  /* Status page: auto-refreshing JSON readout — lets anyone verify the rig
   * from a plain browser tab (same numbers the dashboard receives). */
  String html =
      "<!doctype html><meta charset=utf-8><title>SierraEdge Rig</title>"
      "<body style='font-family:monospace;background:#111;color:#3ddc84;padding:2em'>"
      "<h2>SierraEdge Smart Mannequin — " + String(DEVICE_ID) + "</h2>"
      "<p>Live feed (auto-refresh 2 s) — this JSON is what the dashboard polls:</p>"
      "<pre id='out' style='color:#fff;white-space:pre-wrap'>loading…</pre>"
      "<p>Enter this IP in the dashboard: Settings → ESP32 Configuration → SAVE</p>"
      "<script>setInterval(()=>fetch('/data').then(r=>r.json())"
      ".then(d=>{document.getElementById('out').textContent=JSON.stringify(d,null,2)}),2000)</script>"
      "</body>";
  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  delay(200);
  startedAt = millis();

  pinMode(PIN_IMPACT_HEAD, INPUT);
  pinMode(PIN_IMPACT_CHEST, INPUT);
  analogReadResolution(12);
  ds18b20.begin();

  Serial.println();
  Serial.println("=== SierraEdge Phase-1 Rig ===");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi OK — use this IP in the dashboard: ");
    Serial.println(WiFi.localIP());
  } else {
    apFallback = true;
    WiFi.mode(WIFI_AP);
    WiFi.softAP(AP_SSID, AP_PASS);
    Serial.println("Router unreachable — fallback Access Point started.");
    Serial.print("Join WiFi '"); Serial.print(AP_SSID);
    Serial.print("' (password "); Serial.print(AP_PASS);
    Serial.print(") then open: ");
    Serial.println(WiFi.softAPIP());
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/data", HTTP_GET, handleData);
  server.on("/data", HTTP_OPTIONS, []() { sendCors(); server.send(204); });
  server.begin();
  Serial.println("HTTP server ready — GET /data serves the live JSON.");
}

void loop() {
  server.handleClient();
  delay(2);
}
