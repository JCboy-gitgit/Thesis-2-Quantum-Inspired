import requests
import json
import time

url = 'http://127.0.0.1:8001/api/schedules/generate'
payload = json.load(open('last_payload.json'))

print("Sending request to port 8001...")
try:
    r = requests.post(url, json=payload, timeout=30)
    print("Status:", r.status_code)
    print("Response snippet:", r.text[:200])
except Exception as e:
    print("Request failed:", e)
