#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Simulate exactly what compress_default_image_file.py does
input_file = "input_hex.txt"
with open(input_file, 'r', encoding='utf-8') as f:
    hex_data = f.read()

print(f"After reading file, length: {len(hex_data)}")

# Clean data (exactly as in the script)
hex_data = hex_data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")

print(f"After cleaning, length: {len(hex_data)}")

# Only process first 30300 chars (exactly as in the script)
if len(hex_data) > 30300:
    print(f"Truncating from {len(hex_data)} to 30300")
    hex_data = hex_data[:30300]
elif len(hex_data) < 30300:
    print(f"Data length is {len(hex_data)}, less than 30300")

print(f"Final data length: {len(hex_data)}")

# Now compress with the exact same function
def compress_hex_data(hex_string, min_zero_run=3):
    compressed = []
    i = 0
    total_original = len(hex_string)
    
    step = 0
    while i < len(hex_string):
        step += 1
        if step == 1:
            print(f"Step {step}: i={i}, checking hex_string[{i}:{i+2}]='{hex_string[i:i+2]}'")
        
        if i + 1 < len(hex_string) and hex_string[i:i+2] == "00":
            zero_count = 0
            j = i
            while j < len(hex_string) - 1 and hex_string[j:j+2] == "00":
                zero_count += 1
                j += 2
                if zero_count == 1:
                    print(f"  First zero found, j={j}")
                if zero_count == 606:
                    print(f"  Reached 606 zeros, j={j}, hex_string[{j}:{j+4}]='{hex_string[j:j+4]}'")
                if zero_count > 606 and zero_count <= 610:
                    print(f"  WARNING: zero_count={zero_count}, j={j}, hex_string[{j}:{j+4}]='{hex_string[j:j+4]}'")
                if zero_count > 1000:  # Safety
                    print(f"  Breaking at {zero_count}")
                    break
            
            if step == 1:
                print(f"  Final zero_count={zero_count}, j={j}")
                print(f"  Data at j: '{hex_string[j:j+10]}'")
            
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
        
        if step == 1 and len(compressed) > 0:
            print(f"  First compressed segment: '{compressed[0]}'")
            break
    
    return "".join(compressed)

compressed = compress_hex_data(hex_data, min_zero_run=3)
print(f"\nCompressed length: {len(compressed)}")
print(f"First 50 chars: {compressed[:50]}")

