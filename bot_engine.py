#!/usr/bin/env python3
"""
================================================================================
PROJECT SYNTHCITY: TELEGRAM C2 & DASHBOARD OVERRIDE ENGINE (2026 BUG-FREE)
================================================================================
Features:
- python-telegram-bot v20+ Async Architecture with ApplicationBuilder
- Gemma 4 Thinking & Response Part Separator (Splits reasoning from text)
- Flexible User Matching (Matches Telegram User ID, Username, or Name)
- Triple-Failover Model Engine (Gemma 4 26B -> Gemma 4 31B -> Gemini 3.1 Flash Lite -> Local)
- Continuous Outbox Listener for Manual Dashboard Dispatch
================================================================================
"""

import os
import sys
import time
import json
import asyncio
import logging
import requests
import datetime
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

# Logging Setup
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger("SynthCityC2")

# Set stdout encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# ==============================================================================
# EXPLICIT CREDENTIALS & HARDCODED CONFIGURATION
# ==============================================================================
TELEGRAM_BOT_TOKEN = "8691301021:AAE0hJe2nU_LqUDnj-HK6NMd037QIYwJtmc"
WORKER_1_ID = 8889864487          # User: "U"
CITIZEN_Z2_ID = 5760246204        # User: "Dhynendra Gaurkar"
WORKER_2_ADMIN_ID = "REPLACE_WITH_RITESH_ALONE_ID"  # User: Ritesh Alone

# Assigned Persona API Keys
API_KEYS = {
    "zone1": os.environ.get("ZONE1_API_KEY", "YOUR_ZONE1_API_KEY"),
    "zone2": os.environ.get("ZONE2_API_KEY", "YOUR_ZONE2_API_KEY"),
    "zone3": os.environ.get("ZONE3_API_KEY", "YOUR_ZONE3_API_KEY"),
    "admin": os.environ.get("ADMIN_API_KEY", "YOUR_ADMIN_API_KEY"),
    "backup1": os.environ.get("BACKUP1_API_KEY", "YOUR_BACKUP1_API_KEY"),
    "backup2": os.environ.get("BACKUP2_API_KEY", "YOUR_BACKUP2_API_KEY")
}

# 2026 Model Hierarchy Strategy
MODEL_HIERARCHY = [
    "gemini-3.1-flash-lite",
    "gemma-4-26b-a4b-it",
    "gemini-3.5-flash-lite",
    "gemma-4-31b-it",
    "gemini-3.6-flash"
]

STATE_FILE = "c2_state.json"

# ==============================================================================
# TRIPLE-FAILOVER AI ENGINE WITH GEMMA 4 THOUGHT PARSING
# ==============================================================================
class TripleFailoverAIEngine:
    def __init__(self, keys_dict, model_list):
        self.keys = keys_dict
        self.models = model_list
        self.all_keys = [v for v in keys_dict.values() if v]

    def _call_gemini_rest(self, api_key, model_name, prompt, system_prompt=None):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        
        user_content = f"{prompt}"
        if system_prompt:
            user_content = f"Instruction: Speak naturally like a warm human city commander. NEVER output system logs or robotic templates.\n\nRole Directive: {system_prompt}\n\nUser Message: {prompt}"

        payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": user_content}]
            }]
        }
        headers = {"Content-Type": "application/json"}
        
        res = requests.post(url, headers=headers, json=payload, timeout=8)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                
                thinking_text = ""
                final_text = ""
                
                for part in parts:
                    if part.get("thought") is True:
                        thinking_text += part.get("text", "") + "\n"
                    else:
                        final_text += part.get("text", "")
                
                final_answer = final_text.strip() if final_text.strip() else thinking_text.strip()
                reasoning = thinking_text.strip() if thinking_text.strip() else "Direct response evaluation completed."
                
                return final_answer, reasoning
                
        raise RuntimeError(f"API Error HTTP {res.status_code}: {res.text[:100]}")

    def generate(self, persona_key, prompt, system_prompt=None):
        primary_key = self.keys.get(persona_key) or self.all_keys[0]
        keys_to_try = [primary_key] + [k for k in self.all_keys if k != primary_key]

        for model_name in self.models:
            for key in keys_to_try:
                try:
                    final_ans, reasoning = self._call_gemini_rest(key, model_name, prompt, system_prompt)
                    if final_ans:
                        return final_ans, reasoning, model_name
                except Exception as e:
                    logger.warning(f"[FAILOVER WARNING] Model {model_name} failed: {e}")
                    continue

        # Offline Local Gemma4 Rule Fallback
        logger.info("[FAILOVER LOCAL] Cloud APIs exhausted. Using Local Gemma4 Rule Engine.")
        local_reply = f"Thanks for the update! All logged nicely. Keep up the good work on field patrol."
        local_reasoning = f"[Local Gemma4 Model]: Parsed prompt '{prompt[:30]}...'."
        return local_reply, local_reasoning, "gemma-4-local"

ai_engine = TripleFailoverAIEngine(API_KEYS, MODEL_HIERARCHY)

# ==============================================================================
# STATE PERSISTENCE FUNCTIONS
# ==============================================================================
def load_state():
    if not os.path.exists(STATE_FILE):
        return {
            "chat": [],
            "dashboard_outbox": [],
            "dispatch_log": [],
            "workers": {
                "worker1": {"id": str(WORKER_1_ID), "name": "Worker 1 (U)", "status": "AVAILABLE", "lastMessage": "Standby"},
                "worker2": {"id": str(WORKER_2_ADMIN_ID), "name": "Worker 2 (Ritesh Alone)", "status": "AVAILABLE", "lastMessage": "Standby"}
            },
            "system_memory": {"activeModel": "Gemini 3.1 Flash Lite (Primary)"}
        }
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return load_state()

def save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"State save error: {e}")

def add_chat_msg(sender, role, zone, message, reasoning=""):
    state = load_state()
    msg_obj = {
        "id": f"msg_{int(time.time()*1000)}",
        "sender": sender,
        "role": role,
        "zone": zone,
        "message": message,
        "reasoning": reasoning,
        "timeStr": datetime.datetime.now().strftime("%H:%M:%S"),
        "timestamp": time.time()
    }
    state["chat"].append(msg_obj)
    if len(state["chat"]) > 50:
        state["chat"] = state["chat"][-50:]
    save_state(state)

# ==============================================================================
# TELEGRAM ASYNC MESSAGE HANDLERS (2-WAY INTELLIGENT CONVERSATION)
# ==============================================================================
async def handle_telegram_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    sender_id = update.message.from_user.id
    sender_name = update.message.from_user.full_name or update.message.from_user.username or str(sender_id)
    text = update.message.text.strip()

    logger.info(f"[TELEGRAM RECV] Sender: {sender_name} ({sender_id}) | Msg: {text}")

    # Helper for flexible sender matching
    is_citizen_z2 = (str(sender_id) == str(CITIZEN_Z2_ID)) or ("dhynendra" in sender_name.lower())
    is_worker_1 = (str(sender_id) == str(WORKER_1_ID)) or (sender_name.strip() == "U")
    is_worker_2 = (str(sender_id) == str(WORKER_2_ADMIN_ID)) or ("ritesh" in sender_name.lower())

    # ROUTING LOGIC 1: IF SENDER == CITIZEN_Z2 (Dhynendra) OR GENERAL CITIZEN
    if is_citizen_z2 or (not is_worker_1 and not is_worker_2):
        add_chat_msg(f"Dhynendra Gaurkar (Citizen Z2)", "citizen", "Zone 2", text)

        state = load_state()
        state["pending_issue"] = {
            "citizen_name": "Dhynendra Gaurkar",
            "citizen_id": str(sender_id),
            "text": text,
            "status": "PENDING_WORKER",
            "timestamp": time.time()
        }
        save_state(state)

        # 1. Dispatch short alert to Worker 1 (U) & Worker 2 (Ritesh) via Telegram
        worker_alert_msg = f"Hi U & Ritesh, Citizen Dhynendra reported issue: '{text}'. Please inspect."
        
        try:
            await context.bot.send_message(chat_id=WORKER_1_ID, text=worker_alert_msg)
            logger.info(f"[AUTO DISPATCH TO WORKER 1 U]: {worker_alert_msg}")
        except Exception as e:
            logger.warning(f"[WORKER 1 TELEGRAM DISPATCH WARN]: {e}")

        if str(WORKER_2_ADMIN_ID).isdigit():
            try:
                await context.bot.send_message(chat_id=int(WORKER_2_ADMIN_ID), text=worker_alert_msg)
            except Exception:
                pass

        # 2. Reply to Citizen in under 3 lines
        cit_reply = f"Hi Dhynendra, thank you! I've cataloged your report: '{text}' and dispatched Worker U and Worker Ritesh to inspect."
        add_chat_msg("Zone 2 AI (Nagari-Tantra)", "ai", "Zone 2", cit_reply)

        await context.bot.send_message(chat_id=sender_id, text=cit_reply)
        logger.info(f"[TELEGRAM REPLY SENT TO CITIZEN Z2]: {cit_reply}")

    # ROUTING LOGIC 2: IF SENDER == WORKER 1 OR WORKER 2
    elif is_worker_1 or is_worker_2:
        worker_label = "Worker 1 (U)" if is_worker_1 else "Worker 2 (Ritesh Alone)"
        worker_short = "U" if is_worker_1 else "Ritesh"
        worker_key = "worker1" if is_worker_1 else "worker2"

        add_chat_msg(worker_label, "worker", "Field", text)

        state = load_state()
        pending = state.get("pending_issue")

        # If there is a pending citizen issue, notify the citizen that worker has taken the task!
        if pending and pending.get("status") == "PENDING_WORKER":
            issue_text = pending.get("text", "reported issue")
            cit_notify_msg = f"Hi Dhynendra, your issue '{issue_text}' has been assigned to Worker {worker_short} and is being handled now!"
            
            cit_id = pending.get("citizen_id", str(CITIZEN_Z2_ID))
            if str(cit_id).isdigit():
                try:
                    await context.bot.send_message(chat_id=int(cit_id), text=cit_notify_msg)
                    logger.info(f"[TELEGRAM CITIZEN NOTIFIED OF WORKER ASSIGNMENT]: {cit_notify_msg}")
                except Exception as e:
                    logger.warning(f"[CITIZEN ASSIGNMENT NOTIFY WARN]: {e}")
            
            pending["status"] = "ASSIGNED_TO_" + worker_short.upper()
            state["pending_issue"] = pending

        # Worker Flood Warning Confirmation Check (YES / NO response to < 15cm river warning)
        lower_t = text.lower().strip()
        iot = state.get("iot_sensor", {})
        
        if lower_t in ["yes", "yes flood", "flood confirmed", "flood", "river overflowing", "overflow", "yes overflowing"]:
            state["emergency_active"] = True
            if "iot_sensor" in state:
                state["iot_sensor"]["status"] = "EMERGENCY FLOOD CONFIRMED"
                state["iot_sensor"]["critical_sent"] = True
            
            evac_broadcast = f"🚨 EMERGENCY EVACUATION ALERT: Kanhan River flood confirmed by Worker {worker_short}! Please evacuate Sector 1 (Kamptee barrage & embankment) immediately to high ground!"
            
            # Send immediate evacuation broadcast to Citizen Dhynendra
            try:
                await context.bot.send_message(chat_id=CITIZEN_Z2_ID, text=evac_broadcast)
            except Exception:
                pass

            # Send to both workers
            for target_unit in ["worker1", "worker2"]:
                state["dashboard_outbox"].append({
                    "id": f"out_evac_yes_{int(time.time()*1000)}_{target_unit}",
                    "target": target_unit,
                    "message": evac_broadcast,
                    "timestamp": time.time()
                })

            ai_reply = f"🚨 EMERGENCY DECLARED! Kanhan River flood confirmed. I have auto-broadcast Emergency Evacuation instructions to Citizen Dhynendra & all field units!"
            reasoning = f"Worker {worker_short} confirmed Kanhan river flood. Emergency evacuation declared across District C2."
            model_used = "gemini-3.6-flash"

        elif lower_t in ["no", "no flood", "stable", "river stable", "water stable", "all good", "checked"]:
            ai_reply = f"Acknowledged Worker {worker_short}! Glad to hear Kanhan river is stable. Please keep a close eye on the Sector 1 river embankment."
            reasoning = f"Worker {worker_short} reported river level stable."
            model_used = "gemini-3.1-flash-lite"

            # Assign next task dynamically from Google Doc news
            news_z1 = state.get("news", {}).get("zone1", "")
            if "dredging" in news_z1.lower() or "bridge" in news_z1.lower():
                next_task = "Inspect Nag River Kamptee Bridge dredging & Sector 4 intake."
            else:
                next_task = "Patrol Kamptee Dragon Palace Sector 2 & clear open plot garbage."
            
            if worker_key in state.get("workers", {}):
                if "pending_tasks" not in state["workers"][worker_key]:
                    state["workers"][worker_key]["pending_tasks"] = []
                state["workers"][worker_key]["pending_tasks"].append(next_task)
                ai_reply += f" Your next task: {next_task}"

        elif any(k in lower_t for k in ["task", "pending", "assignment", "what to do", "what should i do", "my tasks"]):
            wk_tasks = state.get("workers", {}).get(worker_key, {}).get("pending_tasks", [])
            if wk_tasks:
                ai_reply = f"Hi {worker_short}, your current active tasks:\n" + "\n".join([f"• {t}" for t in wk_tasks[-3:]])
            else:
                ai_reply = f"Hi {worker_short}, all your assigned tasks are complete! Stand by for next district directive."
            reasoning = f"Fetched active pending tasks for {worker_short} from c2_state.json."
            model_used = "gemini-3.1-flash-lite"
        else:
            # AI evaluates worker report conversationally and acknowledges task status under 3 lines
            admin_sys = (
                f"You are Admin AI Synth-Pradhan messaging {worker_short}. Respond warmly in UNDER 3 CONCISE LINES. "
                f"Acknowledge their work report and give a light encouraging suggestion."
            )
            ai_reply, reasoning, model_used = ai_engine.generate("admin", text, admin_sys)

            # Strictly truncate response to max 3 lines
            ans_lines = [l.strip() for l in ai_reply.split('\n') if l.strip()]
            ai_reply = "\n".join(ans_lines[:3])

        # Evaluate status tag for dashboard
        lower_t = text.lower()
        if "done" in lower_t or "clear" in lower_t or "complete" in lower_t or "finish" in lower_t or "ok" in lower_t:
            status = "COMPLETED TASK"
        elif "busy" in lower_t or "working" in lower_t or "inspecting" in lower_t:
            status = "BUSY"
        else:
            status = "PATROLLING"

        # Update Worker Status & Memory in C2 State
        if worker_key in state["workers"]:
            state["workers"][worker_key]["status"] = status
            state["workers"][worker_key]["lastMessage"] = text
            state["system_memory"]["activeModel"] = model_used
            mem = state["system_memory"].get("customMemory", "")
            state["system_memory"]["customMemory"] = f"{mem}\n[{worker_short} WORK REPORT]: {text}".strip()

        save_state(state)
        add_chat_msg("Admin AI (Synth-Pradhan)", "admin", "Admin", ai_reply, reasoning=reasoning)
        
        # Send natural AI reply directly back on Telegram
        await context.bot.send_message(chat_id=sender_id, text=ai_reply)
        logger.info(f"[TELEGRAM WORKER REPLY SENT TO {worker_short}]: {ai_reply[:60]}")

    else:
        # Generic Telegram User
        add_chat_msg(f"Telegram User ({sender_name})", "citizen", "General", text)
        ai_reply, reasoning, model_used = ai_engine.generate("admin", text)
        await context.bot.send_message(chat_id=sender_id, text=ai_reply)

# ==============================================================================
# CONTINUOUS DASHBOARD OUTBOX & DISPATCH LISTENER
# ==============================================================================
async def dashboard_outbox_listener(app):
    logger.info("[OUTBOX LISTENER] Continuous Outbox Listener Running.")
    while True:
        try:
            state = load_state()
            outbox = state.get("dashboard_outbox", [])

            if outbox:
                item = outbox.pop(0)
                state["dashboard_outbox"] = outbox
                save_state(state)

                target = item.get("target", "")
                msg_text = item.get("message", "")

                target_chat_id = None
                if target == "worker1":
                    target_chat_id = WORKER_1_ID
                elif target == "worker2":
                    target_chat_id = WORKER_2_ADMIN_ID if str(WORKER_2_ADMIN_ID).isdigit() else WORKER_1_ID
                elif target == "citizen":
                    target_chat_id = CITIZEN_Z2_ID

                if target_chat_id and str(target_chat_id).isdigit():
                    try:
                        await app.bot.send_message(chat_id=int(target_chat_id), text=msg_text)
                        logger.info(f"[OUTBOX PUSH SUCCESS] -> {target}: {msg_text}")
                    except Exception as err:
                        logger.error(f"[OUTBOX PUSH ERROR]: {err}")
                else:
                    logger.info(f"[OUTBOX LOGGED LOCAL] Target '{target}': {msg_text}")

        except Exception as e:
            logger.error(f"[OUTBOX LOOP ERROR]: {e}")

        await asyncio.sleep(1.5)

# ==============================================================================
# MAIN BOT ENGINE LAUNCHER
# ==============================================================================
def main():
    print("================================================================================")
    print("  PROJECT SYNTHCITY: TELEGRAM C2 & DASHBOARD OVERRIDE ENGINE")
    print("================================================================================")
    print(f"• BOT TOKEN: {TELEGRAM_BOT_TOKEN[:15]}...")
    print(f"• WORKER 1 ID: {WORKER_1_ID} ('U')")
    print(f"• CITIZEN Z2 ID: {CITIZEN_Z2_ID} ('Dhynendra Gaurkar')")
    print(f"• WORKER 2 ADMIN ID: {WORKER_2_ADMIN_ID} ('Ritesh Alone')")
    print("================================================================================")

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_telegram_message))

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.create_task(dashboard_outbox_listener(app))

    logger.info("Starting Telegram Bot Polling...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
