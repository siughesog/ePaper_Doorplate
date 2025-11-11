#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
压缩默认图像数据为 RLE 格式
格式说明：
- 非零字节：直接存储两个十六进制字符（如 "FF" = 0xFF）
- 连续0：存储为 ":N" 其中 N 是连续个数（如 ":100" = 连续100个0）
"""

def compress_hex_data(hex_string, min_zero_run=3):
    """
    将十六进制字符串压缩为RLE格式
    
    Args:
        hex_string: 十六进制字符串（每2个字符代表1个字节）
        min_zero_run: 最小连续0的个数，超过此值才使用压缩格式（默认3）
    
    Returns:
        压缩后的字符串
    """
    compressed = []
    i = 0
    total_original = len(hex_string)
    
    while i < len(hex_string):
        if i + 1 < len(hex_string) and hex_string[i:i+2] == "00":
            # 计算连续0的个数（以字节为单位，即每2个字符）
            zero_count = 0
            j = i
            while j < len(hex_string) - 1 and hex_string[j:j+2] == "00":
                zero_count += 1
                j += 2
            
            # 如果连续0超过阈值，使用压缩格式 ":N"
            if zero_count >= min_zero_run:
                compressed.append(f":{zero_count}")
                i = j
            else:
                # 少于阈值的0，直接存储
                compressed.append("00" * zero_count)
                i = j
        else:
            # 非零字节，直接存储
            if i + 1 < len(hex_string):
                compressed.append(hex_string[i:i+2])
                i += 2
            else:
                # 最后一个字符（不完整），直接存储
                compressed.append(hex_string[i])
                i += 1
    
    result = "".join(compressed)
    compression_ratio = (1 - len(result) / total_original) * 100 if total_original > 0 else 0
    
    print(f"原始长度: {total_original} 字符")
    print(f"压缩后长度: {len(result)} 字符")
    print(f"压缩率: {compression_ratio:.2f}%")
    print(f"节省: {total_original - len(result)} 字符")
    
    return result


def main():
    print("=" * 60)
    print("默认图像数据压缩工具")
    print("=" * 60)
    print()
    print("请将前30300个字符的十六进制数据粘贴到下面（按Enter后输入数据，输入完成后按Ctrl+D或Ctrl+Z结束）:")
    print()
    
    # 读取输入数据
    lines = []
    try:
        while True:
            line = input()
            lines.append(line)
    except EOFError:
        pass
    
    hex_data = "".join(lines).replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")
    
    if len(hex_data) == 0:
        print("❌ 未输入数据")
        return
    
    print()
    print(f"输入数据长度: {len(hex_data)} 字符")
    
    if len(hex_data) > 30300:
        print(f"⚠️  数据长度超过30300，只处理前30300个字符")
        hex_data = hex_data[:30300]
    elif len(hex_data) < 30300:
        print(f"⚠️  数据长度少于30300，将使用实际长度")
    
    print()
    print("开始压缩...")
    print()
    
    # 压缩数据
    compressed = compress_hex_data(hex_data, min_zero_run=3)
    
    print()
    print("=" * 60)
    print("压缩完成！")
    print("=" * 60)
    print()
    print("压缩后的数据（前100个字符）:")
    print(compressed[:100] + "..." if len(compressed) > 100 else compressed)
    print()
    print("=" * 60)
    print("Arduino 代码片段:")
    print("=" * 60)
    print()
    print(f'const char defaultImageCompressed[] PROGMEM = "{compressed}";')
    print(f'const int defaultImageCompressedLen = {len(compressed)};')
    print()
    print("=" * 60)
    print("注意：")
    print("1. 将压缩后的字符串替换到 .ino 文件中的 defaultImageCompressed")
    print("2. 将 defaultImageCompressedLen 设置为压缩后的长度")
    print("3. defaultImageZeroTailLen 保持为 161700（后续0的长度）")
    print("=" * 60)


if __name__ == "__main__":
    main()

