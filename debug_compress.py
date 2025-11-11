#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def compress_hex_data_debug(hex_string, min_zero_run=3):
    compressed = []
    i = 0
    total_original = len(hex_string)
    
    print(f"Starting compression, input length: {total_original}")
    
    while i < len(hex_string):
        if i + 1 < len(hex_string) and hex_string[i:i+2] == "00":
            # Calculate consecutive zeros (in bytes, i.e., every 2 chars)
            zero_count = 0
            j = i
            while j < len(hex_string) - 1 and hex_string[j:j+2] == "00":
                zero_count += 1
                j += 2
            
            print(f"Found {zero_count} consecutive zero bytes starting at position {i}")
            
            # If consecutive zeros exceed threshold, use compressed format ":N"
            if zero_count >= min_zero_run:
                compressed.append(f":{zero_count}")
                print(f"  -> Compressed to :{zero_count}")
                i = j
            else:
                # Less than threshold zeros, store directly
                compressed.append("00" * zero_count)
                i = j
        else:
            # Non-zero byte, store directly
            if i + 1 < len(hex_string):
                compressed.append(hex_string[i:i+2])
                i += 2
            else:
                # Last character (incomplete), store directly
                compressed.append(hex_string[i])
                i += 1
        
        if len(compressed) > 0 and compressed[0].startswith(":"):
            print(f"First compressed segment: {compressed[0]}")
            break
    
    result = "".join(compressed)
    return result

with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

# Only process first 30300 chars
if len(data) > 30300:
    data = data[:30300]

compressed = compress_hex_data_debug(data, min_zero_run=3)
print(f"\nFirst compressed segment: {compressed[:100]}")

