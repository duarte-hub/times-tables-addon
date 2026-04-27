"""
Times Tables Addon - Flask backend
Serves the frontend and fires Home Assistant automations via the Supervisor API.
"""

import os
import json
import requests
from flask import Flask, send_from_directory, jsonify, request

app = Flask(__name__)

SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
HA_API = "http://supervisor/core/api"
OPTIONS_FILE = "/data/options.json"


def get_options():
    try:
        with open(OPTIONS_FILE) as f:
            return json.load(f)
    except Exception:
        return {
            "player_name": "Player",
            "allowed_tables": list(range(1, 13)),
            "reward_automation": "",
        }


@app.route("/")
def index():
    return send_from_directory("/app/static", "index.html")


@app.route("/api/options")
def options():
    opts = get_options()

    # allowed_tables can be a comma-separated string (new) or a list of ints (legacy)
    raw = opts.get("allowed_tables", "2,3,4,5,6,7,8,9,10")
    if isinstance(raw, list):
        allowed_tables = [int(t) for t in raw]
    else:
        allowed_tables = [int(t.strip()) for t in str(raw).split(",") if t.strip().isdigit()]
    if not allowed_tables:
        allowed_tables = list(range(2, 11))

    return jsonify({
        "player_name": opts.get("player_name", "Player"),
        "allowed_tables": allowed_tables,
        "reward_automation": opts.get("reward_automation", ""),
    })


@app.route("/api/reward", methods=["POST"])
def trigger_reward():
    """
    Called by the frontend when a reward is earned.
    Triggers the automation configured in addon settings,
    or fires a generic times_tables_reward event as fallback.
    """
    data = request.json or {}
    opts = get_options()
    automation = opts.get("reward_automation", "").strip()

    event_data = {
        "player": opts.get("player_name", "Player"),
        **data,
    }

    if not SUPERVISOR_TOKEN:
        print(f"[DEV] Reward earned. Would trigger: '{automation}' with {event_data}")
        return jsonify({"success": True, "dev_mode": True})

    try:
        headers = {
            "Authorization": f"Bearer {SUPERVISOR_TOKEN}",
            "Content-Type": "application/json",
        }

        if automation:
            # Trigger the specific automation chosen in addon config
            response = requests.post(
                f"{HA_API}/services/automation/trigger",
                headers=headers,
                json={"entity_id": automation},
                timeout=5,
            )
        else:
            # No automation set — fire a generic event instead
            response = requests.post(
                f"{HA_API}/events/times_tables_reward",
                headers=headers,
                json=event_data,
                timeout=5,
            )

        response.raise_for_status()
        return jsonify({"success": True})

    except requests.RequestException as e:
        print(f"[ERROR] Failed to trigger reward: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# Serve all other static files (style.css, app.js, etc.)
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory("/app/static", filename)


if __name__ == "__main__":
    print("Times Tables addon starting on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)
