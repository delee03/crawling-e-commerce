import os
import csv

def count_csv_lines():
    # Lấy danh sách tất cả các file trong thư mục hiện tại
    files = [f for f in os.listdir() if f.startswith("products") and f.endswith(".csv")]
    total_lines = 0  # Biến lưu tổng số dòng của tất cả file

    if not files:
        print("Không tìm thấy file nào bắt đầu với 'products' trong thư mục hiện tại.")
        return

    print("Đang đếm số dòng trong các file CSV:")
    
    # Lặp qua từng file và đếm dòng
    for file in files:
        try:
            with open(file, mode='r', encoding='utf-8') as csvfile:
                reader = csv.reader(csvfile)
                num_lines = sum(1 for row in reader) - 1  # Trừ 1 nếu có dòng tiêu đề
                print(f"- File: {file} có {num_lines} dòng.")
                total_lines += num_lines
        except Exception as e:
            print(f"Không thể đọc file {file}: {e}")

    print(f"Tổng số dòng của tất cả các file: {total_lines}")

# Gọi hàm
if __name__ == "__main__":
    count_csv_lines()
