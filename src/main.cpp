#include "webview.h"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <filesystem>

namespace fs = std::filesystem;

// Base64 decoding helper to avoid external dependencies
std::vector<unsigned char> decode_base64(const std::string& input) {
    const std::string b64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::vector<int> T(256, -1);
    for (int i = 0; i < 64; i++) T[b64_chars[i]] = i;

    std::vector<unsigned char> out;
    int val = 0, valb = -8;
    for (unsigned char c : input) {
        if (T[c] == -1) continue;
        val = (val << 6) + T[c];
        valb += 6;
        if (valb >= 0) {
            out.push_back((val >> valb) & 0xFF);
            valb -= 8;
        }
    }
    return out;
}

// Function to save frame passed from frontend
void save_frame(const std::string& seq_num_str, const std::string& base64_data) {
    try {
        std::string target_dir = "/mnt/ramdisk/animacium";
        std::filesystem::create_directories(target_dir);

        // Remove data URL prefix if present (e.g., "data:image/png;base64,")
        std::string clean_data = base64_data;
        size_t pos = clean_data.find(",");
        if (pos != std::string::npos) {
            clean_data = clean_data.substr(pos + 1);
        }

        std::vector<unsigned char> binary_data = decode_base64(clean_data);

        std::string file_path = target_dir + "/frame_" + seq_num_str + ".png";
        std::ofstream outfile(file_path, std::ios::binary);
        if (outfile.is_open()) {
            outfile.write(reinterpret_cast<const char*>(binary_data.data()), binary_data.size());
            outfile.close();
            std::cout << "[Backend] Saved frame: " << file_path << std::endl;
        } else {
            std::cerr << "[Backend] Error: Cannot open file for writing: " << file_path << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "[Backend] Exception in save_frame: " << e.what() << std::endl;
    }
}

// CHỈNH SỬA: Thêm tham số đầu vào để nhận biết vị trí file thực thi khi Dolphin kích hoạt
int main(int argc, char* argv[]) {
    // CHỈNH SỬA: Tự động chuyển Working Directory về thư mục chứa file thực thi (build/)
    try {
        if (argc > 0) {
            fs::path exePath = fs::absolute(argv[0]).parent_path();
            fs::current_path(exePath);
        }
    } catch (const fs::filesystem_error& e) {
        std::cerr << "[Backend] Error setting working directory: " << e.what() << std::endl;
    }

    webview::webview w(true, nullptr);
    w.set_title("Animacium Prototype");
    w.set_size(1024, 768, WEBVIEW_HINT_NONE);

    // Thay đổi bind nhận 1 tham số chuỗi JSON dạng ["seq", "b64"] để khớp với webview.h
    w.bind("saveFrameBackend", [](std::string json_args) -> std::string {
        try {
            // Phân tích cú pháp chuỗi JSON thô sơ để trích xuất seq và b64 từ mảng ["seq","b64"]
            // Tìm vị trí của các dấu ngoặc kép để bóc tách dữ liệu
            size_t first_quote = json_args.find("\"");
            size_t second_quote = json_args.find("\"", first_quote + 1);
            size_t third_quote = json_args.find("\"", second_quote + 1);
            size_t fourth_quote = json_args.find("\"", third_quote + 1);

            if (first_quote != std::string::npos && second_quote != std::string::npos &&
                third_quote != std::string::npos && fourth_quote != std::string::npos) {

                std::string seq = json_args.substr(first_quote + 1, second_quote - first_quote - 1);
            std::string b64 = json_args.substr(third_quote + 1, fourth_quote - third_quote - 1);

            save_frame(seq, b64);
                }
        } catch (const std::exception& e) {
            std::cerr << "[Backend Bind] Parsing error: " << e.what() << std::endl;
        }
        return "{\"status\":\"success\"}";
    });

    // CHỈNH SỬA: Sử dụng đường dẫn tương đối đi ngược ra 1 cấp từ thư mục build/ để tìm thư mục ui/
    fs::path ui_path = fs::absolute("../ui/index.html");
    w.navigate("file://" + ui_path.string());

    w.run();
    return 0;
}
