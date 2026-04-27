# Times Tables Addon for Home Assistant

An interactive multiple-choice times tables game for kids, running as a Home Assistant addon. When a child earns a reward (good score or long streak), it fires a `times_tables_reward` event in HA that you can attach any automation to.

---

## Features

- Pick which times tables to practise (1–12)
- Multiple choice questions (4 options)
- Score tracker, streak counter, progress bar
- Confetti animation on great scores
- Fires a `times_tables_reward` event into HA on good performance

---

## GitHub Setup

1. Create a new GitHub repository (e.g. `times-tables-addon`)
2. Push the contents of this folder to the `main` branch
3. Make the repo **public**

```
times-tables-addon/         ← repo root
├── README.md
├── repository.json
└── times-tables/
    ├── config.yaml
    ├── Dockerfile
    └── app/
        ├── server.py
        └── static/
            ├── index.html
            ├── style.css
            └── app.js
```

---

## Installing in Home Assistant

### Step 1 — Add the repository
1. Go to **Settings → Add-ons → Add-on Store**
2. Click the **⋮ menu** (top right) → **Repositories**
3. Paste your GitHub URL: `https://github.com/YOUR_USERNAME/times-tables-addon`
4. Click **Add**

### Step 2 — Install the addon
- Find **Times Tables** in the store and click **Install**
- Once installed, go to the addon's **Configuration** tab
- Set `player_name` to your child's name

### Step 3 — Start it
- Click **Start**
- Enable **Show in sidebar** for easy access
- Click **Open Web UI** — the game will open!

---

## Setting Up the Reward Automation

The addon fires a `times_tables_reward` event when:
- The child scores **8 or more** out of 10, OR
- They hit a streak of **5 or more** correct in a row

The event includes this data:
```json
{
  "player": "Emma",
  "score": 9,
  "total": 10,
  "streak": 6,
  "perfect": false,
  "level": "2,5,10"
}
```

### Example automation (YAML)

```yaml
alias: Times Tables Reward
trigger:
  - platform: event
    event_type: times_tables_reward
condition: []
action:
  # Flash the living room lights in a celebration colour
  - service: light.turn_on
    target:
      entity_id: light.living_room
    data:
      color_name: gold
      brightness: 255
      flash: short
  # Optional: play a sound
  - service: media_player.play_media
    target:
      entity_id: media_player.kitchen_speaker
    data:
      media_content_id: /local/well_done.mp3
      media_content_type: music
  # Optional: send a notification
  - service: notify.mobile_app
    data:
      message: >
        {{ trigger.event.data.player }} scored
        {{ trigger.event.data.score }}/{{ trigger.event.data.total }}
        on their times tables! 🌟
mode: single
```

You can also check `trigger.event.data.perfect` to trigger a *bigger* reward for a perfect 10/10!

---

## Configuration Options

| Option        | Default    | Description                          |
|---------------|------------|--------------------------------------|
| `player_name` | `"Player"` | The child's name shown in the game   |

---

## Local Development (without HA)

```bash
cd times-tables/app
pip install flask requests
python server.py
# Open http://localhost:5000
```

The server detects when `SUPERVISOR_TOKEN` is missing and logs reward events to console instead of firing them into HA.
