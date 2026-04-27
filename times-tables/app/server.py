"""
Times Tables Addon - Flask backend
Serves the frontend and fires Home Assistant events via the Supervisor API.
"""

import os
import json
import requests
from flask import Flask, send_from_directory, jsonify, request

app = Flask(__name__, static_folder="/app/static")

SUPERVISOR_TOKEN = os.environ.get("SUPERVISOR_TOKEN", "")
HA_API = "http://supervisor/core/api"
OPTIONS_FILE = "/data/options.json"


def get_options():
    try:
        with open(OPTIONS_FILE) as f:
            return json.load(f)
    except Exception:
        return {"player_name": "Player"}


@app.route("/")
def index():
    return send_from_directory("/app/static", "index.html")


@app.route("/api/options")
def options():
    return jsonify(get_options())


@app.route("/api/reward", methods=["POST"])
def trigger_reward():
    """
    Called by the frontend when a reward should be triggered.
    Fires the 'times_tables_reward' event in Home Assistant.
    Event data includes: player, level, score, total, streak
    """
    data = request.json or {}
    opts = get_options()
    event_data = {
        "player": opts.get("player_name", "Player"),
        **data,
    }

    if not SUPERVISOR_TOKEN:
        # Running outside HA — just return success for dev/testing
        print(f"[DEV] Would fire event: times_tables_reward with {event_data}")
        return jsonify({"success": True, "dev_mode": True})

    try:
        headers = {
            "Authorization": f"Bearer {SUPERVISOR_TOKEN}",
            "Content-Type": "application/json",
        }
        response = requests.post(
            f"{HA_API}/events/times_tables_reward",
            headers=headers,
            json=event_data,
            timeout=5,
        )
        response.raise_for_status()
        return jsonify({"success": True, "status": response.status_code})
    except requests.RequestException as e:
        print(f"[ERROR] Failed to fire HA event: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("Times Tables addon starting on port 5000...")
    app.run(host="0.0.0.0", port=5000, debug=False)
