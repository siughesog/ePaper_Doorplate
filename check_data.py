#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

first_30300 = data[:30300]
print(f'Length: {len(first_30300)}')
print(f'All zeros: {first_30300.count("0") == len(first_30300)}')
print(f'Zero pairs: {first_30300.count("00")}')

# Find first non-zero
for i, c in enumerate(first_30300):
    if c != '0':
        print(f'First non-zero at position: {i}, char: {c}')
        print(f'Context: {first_30300[max(0, i-10):i+10]}')
        break
else:
    print('All zeros in first 30300 chars')

