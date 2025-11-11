#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys

def compress_hex_data(hex_string, min_zero_run=3):
    compressed = []
    i = 0
    total_original = len(hex_string)
    
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

with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

# Only process first 30300 chars
if len(data) > 30300:
    data = data[:30300]
    print(f"Processing first 30300 chars")
else:
    print(f"Processing {len(data)} chars")

compressed = compress_hex_data(data, min_zero_run=3)
print(f"Compressed length: {len(compressed)}")
print(f"First 200 chars of compressed: {compressed[:200]}")

