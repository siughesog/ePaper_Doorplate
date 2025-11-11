#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('compressed_output.txt', 'r', encoding='utf-8') as f:
    compressed = f.read().strip()

print(f'Length: {len(compressed)}')
print(f'First 50 chars: {compressed[:50]}')
print(f'Starts with :60640: {compressed.startswith(":60640")}')
print(f'Starts with :606: {compressed.startswith(":606:")}')

# Check what comes after :606
if compressed.startswith(":606"):
    print(f'After :606: {compressed[4:20]}')
elif compressed.startswith(":60640"):
    print(f'After :60640: {compressed[6:20]}')
    print('ERROR: Should be :606, not :60640!')

