#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

# Only process first 30300 chars
if len(data) > 30300:
    data = data[:30300]

print(f"Data length: {len(data)}")
print(f"First 20 chars: '{data[:20]}'")
print(f"First 20 chars as bytes: {data[:20].encode('utf-8')}")

# Check if data has any non-printable characters
for i, c in enumerate(data[:100]):
    if ord(c) > 127:
        print(f"Non-ASCII char at position {i}: {ord(c)}")

# Now test compression
i = 0
if i + 1 < len(data) and data[i:i+2] == "00":
    zero_count = 0
    j = i
    while j < len(data) - 1 and data[j:j+2] == "00":
        zero_count += 1
        j += 2
        if zero_count > 1000:  # Safety break
            print(f"Breaking at {zero_count} zeros")
            break
    
    print(f"Found {zero_count} consecutive zero bytes")
    print(f"j position: {j}")
    print(f"Data at position j: '{data[j:j+10]}'")

