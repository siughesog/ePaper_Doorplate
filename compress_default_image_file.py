#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
压缩默认图像数据为 RLE 格式（从文件读取）
使用方法：
1. 将前30300个字符的十六进制数据保存到 input_hex.txt 文件
2. 运行: python compress_default_image_file.py
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
            
            # 使用压缩格式 "(N)" 表示 N 个连续0
            if zero_count >= min_zero_run:
                compressed.append(f"({zero_count})")
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
    print("默认图像数据压缩工具（从文件读取）")
    print("=" * 60)
    print()
    
    # 尝试从文件读取
    input_file = "input_hex.txt"
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            hex_data = f.read()
        print(f"✅ 从 {input_file} 读取数据")
    except FileNotFoundError:
        print(f"❌ 未找到文件 {input_file}")
        print()
        print("请创建 input_hex.txt 文件，包含前30300个字符的十六进制数据")
        print("或者直接在这里粘贴数据（按Enter后输入，Ctrl+D/Ctrl+Z结束）:")
        print()
        
        # 从标准输入读取
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            pass
        
        hex_data = "".join(lines)
    
    # 清理数据
    hex_data = hex_data.replace(" ", "").replace("\n", "").replace("\r", "").replace("\t", "")
    
    if len(hex_data) == 0:
        print("❌ 未输入数据")
        return
    
    print()
    print(f"输入数据长度: {len(hex_data)} 字符")
    
    # 只处理前30300个字符
    if len(hex_data) > 30300:
        print(f"⚠️  数据长度超过30300，只处理前30300个字符")
        hex_data = hex_data[:30300]
    elif len(hex_data) < 30300:
        print(f"⚠️  数据长度少于30300，将使用实际长度: {len(hex_data)}")
    
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
    print("压缩后的数据（前200个字符）:")
    preview = compressed[:200] + "..." if len(compressed) > 200 else compressed
    print(preview)
    print()
    print("压缩后的数据（后200个字符）:")
    if len(compressed) > 200:
        print("..." + compressed[-200:])
    print()
    
    # 保存到文件
    output_file = "compressed_output.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(compressed)
    print(f"✅ 压缩数据已保存到 {output_file}")
    print()
    
    print("=" * 60)
    print("Arduino 代码片段:")
    print("=" * 60)
    print()
    
    # 如果压缩数据太长，需要分段（Arduino字符串有长度限制）
    max_chunk_size = 1000  # 每段最大长度
    if len(compressed) <= max_chunk_size:
        print(f'const char defaultImageCompressed[] PROGMEM = "{compressed}";')
    else:
        print("// 压缩数据较长，需要分段存储")
        print("// 注意：Arduino PROGMEM 字符串有长度限制，如果太长需要分段")
        print(f'const char defaultImageCompressed[] PROGMEM = "{compressed[:max_chunk_size]}...";')
        print(f"// 总长度: {len(compressed)} 字符")
        print("// 建议：将完整压缩数据直接替换到代码中")
    
    print(f'const int defaultImageCompressedLen = {len(compressed)};')
    print()
    print("=" * 60)
    print("使用说明：")
    print("1. 将压缩后的字符串替换到 .ino 文件中的 defaultImageCompressed")
    print("2. 将 defaultImageCompressedLen 设置为压缩后的长度")
    print("3. defaultImageZeroTailLen 保持为 161700（后续0的长度）")
    print("4. 如果压缩数据太长，可能需要分段存储或使用其他方法")
    print("=" * 60)


if __name__ == "__main__":
    main()

