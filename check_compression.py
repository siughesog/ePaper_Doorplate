#!/usr/bin/env python3
# Check if compression script is correct

# Simulate what the compression script does
def check_compression():
    # If input has 30300 characters, that's 15150 bytes
    # If all are "00", compression should be ":15150"
    # But we have ":60640" which means 60640 bytes = 121280 characters
    
    print("Analysis:")
    print("30300 characters = 15150 bytes")
    print("60640 bytes = 121280 characters")
    print()
    print("Problem: Compression script only processes first 30300 characters")
    print("But compressed data has :60640 which means 60640 bytes of zeros")
    print("This is impossible unless:")
    print("1. The input data actually has 60640 bytes of zeros at the start")
    print("2. OR the compression script processed more than 30300 characters")
    print("3. OR the compressed data is wrong")
    print()
    print("Let's check: If input starts with 30300 '0' characters...")
    test_input = "0" * 30300
    print(f"Input length: {len(test_input)} characters")
    print(f"Number of '00' pairs: {test_input.count('00')}")
    print(f"Number of bytes if all are '00': {len(test_input) // 2}")
    
    # Check if input could be all zeros
    if test_input.replace("0", "") == "":
        print("All characters are '0'")
        # Count how many "00" pairs
        zero_pairs = 0
        for i in range(0, len(test_input) - 1, 2):
            if test_input[i:i+2] == "00":
                zero_pairs += 1
        print(f"Number of '00' pairs: {zero_pairs}")
        print(f"Compression should be: :{zero_pairs}")
        print(f"But we have: :60640")
        print()
        print("CONCLUSION: The compressed data is WRONG!")
        print("The input data (30300 chars) cannot produce :60640")

if __name__ == "__main__":
    check_compression()

