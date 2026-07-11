#include "webview.h"
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <filesystem>
#include <cstdlib> // CHỈNH SỬA: Thêm thư viện để dùng std::getenv lấy đường dẫn HOME
#include <algorithm> // CHỈNH SỬA: Thêm thư viện chứa hàm std::remove_if để sửa lỗi build

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

// CHỈNH SỬA: Hàm tự động xóa các file frame_XXXX.png có số thứ tự lớn hơn max_frames_allowed
void clean_unused_frames(size_t max_frames_allowed) {
    try {
        std::string target_dir = "/mnt/ramdisk/animacium";
        if (!std::filesystem::exists(target_dir)) return;

        for (const auto& entry : std::filesystem::directory_iterator(target_dir)) {
            if (!entry.is_regular_file()) continue;

            std::string filename = entry.path().filename().string();
            // Kiểm tra xem file có đúng định dạng "frame_" và ".png" không
            if (filename.rfind("frame_", 0) == 0 && filename.size() == 14 && filename.substr(10, 4) == ".png") {
                try {
                    // Trích xuất số thứ tự từ tên file "frame_XXXX.png" (bắt đầu từ ký tự thứ 6, dài 4 ký tự)
                    int file_seq = std::stoi(filename.substr(6, 4));
                    
                    // Nếu số thứ tự file lớn hơn số frame hiện tại của project, tiến hành xóa ngay
                    if (file_seq > static_cast<int>(max_frames_allowed)) {
                        std::filesystem::remove(entry.path());
                        std::cout << "[Backend Clean] Removed obsolete frame: " << filename << std::endl;
                    }
                } catch (...) {
                    // Bỏ qua nếu có lỗi parse tên file không hợp lệ
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "[Backend Clean] Error cleaning directory: " << e.what() << std::endl;
    }
}

// Function to save frame passed from frontend
void save_frame(const std::string& seq_num_str, const std::string& base64_data, size_t total_frames) {
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

        // CHỈNH SỬA: Gọi hàm dọn dẹp ngay lập tức sau khi ghi file để đồng bộ dung lượng ramdisk
        clean_unused_frames(total_frames);

    } catch (const std::exception& e) {
        std::cerr << "[Backend Exception] in save_frame: " << e.what() << std::endl;
    }
}

// CHỈNH SỬA: Hàm lấy đường dẫn tuyệt đối của file project.json trong ~/.cache/animacium
std::string get_project_file_path() {
    const char* home_dir = std::getenv("HOME");
    if (!home_dir) {
        return ".animacium_project.json"; // Dự phòng nếu không tìm thấy biến môi trường HOME
    }
    return std::string(home_dir) + "/.cache/animacium/project.json";
}

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
    // Thay đổi bind nhận tham số để lấy thêm độ dài mảng frame hiện tại từ frontend
    w.bind("saveFrameBackend", [](std::string json_args) -> std::string {
        try {
            // json_args dạng mảng: ["seq", "b64", "total_frames"]
            size_t first_quote = json_args.find("\"");
            size_t second_quote = json_args.find("\"", first_quote + 1);
            size_t third_quote = json_args.find("\"", second_quote + 1);
            size_t fourth_quote = json_args.find("\"", third_quote + 1);

            if (first_quote != std::string::npos && second_quote != std::string::npos &&
                third_quote != std::string::npos && fourth_quote != std::string::npos) {

                std::string seq = json_args.substr(first_quote + 1, second_quote - first_quote - 1);
                std::string b64 = json_args.substr(third_quote + 1, fourth_quote - third_quote - 1);

                // Tìm kiếm tham số số lượng frame nằm phía sau chuỗi base64
                size_t last_comma = json_args.rfind(",");
                size_t closing_bracket = json_args.rfind("]");
                size_t total_frames = 1; // Giá trị dự phòng mặc định

                if (last_comma != std::string::npos && closing_bracket != std::string::npos && last_comma > fourth_quote) {
                    std::string total_str = json_args.substr(last_comma + 1, closing_bracket - last_comma - 1);
                    // Loại bỏ khoảng trắng nếu có
                    total_str.erase(std::remove_if(total_str.begin(), total_str.end(), ::isspace), total_str.end());
                    if (!total_str.empty()) {
                        total_frames = std::stoull(total_str);
                    }
                }

                save_frame(seq, b64, total_frames);
            }
        } catch (const std::exception& e) {
            std::cerr << "[Backend Bind] Parsing error: " << e.what() << std::endl;
        }
        return "{\"status\":\"success\"}";
    });

    // CHỈNH SỬA: Sửa lại thuật toán bóc tách chuỗi JSON để không làm hỏng cấu trúc file project.json
    w.bind("saveProjectBackend", [](std::string json_args) -> std::string {
        try {
            // json_args truyền xuống từ webview.h luôn bọc trong cặp dấu ngoặc vuông mảng: ["<nội_dung_json_chuỗi>"]
            size_t first_quote = json_args.find("\"");
            size_t last_quote = json_args.rfind("\"");
            if (first_quote == std::string::npos || last_quote == std::string::npos || first_quote == last_quote) {
                return "{\"status\":\"error\",\"message\":\"Format error\"}";
            }
            
            std::string escaped_json = json_args.substr(first_quote + 1, last_quote - first_quote - 1);
            std::string raw_json = "";
            raw_json.reserve(escaped_json.length());

            // Unescape chuỗi an toàn
            for (size_t i = 0; i < escaped_json.length(); ++i) {
                if (escaped_json[i] == '\\' && i + 1 < escaped_json.length()) {
                    char next = escaped_json[i + 1];
                    if (next == '"' || next == '\\' || next == '/') {
                        raw_json += next;
                        i++;
                        continue;
                    } else if (next == 'n') { raw_json += '\n'; i++; continue; }
                    else if (next == 'r') { raw_json += '\r'; i++; continue; }
                    else if (next == 't') { raw_json += '\t'; i++; continue; }
                }
                raw_json += escaped_json[i];
            }

            std::string path = get_project_file_path();
            fs::create_directories(fs::path(path).parent_path());

            std::ofstream outfile(path);
            if (outfile.is_open()) {
                outfile << raw_json;
                outfile.close();
                std::cout << "[Backend] Project saved to: " << path << std::endl;
                return "{\"status\":\"success\"}";
            }
        } catch (const std::exception& e) {
            std::cerr << "[Backend SaveProject] Error: " << e.what() << std::endl;
        }
        return "{\"status\":\"error\"}";
    });

    // CHỈNH SỬA: Đồng bộ hóa định dạng escape JSON gửi ngược lên để JS không bị crash khi parse
    w.bind("loadProjectBackend", [](std::string) -> std::string {
        try {
            std::string path = get_project_file_path();
            if (!fs::exists(path)) {
                return "{\"status\":\"empty\"}";
            }
            std::ifstream infile(path);
            if (infile.is_open()) {
                std::string content((std::istreambuf_iterator<char>(infile)), std::istreambuf_iterator<char>());
                infile.close();
                
                std::string escaped_content = "";
                escaped_content.reserve(content.length() * 1.1);
                for (char c : content) {
                    if (c == '"') escaped_content += "\\\"";
                    else if (c == '\\') escaped_content += "\\\\";
                    else if (c == '\n') escaped_content += "\\n";
                    else if (c == '\r') escaped_content += "\\r";
                    else if (c == '\t') escaped_content += "\\t";
                    else escaped_content += c;
                }
                return "{\"status\":\"success\",\"data\":\"" + escaped_content + "\"}";
            }
        } catch (const std::exception& e) {
            std::cerr << "[Backend LoadProject] Error: " << e.what() << std::endl;
        }
        return "{\"status\":\"error\"}";
    });

    fs::path ui_path = fs::absolute("../ui/index.html");
    w.navigate("file://" + ui_path.string());

    w.run();
    return 0;
}