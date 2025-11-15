#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

# Check first 1212 chars
first_1212 = data[:1212]
print(f'First 1212 chars length: {len(first_1212)}')
print(f'All zeros: {all(c == "0" for c in first_1212)}')
print(f'Zero count: {first_1212.count("0")}')

# Count "00" pairs
zero_pairs = 0
for i in range(0, len(first_1212) - 1, 2):
    if first_1212[i:i+2] == "00":
        zero_pairs += 1
    else:
        print(f'Found non-00 at position {i}: {first_1212[i:i+2]}')
        break

print(f'Zero pairs: {zero_pairs}')

# Check what comes after
if len(data) > 1212:
    print(f'After position 1212: {data[1212:1230]}')

