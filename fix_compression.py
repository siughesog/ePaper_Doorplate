#!/usr/bin/env python3
# -*- coding: utf-8 -*-

print("=" * 60)
print("RLE Compression Format Explanation")
print("=" * 60)
print()
print("Format: ':N' means N consecutive zero bytes")
print()
print("Example: ':60640'")
print("  - Parsed as: 60640 consecutive zero bytes")
print("  - NOT as: 60 zeros, then 6, then 4, then 0")
print("  - NOT as: 606 zeros, then 40")
print()
print("Parser logic (from displayDefaultImage):")
print("  1. Sees ':' character")
print("  2. Reads ALL digits after ':' until non-digit")
print("  3. Converts digits to number (60640)")
print("  4. Outputs that many zero bytes")
print()
print("=" * 60)
print("The Problem")
print("=" * 60)
print()
print("Data has 606 consecutive zero bytes (1212 hex chars)")
print("But compression script produced :60640")
print("This is WRONG - it should be :606")
print()
print("=" * 60)
print("Fixing the compression")
print("=" * 60)

# Read compressed output
with open('compressed_output.txt', 'r', encoding='utf-8') as f:
    compressed = f.read().strip()

# Fix it
corrected = compressed.replace(':60640:', ':606:', 1)

print(f"Original: {compressed[:20]}")
print(f"Corrected: {corrected[:20]}")

# Save corrected version
with open('compressed_output_fixed.txt', 'w', encoding='utf-8') as f:
    f.write(corrected)

print("\nFixed file saved to compressed_output_fixed.txt")
print(f"Length: {len(corrected)} characters (original: {len(compressed)})")

