#include "video_encoder.h"
#include <iostream>

int main() {
    std::cout << "=== BẮT ĐẦU KIỂM TRA THƯ VIỆN VIDEO ENCODER ===\n";
    std::cout << "Thư mục quét: /mnt/ramdisk/animacium/\n";

    // Gọi trực tiếp hàm xử lý từ thư viện custom của bạn
    generate_video_from_images();

    std::cout << "=== KẾT THÚC KIỂM TRA ===\n";
    return 0;
}
