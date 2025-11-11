#!/usr/bin/env python3
# -*- coding: utf-8 -*-

print("=" * 60)
print("RLE Compression Format Explanation")
print("=" * 60)
print()
print("Format: ':N' means N consecutive zero bytes")
print()
print("Example: ':60640'")
print("  - This is parsed as: 60640 consecutive zero bytes")
print("  - NOT as: 60 zeros, then 6, then 4, then 0")
print("  - NOT as: 606 zeros, then 40")
print()
print("The parser reads:")
print("  1. Sees ':' character")
print("  2. Reads all digits after ':' until non-digit")
print("  3. Converts digits to number (60640)")
print("  4. Outputs that many zero bytes")
print()
print("=" * 60)
print("Problem Analysis")
print("=" * 60)
print()

# Check actual data
with open('input_hex.txt', 'r', encoding='utf-8') as f:
    data = f.read().strip()

data = data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")

if len(data) > 30300:
    data = data[:30300]

print(f"Data length: {len(data)} characters")
print(f"First 1212 chars all zero: {all(c == '0' for c in data[:1212])}")
print(f"First non-zero at position: {next((i for i, c in enumerate(data) if c != '0'), -1)}")
print()

# Count zero pairs
zero_pairs = 0
for i in range(0, min(1212, len(data) - 1), 2):
    if data[i:i+2] == "00":
        zero_pairs += 1
    else:
        break

print(f"Consecutive '00' pairs from start: {zero_pairs}")
print(f"Should compress to: :{zero_pairs}")
print()

# Check what compression script actually produced
with open('compressed_output.txt', 'r', encoding='utf-8') as f:
    compressed = f.read().strip()

print(f"Actual compressed output starts with: {compressed[:10]}")
print(f"Expected: :606")
print(f"Actual: :60640")
print()
print("=" * 60)
print("CONCLUSION: Compression script has a BUG!")
print("=" * 60)
print("The compression script produced :60640 but should produce :606")
print("This means it's counting 60640 zeros instead of 606 zeros")
print()

