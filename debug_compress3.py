#!/usr/bin/env python3
# -*- coding: utf-8 -*-

input_file = "input_hex.txt"
with open(input_file, 'r', encoding='utf-8') as f:
    hex_data = f.read()

hex_data = hex_data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")

if len(hex_data) > 30300:
    hex_data = hex_data[:30300]

print(f"Data length: {len(hex_data)}")
print(f"First 1212 chars all zero: {all(c == '0' for c in hex_data[:1212])}")

# Test compression with detailed debugging
i = 0
if i + 1 < len(hex_data) and hex_data[i:i+2] == "00":
    zero_count = 0
    j = i
    step = 0
    while j < len(hex_data) - 1 and hex_data[j:j+2] == "00":
        zero_count += 1
        j += 2
        step += 1
        if step % 100 == 0:
            print(f"Step {step}: zero_count={zero_count}, j={j}, data[j:j+4]='{hex_data[j:j+4]}'")
        if zero_count > 1000:  # Safety break
            print(f"Breaking at {zero_count} zeros")
            break
    
    print(f"\nFinal: zero_count={zero_count}, j={j}")
    print(f"Data at position j: '{hex_data[j:j+10]}'")
    print(f"Compressed would be: :{zero_count}")

