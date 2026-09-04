import json
import glob
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TICKETS_DIR = os.path.join(BASE, "tickets")
OUT_FILE = os.path.join(BASE, "tickets.json")

files = sorted(glob.glob(os.path.join(TICKETS_DIR, "*.json")))
if not files:
    raise SystemExit("No ticket JSON files found in " + TICKETS_DIR)

tickets = []
seen_ids = set()
for f in files:
    with open(f, "r", encoding="utf-8") as fh:
        try:
            data = json.load(fh)
        except json.JSONDecodeError as e:
            raise SystemExit(f"JSON error in {f}: {e}")
    tid = data.get("id")
    if not tid:
        raise SystemExit(f"Ticket file {f} missing 'id' field")
    if tid in seen_ids:
        raise SystemExit(f"Duplicate ticket id {tid} found in {f}")
    seen_ids.add(tid)
    tickets.append(data)

# sort by numeric suffix of id (INC-2101 -> 2101)
def sort_key(t):
    tid = t["id"]
    digits = "".join(ch for ch in tid if ch.isdigit())
    return int(digits) if digits else 0

tickets.sort(key=sort_key)

with open(OUT_FILE, "w", encoding="utf-8") as out:
    json.dump({"tickets": tickets}, out, indent=2, ensure_ascii=False)

# Validate: re-read and parse
with open(OUT_FILE, "r", encoding="utf-8") as f:
    merged = json.load(f)

count = len(merged["tickets"])
print(f"Merged {len(files)} files -> {OUT_FILE}")
print(f"tickets.json parses OK, contains {count} tickets")
for t in merged["tickets"]:
    print(f"  - {t['id']}: {t['title']} [{t.get('difficulty','?')}]")

if count != 11:
    raise SystemExit(f"ERROR: expected 11 tickets, got {count}")
