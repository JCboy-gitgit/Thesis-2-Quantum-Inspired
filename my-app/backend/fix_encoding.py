"""Fix encoding of scheduler_v2.py to UTF-8 without BOM"""
import os

path = os.path.join(os.path.dirname(__file__), 'scheduler_v2.py')

# Read with auto-detection  
with open(path, 'rb') as f:
    raw = f.read()

# Detect and strip BOM
if raw[:2] == b'\xff\xfe':
    text = raw.decode('utf-16-le')
    print("Detected UTF-16 LE BOM")
elif raw[:2] == b'\xfe\xff':
    text = raw.decode('utf-16-be')
    print("Detected UTF-16 BE BOM")
elif raw[:3] == b'\xef\xbb\xbf':
    text = raw[3:].decode('utf-8')
    print("Detected UTF-8 BOM")
else:
    # Try utf-16 first (PowerShell default for Set-Content)
    try:
        text = raw.decode('utf-16')
        print("Decoded as UTF-16 (no BOM)")
    except:
        text = raw.decode('utf-8')
        print("Decoded as UTF-8 (no BOM)")

# Write back as UTF-8 without BOM
with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(text)

print(f"Done! File size: {os.path.getsize(path)} bytes")
print(f"First 50 chars: {text[:50]!r}")
