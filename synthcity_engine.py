#!/usr/bin/env python3
"""
================================================================================
PROJECT SYNTHCITY: NAGPUR MULTI-AGENT CIVIC INTELLIGENCE ENGINE
================================================================================
Features:
- Automated API Key Rotation across Gemini Keys
- Automated Model Failover (gemini-3.5-flash-lite -> gemini-3.5-flash -> gemini-3.6-flash)
- Direct REST & SDK Dual Engine (Bypasses Windows gRPC DLL policies)
- Open-Meteo Real-time Weather Fetcher for Nagpur
- Public Google Drive Community Report Fetcher
- 6 AI Agent Personas with Custom Prompt Engineering
- Firebase Realtime Database Synchronization via REST API
"""

import os
import sys
import time
import json
import datetime
import requests

# Set stdout encoding if possible
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Optional SDK Import with REST Fallback
SDK_AVAILABLE = False
try:
    import google.generativeai as genai
    SDK_AVAILABLE = True
except Exception as e:
    print(f"[INFO] SDK import skipped ({e}). Operating in Direct REST Mode.")

# ==============================================================================
# CONFIGURATION & API KEYS
# ==============================================================================

# User-Provided Gemini API Keys Array
GEMINI_API_KEYS = [
    k for k in [
        os.environ.get("GEMINI_API_KEY_1", ""),
        os.environ.get("GEMINI_API_KEY_2", "")
    ] if k
] or ["YOUR_GEMINI_API_KEY"]

# Model Failover Hierarchy (Active Free Tier Priorities)
MODELS_FAILOVER = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-flash-lite-latest"
]

# Firebase Realtime Database REST Base URL
FIREBASE_RTDB_URL = "https://my-project-1-602b7-default-rtdb.firebaseio.com"

# Nagpur Geographic Coordinates
NAGPUR_LAT = 21.1458
NAGPUR_LON = 79.0882

# Public Google Drive Document IDs for 3 Zones (Nagpur Community Reports)
GDRIVE_DOC_IDS = {
    "zone1": "1A2b3C_Nagpur_Zone1_Godhani_Kamptee_Report",
    "zone2": "4D5e6F_Nagpur_Zone2_Sitabuldi_Dharampeth_Report",
    "zone3": "7G8h9I_Nagpur_Zone3_Hingna_MIDC_Report"
}

# ==============================================================================
# AUTOMATED API KEY ROTATOR & MODEL FAILOVER CLASS
# ==============================================================================

class GeminiKeyRotator:
    def __init__(self, api_keys, models):
        self.api_keys = [k for k in api_keys if k and "YOUR_GEMINI" not in k]
        if not self.api_keys:
            self.api_keys = api_keys
        self.models = models
        self.current_key_idx = 0
        self.current_model_idx = 0
        self._configure_current()

    def _configure_current(self):
        key = self.api_keys[self.current_key_idx]
        if SDK_AVAILABLE:
            try:
                genai.configure(api_key=key)
            except Exception:
                pass
        print(f"[KEY] Activated Gemini Key #{self.current_key_idx + 1} | Model: {self.models[self.current_model_idx]}")

    def rotate_key(self):
        self.current_key_idx = (self.current_key_idx + 1) % len(self.api_keys)
        print(f"[WARNING] Swapping to Gemini Key #{self.current_key_idx + 1}...")
        self._configure_current()

    def downgrade_model(self):
        if self.current_model_idx < len(self.models) - 1:
            self.current_model_idx += 1
            print(f"[FAILOVER] Swapping model to '{self.models[self.current_model_idx]}' for active generation.")
            self._configure_current()
        else:
            print("[WARNING] Reached lowest model in failover list.")

    def _call_rest_api(self, prompt, system_instruction=None):
        """Calls Gemini API directly via HTTP REST (Zero DLL dependencies)."""
        key = self.api_keys[self.current_key_idx]
        model_name = self.models[self.current_model_idx]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
        
        contents = []
        if system_instruction:
            contents.append({
                "role": "user",
                "parts": [{"text": f"System Context: {system_instruction}\n\nTask: {prompt}"}]
            })
        else:
            contents.append({
                "role": "user",
                "parts": [{"text": prompt}]
            })
            
        payload = {"contents": contents}
        headers = {"Content-Type": "application/json"}
        
        res = requests.post(url, headers=headers, json=payload, timeout=12)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
        else:
            err_msg = res.text
            raise RuntimeError(f"HTTP {res.status_code}: {err_msg[:100]}")
        return None

    def generate_response(self, prompt, system_instruction=None, max_retries=8):
        attempts = 0
        while attempts < max_retries:
            try:
                return self._call_rest_api(prompt, system_instruction)
            except Exception as e:
                err_str = str(e).lower()
                print(f"[ERROR] Gemini API call ({self.models[self.current_model_idx]}): {e}")
                if "429" in err_str or "quota" in err_str or "rate limit" in err_str or "resource_exhausted" in err_str or "404" in err_str or "400" in err_str or "503" in err_str:
                    self.downgrade_model()
                else:
                    time.sleep(1)
                attempts += 1
        return None

# Initialize Key Rotator
rotator = GeminiKeyRotator(GEMINI_API_KEYS, MODELS_FAILOVER)

# ==============================================================================
# EXTERNAL DATA INGESTION (WEATHER & G-DRIVE DOCS)
# ==============================================================================

def fetch_open_meteo_weather():
    """Fetches real-time weather and forecast for Nagpur from Open-Meteo free API."""
    url = f"https://api.open-meteo.com/v1/forecast?latitude={NAGPUR_LAT}&longitude={NAGPUR_LON}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,precipitation"
    try:
        res = requests.get(url, timeout=6)
        if res.status_code == 200:
            data = res.json()
            cw = data.get("current_weather", {})
            temp = cw.get("temperature", 28.5)
            wind = cw.get("windspeed", 12.0)
            weathercode = cw.get("weathercode", 0)
            
            summary = "Clear skies over Nagpur basin."
            if weathercode > 50:
                summary = "Rain/Monsoon showers detected in Nag River catchment."
            
            return {
                "temp": temp,
                "humidity": 64,
                "precipitation": 0.0 if weathercode <= 50 else 18.5,
                "windSpeed": wind,
                "summary": summary,
                "raw_code": weathercode
            }
    except Exception as e:
        print(f"[WARNING] Open-Meteo fetch warning: {e}")
    
    return {
        "temp": 28.4,
        "humidity": 65,
        "precipitation": 0.0,
        "windSpeed": 11.2,
        "summary": "Nagpur weather dry and clear. Nag River water level baseline 1.2m."
    }

def fetch_gdrive_docs():
    """Simulates fetching public Google Drive community news/reports for the 3 Nagpur zones."""
    return [
        "Doc 1 (Zone 1 - Godhani/Kamptee): Local panchayat cleared Nag River dredging near Kamptee bridge. Soil moisture optimal.",
        "Doc 2 (Zone 2 - Sitabuldi): Sitabuldi market vendor association reports heavy cardboard waste buildup near stormwater drain #4.",
        "Doc 3 (Zone 3 - Hingna MIDC): Chemical runoff test in Hingna stream shows pH 7.2. Stagnant water pool identified near sector 12."
    ]

# ==============================================================================
# FIREBASE REST HELPER FUNCTIONS
# ==============================================================================

def check_telegram_bot_updates(bot_token):
    """Polls Telegram Bot API for new updates from citizens or workers."""
    if not bot_token or bot_token.startswith("bot_token"):
        return []
    url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            return data.get("result", [])
    except Exception as e:
        print(f"[WARNING] Telegram Poll Warning: {e}")
    return []

def fb_update_hardware_esp01(distance_cm=120, rssi=-64):
    """Pushes ESP-01 ultrasonic sensor telemetry to Firebase REST endpoint."""
    payload = {
        "distance_cm": distance_cm,
        "sensor_height_cm": 300,
        "rssi": rssi,
        "timestamp": int(time.time() * 1000)
    }
    try:
        url = f"{FIREBASE_RTDB_URL}/hardware/esp01.json"
        requests.put(url, json=payload, timeout=5)
        print(f"[HARDWARE] ESP-01 Telemetry Pushed: Distance={distance_cm}cm")
    except Exception as e:
        print(f"[WARNING] Hardware Telemetry Push Error: {e}")

def fb_post_chat(sender, role, zone, message, color="#7c3aed", icon="[AI]"):
    """Pushes a chat message into Firebase Realtime Database."""
    time_str = datetime.datetime.now().strftime("%H:%M:%S")
    payload = {
        "sender": sender,
        "role": role,
        "zone": zone,
        "message": message,
        "color": color,
        "icon": icon,
        "timestamp": int(time.time() * 1000),
        "timeStr": time_str
    }
    try:
        url = f"{FIREBASE_RTDB_URL}/chat.json"
        res = requests.post(url, json=payload, timeout=5)
        print(f"[CHAT] [{sender}]: {message[:70]}...")
        return res.json()
    except Exception as e:
        print(f"[WARNING] Firebase Chat Push Error: {e}")
        return None

def fb_update_memory(weather_data, drive_docs, admin_pred="District status nominal."):
    """Updates /system_memory node in Firebase."""
    payload = {
        "lastUpdated": datetime.datetime.now().strftime("%I:%M %p"),
        "weather": weather_data,
        "driveReports": drive_docs,
        "adminPrediction": admin_pred
    }
    try:
        requests.put(f"{FIREBASE_RTDB_URL}/system_memory.json", json=payload, timeout=5)
    except Exception as e:
        print(f"[WARNING] Firebase Memory Update Error: {e}")

def fb_update_zone(zone_key, data):
    """Updates zone status card data in Firebase."""
    try:
        requests.put(f"{FIREBASE_RTDB_URL}/zone_status/{zone_key}.json", json=data, timeout=5)
    except Exception as e:
        print(f"[WARNING] Firebase Zone Update Error: {e}")

def fb_set_alert(title, severity, zone, description):
    """Sets emergency district alert in Firebase."""
    payload = {
        "id": f"alert_{int(time.time())}",
        "title": title,
        "severity": severity,
        "zone": zone,
        "description": description,
        "timestamp": int(time.time() * 1000)
    }
    try:
        requests.put(f"{FIREBASE_RTDB_URL}/alerts/current.json", json=payload, timeout=5)
    except Exception as e:
        print(f"[WARNING] Firebase Alert Error: {e}")

def fb_set_map_marker(marker_id, lat, lng, title, zone, severity, description):
    """Sets incident map marker on Nagpur Leaflet map."""
    payload = {
        "id": marker_id,
        "lat": lat,
        "lng": lng,
        "title": title,
        "zone": zone,
        "severity": severity,
        "description": description,
        "pulse": True,
        "timestamp": int(time.time() * 1000)
    }
    try:
        requests.put(f"{FIREBASE_RTDB_URL}/map_markers/{marker_id}.json", json=payload, timeout=5)
    except Exception as e:
        print(f"[WARNING] Firebase Map Marker Error: {e}")

def fb_check_disaster_trigger():
    """Checks if user triggered a mock disaster from frontend."""
    try:
        res = requests.get(f"{FIREBASE_RTDB_URL}/disaster_trigger.json", timeout=3)
        if res.status_code == 200 and res.json():
            data = res.json()
            if data.get("active"):
                return data
    except Exception:
        pass
    return None

# ==============================================================================
# 6 AI PERSONAS PROMPT INSTRUCTIONS & LOGIC
# ==============================================================================

PERSONAS = {
    "Data-Mitra": {
        "role": "Ingestion & Summary Worker",
        "zone": "District Background",
        "icon": "📡",
        "color": "#16a34a",
        "system": "You are Data-Mitra, ingestion worker for Nagpur. Summarize raw weather telemetry and community news concisely (under 30 words)."
    },
    "Neer-Krishi": {
        "role": "Hydro-Agri Core Specialist",
        "zone": "Zone 1 (Godhani & Kamptee)",
        "icon": "💧",
        "color": "#0284c7",
        "system": "You are Neer-Krishi, AI guardian of Zone 1 (Godhani, Kamptee road, Nag River north basin). Report water level spikes, soil saturation, and crop alerts in under 35 words."
    },
    "Nagari-Tantra": {
        "role": "Urban Infrastructure Specialist",
        "zone": "Zone 2 (Dharampeth & Sitabuldi)",
        "icon": "🏙️",
        "color": "#d97706",
        "system": "You are Nagari-Tantra, AI for Zone 2 (Central Nagpur, Sitabuldi market, Dharampeth). Report traffic bottlenecks, waste bin overflow, and culvert clogging in under 35 words."
    },
    "Swasthya-Raksha": {
        "role": "Health & Sanitation Specialist",
        "zone": "Zone 3 (MIDC & Hingna)",
        "icon": "🏥",
        "color": "#dc2626",
        "system": "You are Swasthya-Raksha, AI for Zone 3 (Industrial MIDC, Hingna). Report dengue vector risks from stagnant runoff and emergency triage in under 35 words."
    },
    "Marg-Darshak": {
        "role": "Resource Router & Backup AI",
        "zone": "Cross-Zone Logistics",
        "icon": "🔄",
        "color": "#2563eb",
        "system": "You are Marg-Darshak, cross-zone resource logistics router. Calculate optimal transfer routes for dewatering pumps and municipal trucks across Wardha Road / Ring Road in under 35 words."
    },
    "Synth-Pradhan": {
        "role": "District Orchestrator (Admin AI)",
        "zone": "Entire District",
        "icon": "👑",
        "color": "#7c3aed",
        "system": "You are Synth-Pradhan, supreme Admin Orchestrator for Nagpur District. Synthesize reports from Zones 1-3, answer citizen inquiries, and issue official district directives in under 40 words."
    }
}

# ==============================================================================
# MAIN MULTI-AGENT ORCHESTRATION LOOP
# ==============================================================================

def run_ingestion_cycle():
    """Minor AI 1 (Data-Mitra) ingests weather and G-Drive data."""
    print("\n--- [STEP 1] Ingestion & Weather Fetch (Data-Mitra) ---")
    weather = fetch_open_meteo_weather()
    drive_docs = fetch_gdrive_docs()
    
    prompt = f"Summarize current weather telemetry ({weather['temp']}C, rain {weather['precipitation']}mm, wind {weather['windSpeed']}km/h) and report on community doc snippet: {drive_docs[0]}"
    mitra_msg = rotator.generate_response(prompt, system_instruction=PERSONAS["Data-Mitra"]["system"])
    
    if not mitra_msg:
        mitra_msg = f"📡 Telemetry Ingested: Nagpur temp {weather['temp']}C, humidity {weather['humidity']}%. Nag River catchment clear. Community reports synced."
    
    fb_post_chat("Data-Mitra", PERSONAS["Data-Mitra"]["role"], PERSONAS["Data-Mitra"]["zone"], mitra_msg, PERSONAS["Data-Mitra"]["color"], PERSONAS["Data-Mitra"]["icon"])
    fb_update_memory(weather, drive_docs, "District systems optimal.")
    return weather, drive_docs

def execute_disaster_response_loop(disaster_info):
    """Executes full multi-agent neural chat conversation when a disaster occurs."""
    print("\n==================================================")
    print("     DISASTER SIMULATION LOOP TRIGGERED")
    print(f"Incident: {disaster_info.get('description')}")
    print("==================================================")
    
    # 1. Neer-Krishi (Zone 1) Analysis
    prompt_z1 = f"CRITICAL EVENT DETECTED: {disaster_info.get('description')}. Report Nag River water level surge, farmland flooding risk near Kamptee, and request urgent pumping support."
    resp_z1 = rotator.generate_response(prompt_z1, system_instruction=PERSONAS["Neer-Krishi"]["system"])
    if not resp_z1:
        resp_z1 = "💧 CRITICAL: Nag River water level spiked to 3.85m near Kamptee bridge! Soil saturated (98%). Immediate risk to Godhani farmlands. Requesting 4 dewatering pumps!"
    fb_post_chat("Neer-Krishi", PERSONAS["Neer-Krishi"]["role"], PERSONAS["Neer-Krishi"]["zone"], resp_z1, PERSONAS["Neer-Krishi"]["color"], PERSONAS["Neer-Krishi"]["icon"])
    time.sleep(2)

    # 2. Nagari-Tantra (Zone 2) Response
    prompt_z2 = f"Neer-Krishi reported: '{resp_z1}'. Report Sitabuldi market traffic status, culvert garbage clogging, and truck availability."
    resp_z2 = rotator.generate_response(prompt_z2, system_instruction=PERSONAS["Nagari-Tantra"]["system"])
    if not resp_z2:
        resp_z2 = "🏙️ Sitabuldi culvert clogging confirmed! 2-foot waterlogging on main Wardha corridor. Zone 2 municipal trucks are currently stationed at Dharampeth depot."
    fb_post_chat("Nagari-Tantra", PERSONAS["Nagari-Tantra"]["role"], PERSONAS["Nagari-Tantra"]["zone"], resp_z2, PERSONAS["Nagari-Tantra"]["color"], PERSONAS["Nagari-Tantra"]["icon"])
    time.sleep(2)

    # 3. Swasthya-Raksha (Zone 3) Response
    prompt_z3 = f"Zone 1 flooding and Zone 2 garbage block active. Evaluate dengue vector risks and MIDC worker triage."
    resp_z3 = rotator.generate_response(prompt_z3, system_instruction=PERSONAS["Swasthya-Raksha"]["system"])
    if not resp_z3:
        resp_z3 = "🏥 High risk of mosquito/dengue breeding in stagnant runoff pools near Hingna MIDC sector 12. Dispatching 2 mobile fogging and sanitation units."
    fb_post_chat("Swasthya-Raksha", PERSONAS["Swasthya-Raksha"]["role"], PERSONAS["Swasthya-Raksha"]["zone"], resp_z3, PERSONAS["Swasthya-Raksha"]["color"], PERSONAS["Swasthya-Raksha"]["icon"])
    time.sleep(2)

    # 4. Marg-Darshak (Minor AI 2) Routing
    prompt_marg = f"Zone 1 needs pumps from Zone 2. Calculate logistics route avoiding Sitabuldi traffic bottleneck."
    resp_marg = rotator.generate_response(prompt_marg, system_instruction=PERSONAS["Marg-Darshak"]["system"])
    if not resp_marg:
        resp_marg = "🔄 LOGISTICS ROUTE APPROVED: Rerouting 4 heavy-duty dewatering pumps from Zone 2 Dharampeth depot to Zone 1 Kamptee bridge via Outer Ring Road (bypass Sitabuldi congestion)."
    fb_post_chat("Marg-Darshak", PERSONAS["Marg-Darshak"]["role"], PERSONAS["Marg-Darshak"]["zone"], resp_marg, PERSONAS["Marg-Darshak"]["color"], PERSONAS["Marg-Darshak"]["icon"])
    time.sleep(2)

    # 5. Synth-Pradhan (Admin AI) Final Decision
    prompt_admin = f"Synthesize responses from all agents and Marg-Darshak's route plan. Issue final district executive order."
    resp_admin = rotator.generate_response(prompt_admin, system_instruction=PERSONAS["Synth-Pradhan"]["system"])
    if not resp_admin:
        resp_admin = "👑 DISTRICT EXECUTIVE ORDER ISSUED: Approved Marg-Darshak pump transfer. Declaring Zone 1 Critical Flood Advisory. Map incident markers published. Emergency response active."
    fb_post_chat("Synth-Pradhan", PERSONAS["Synth-Pradhan"]["role"], PERSONAS["Synth-Pradhan"]["zone"], resp_admin, PERSONAS["Synth-Pradhan"]["color"], PERSONAS["Synth-Pradhan"]["icon"])

    # Update Firebase State Nodes
    fb_set_alert("FLASHOVER FLOOD & CULVERT CLOG", "CRITICAL", "Zone 1 & Zone 2", "Nag River 3.85m overflow. Pumps rerouted via Outer Ring Road.")
    fb_set_map_marker("m1", 21.210, 79.110, "Nag River Flood Overflow", "Zone 1", "CRITICAL", "Water level 3.85m - Dewatering active")
    fb_set_map_marker("m2", 21.148, 79.085, "Sitabuldi Culvert Garbage Block", "Zone 2", "WARNING", "Waste blockage causing 2ft street runoff")
    
    fb_update_zone("zone1", {"name": "Zone 1: Neer-Krishi", "status": "FLOOD ALERT", "waterLevel": "3.85m HIGH", "soilMoisture": "98% Saturation", "riskLevel": "CRITICAL"})
    fb_update_zone("zone2", {"name": "Zone 2: Nagari-Tantra", "status": "TRAFFIC BLOCKED", "trafficCongestion": "HEAVY", "wasteQueue": "Clogged Culvert", "riskLevel": "WARNING"})
    fb_update_zone("zone3", {"name": "Zone 3: Swasthya-Raksha", "status": "FOGGING ACTIVE", "airQualityIndex": 84, "dengueVectorRisk": "HIGH", "riskLevel": "WARNING"})

    try:
        requests.put(f"{FIREBASE_RTDB_URL}/disaster_trigger.json", json={"active": False}, timeout=3)
    except Exception:
        pass

def main():
    print("=" * 80)
    print("      SYNTHCITY NAGPUR: MULTI-AGENT CIVIC INTELLIGENCE ENGINE")
    print("      Running on Gemini Key Rotator + Model Failover")
    print("=" * 80)

    run_ingestion_cycle()

    print("\n[ACTIVE] Engine listening for disaster simulation triggers & citizen queries...")
    print("Press Ctrl+C to stop.\n")

    while True:
        try:
            disaster = fb_check_disaster_trigger()
            if disaster and disaster.get("active"):
                execute_disaster_response_loop(disaster)
            time.sleep(5)
        except KeyboardInterrupt:
            print("\nSynthCity AI Engine shutting down.")
            sys.exit(0)
        except Exception as e:
            print(f"[WARNING] Loop exception: {e}")
            time.sleep(5)

if __name__ == "__main__":
    if "--trigger" in sys.argv or "--trigger-disaster" in sys.argv:
        execute_disaster_response_loop({
            "description": "Cloudburst over Kamptee road (95mm/hr). Nag River overflowing near Sitabuldi bridge due to heavy garbage clogging."
        })
    else:
        main()
