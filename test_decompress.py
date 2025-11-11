#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试解压逻辑，验证压缩数据是否正确
"""

def decompress_rle(compressed_str):
    """解压 RLE 压缩数据"""
    result = []
    i = 0
    
    while i < len(compressed_str):
        if compressed_str[i] == ':':
            # 读取数字
            i += 1
            num_str = ""
            while i < len(compressed_str) and compressed_str[i].isdigit():
                num_str += compressed_str[i]
                i += 1
            if num_str:
                zero_count = int(num_str)
                result.extend([0] * zero_count)
        else:
            # 读取两个十六进制字符
            if i + 1 < len(compressed_str):
                hex_str = compressed_str[i:i+2]
                try:
                    byte_val = int(hex_str, 16)
                    result.append(byte_val)
                    i += 2
                except ValueError:
                    print(f"Error: Cannot parse '{hex_str}' at position {i}")
                    break
            else:
                break
    
    return bytes(result)

# 测试压缩数据
compressed = ":60640:4080080:5200004:58040400008:520004002:59080003F180106080060060180080C0000001F0200304"

print("Testing decompression...")
decompressed = decompress_rle(compressed)

print(f"Decompressed length: {len(decompressed)} bytes")
print(f"First 100 bytes: {decompressed[:100].hex()}")
print(f"Zero count in first 100 bytes: {decompressed[:100].count(0)}")
print(f"Zero count in first 1000 bytes: {decompressed[:1000].count(0)}")
print(f"Zero count in first 60640 bytes: {decompressed[:60640].count(0)}")
print(f"First 60640 bytes all zero: {all(b == 0 for b in decompressed[:60640])}")

# Check first non-zero byte position
first_nonzero = -1
for i, b in enumerate(decompressed):
    if b != 0:
        first_nonzero = i
        break

print(f"First non-zero byte position: {first_nonzero}")
if first_nonzero >= 0:
    print(f"First non-zero byte value: 0x{decompressed[first_nonzero]:02X}")
    print(f"Bytes around first non-zero: {decompressed[first_nonzero:first_nonzero+10].hex()}")

