/*
  =================================================================================
  PROJECT SYNTHCITY NAGPUR - ESP-01 ULTRASONIC FLOOD SENSOR TELEMETRY SKETCH
  =================================================================================
  Hardware Setup:
    - Microcontroller: ESP8266 ESP-01 WiFi Module
    - Sensor: HC-SR04 Ultrasonic Distance Sensor
    - Connections:
        ESP-01 GPIO0  --> HC-SR04 TRIG
        ESP-01 GPIO2  --> HC-SR04 ECHO
        ESP-01 VCC/CH_PD --> 3.3V Power Supply
        ESP-01 GND    --> Common Ground
  
  Functionality:
    1. Measures distance to water surface in centimeters every 5 seconds.
    2. Sends real-time telemetry to SynthCity Firebase / Webhook API.
    3. Triggers immediate FLOOD ALARM if water level distance < 15 cm.
  =================================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>

// WiFi Configuration
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// SynthCity Realtime Database / API Webhook Target
const char* firebaseUrl = "https://my-project-1-602b7-default-rtdb.firebaseio.com/telemetry/esp01_flood.json";

// GPIO Pin Definitions for ESP-01
const int TRIG_PIN = 0; // GPIO0
const int ECHO_PIN = 2; // GPIO2

// Threshold settings
const float FLOOD_THRESHOLD_CM = 15.0; // Flood alert triggered if distance < 15cm

void setup() {
  Serial.begin(115200);
  delay(100);
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println("\n🚀 Starting Project SynthCity ESP-01 Flood Sensor...");

  // Connect to WiFi network
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi Connected! IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // 1. Measure Distance via HC-SR04 Ultrasonic Sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout
  float distanceCm = duration * 0.0343 / 2.0;

  if (duration == 0) {
    Serial.println("⚠️ Sensor pulse timeout - checking wiring...");
    distanceCm = 150.0; // Default safe baseline if unread
  }

  Serial.print("📡 Water Surface Clearance: ");
  Serial.print(distanceCm);
  Serial.println(" cm");

  // 2. Evaluate Flood Emergency Status
  bool floodAlert = (distanceCm > 0 && distanceCm < FLOOD_THRESHOLD_CM);
  String statusStr = floodAlert ? "CRITICAL_FLOOD_ALARM" : "NOMINAL";

  if (floodAlert) {
    Serial.println("🚨 EMERGENCY FLOOD WARNING: Water distance below 15 cm!");
  }

  // 3. Transmit Realtime JSON Telemetry Payload to SynthCity Engine
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // Skip TLS certificate check for prototype testing
    HTTPClient http;

    http.begin(client, firebaseUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{";
    jsonPayload += "\"sensor_id\":\"esp01_nagriver_bridge\",";
    jsonPayload += "\"location\":\"Nag River Kamptee Bridge (Zone 1)\",";
    jsonPayload += "\"distance_cm\":" + String(distanceCm) + ",";
    jsonPayload += "\"flood_alert\":" + String(floodAlert ? "true" : "false") + ",";
    jsonPayload += "\"status\":\"" + statusStr + "\",";
    jsonPayload += "\"timestamp\":" + String(millis());
    jsonPayload += "}";

    int httpResponseCode = http.PUT(jsonPayload);
    Serial.print("📡 Firebase Telemetry HTTP Response: ");
    Serial.println(httpResponseCode);

    http.end();
  }

  // Poll every 5 seconds
  delay(5000);
}
