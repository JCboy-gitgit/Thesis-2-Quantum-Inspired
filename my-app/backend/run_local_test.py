import json
import traceback
import sys

from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

try:
    with open('last_payload.json', 'r', encoding='utf-8') as f:
        payload = json.load(f)
    print("Starting POST request...")
    response = client.post('/api/schedules/generate', json=payload)
    print("Status Code:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error during execution:")
    traceback.print_exc()
