#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the data
with open('input_hex.txt', 'r', encoding='utf-8') as f:
    hex_data = f.read()

hex_data = hex_data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")

if len(hex_data) > 30300:
    hex_data = hex_data[:30300]

print(f"Data length: {len(hex_data)}")
print(f"First 20 chars: '{hex_data[:20]}'")

# Check what happens at position 1212
print(f"\nAt position 1212: '{hex_data[1212:1230]}'")
print(f"Position 1212 char: '{hex_data[1212]}'")

# Now let's trace the compression step by step
i = 0
zero_count = 0
j = i

print(f"\nStarting compression at position {i}")
print(f"Checking: hex_data[{j}:{j+2}] = '{hex_data[j:j+2]}'")

if hex_data[j:j+2] == "00":
    print("Found '00' at start")
    while j < len(hex_data) - 1 and hex_data[j:j+2] == "00":
        zero_count += 1
        j += 2
        if zero_count <= 10 or zero_count % 100 == 0:
            print(f"  Step {zero_count}: j={j}, hex_data[{j}:{j+2}]='{hex_data[j:j+2]}'")
        if zero_count >= 610:  # Stop after 610 to see what happens
            print(f"  Stopping at {zero_count} to check...")
            break
    
    print(f"\nFinal: zero_count={zero_count}, j={j}")
    print(f"Data at position j: '{hex_data[j:j+10]}'")
    print(f"Would compress to: :{zero_count}")
    
    # Check if there's something wrong after position 1212
    if j < len(hex_data):
        print(f"\nAfter the zeros, starting from position {j}:")
        print(f"  '{hex_data[j:j+20]}'")
        
        # Check if there are more zeros that shouldn't be counted
        if hex_data[j:j+2] == "00":
            print(f"  WARNING: Still finding '00' at position {j}!")
            # Count how many more
            more_zeros = 0
            k = j
            while k < len(hex_data) - 1 and hex_data[k:k+2] == "00":
                more_zeros += 1
                k += 2
                if more_zeros > 10:
                    break
            print(f"  Found {more_zeros} more '00' pairs after position {j}")

