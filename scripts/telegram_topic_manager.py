import urllib.request
import json
import os
import sys

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "8984988206:AAFdz-53vl5FHckci1tmSoxMSSBVhRwhVrY")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "-1004410575074")

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "telegram_topics.json")

def load_topics():
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_topics(topics):
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(topics, f, indent=2, ensure_ascii=False)
    except Exception as e:
        sys.stderr.write(f"Warning: could not save topics json: {e}\n")

def get_or_create_topic(target_name):
    if not target_name:
        return ""

    clean_target = target_name.strip()
    
    # 1. Special case: Notification
    if clean_target.lower() in ["__notif__", "notif", "notifikasi", "notifikasi live"]:
        return "2"

    topics = load_topics()

    # 2. Exact match
    if clean_target in topics:
        return str(topics[clean_target])

    # 3. Case-insensitive / partial match
    lower_target = clean_target.lower()
    for k, v in topics.items():
        if k.lower() == lower_target:
            return str(v)

    for k, v in topics.items():
        if len(lower_target) >= 3 and (lower_target in k.lower() or k.lower() in lower_target):
            return str(v)

    # 4. If not found, create new forum topic on-the-fly
    try:
        topic_name = f"🎬 {clean_target}"
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/createForumTopic"
        payload = {
            "chat_id": int(CHAT_ID),
            "name": topic_name,
            "icon_color": 7322096
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            if data.get("ok"):
                new_id = data["result"]["message_thread_id"]
                topics[clean_target] = new_id
                save_topics(topics)
                return str(new_id)
    except Exception as ex:
        sys.stderr.write(f"Error creating forum topic on-the-fly: {ex}\n")

    return ""

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("")
        sys.exit(0)

    member_arg = " ".join(sys.argv[1:])
    topic_id = get_or_create_topic(member_arg)
    print(topic_id)
