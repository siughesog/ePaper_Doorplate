#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Simulate what compress_default_image_file.py does
input_file = "input_hex.txt"
with open(input_file, 'r', encoding='utf-8') as f:
    hex_data = f.read()

# Clean data
hex_data = hex_data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")

print(f"After cleaning, length: {len(hex_data)}")

# Only process first 30300 chars
if len(hex_data) > 30300:
    hex_data = hex_data[:30300]
    print(f"Truncated to 30300 chars")

print(f"Final data length: {len(hex_data)}")
print(f"First 20 chars: '{hex_data[:20]}'")

# Now compress
def compress_hex_data(hex_string, min_zero_run=3):
    compressed = []
    i = 0
    
    while i < len(hex_string):
        if i + 1 < len(hex_string) and hex_string[i:i+2] == "00":
            zero_count = 0
            j = i
            while j < len(hex_string) - 1 and hex_string[j:j+2] == "00":
                zero_count += 1
                j += 2
            
            if zero_count >= min_zero_run:
                compressed.append(f":{zero_count}")
                i = j
            else:
                compressed.append("00" * zero_count)
                i = j
        else:
            if i + 1 < len(hex_string):
                compressed.append(hex_string[i:i+2])
                i += 2
            else:
                compressed.append(hex_string[i])
                i += 1
    
    return "".join(compressed)

compressed = compress_hex_data(hex_data, min_zero_run=3)
print(f"\nCompressed length: {len(compressed)}")
print(f"First 50 chars: {compressed[:50]}")

