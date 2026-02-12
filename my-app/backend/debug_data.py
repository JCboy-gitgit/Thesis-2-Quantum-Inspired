
import asyncio
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Supabase credentials not found.")
    exit(1)

supabase = create_client(url, key)

async def check_data():
    print("--- CHECKING ROOMS ---")
    rooms = supabase.table("rooms").select("*").execute()
    for r in rooms.data[:5]:
        print(f"Room: {r.get('room')} | Building: {r.get('building')} | College: '{r.get('college')}'")

    print("\n--- CHECKING SECTIONS ---")
    sections = supabase.table("sections").select("*").execute()
    for s in sections.data[:5]:
        print(f"Section: {s.get('section_code')} | Course: {s.get('course_code')} | College: '{s.get('college')}'")

if __name__ == "__main__":
    asyncio.run(check_data())
