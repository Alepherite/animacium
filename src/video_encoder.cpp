#include "video_encoder.h"
#include <iostream>
#include <fstream>
#include <cstdlib>
#include <string>
#include <filesystem>
#include <vector>
#include <algorithm>

namespace fs = std::filesystem;

void generate_video_from_images() {
    std::string base_path = "/mnt/ramdisk/animacium/";
    std::string output_path = "/mnt/ramdisk/animacium/output.mkv";
    std::string list_file = base_path + "input_list.txt";
    int fps = 24;

    std::vector<std::string> png_files;

    for (const auto& entry : fs::directory_iterator(base_path)) {
        if (entry.is_regular_file() && entry.path().extension() == ".png") {
            png_files.push_back(entry.path().filename().string());
        }
    }

    if (png_files.empty()) {
        std::cerr << "Không tìm thấy file png nào trong " << base_path << "\n";
        return;
    }

    std::sort(png_files.begin(), png_files.end());

    std::ofstream outfile(list_file);
    if (!outfile.is_open()) {
        std::cerr << "Không thể tạo file danh sách tạm thời!\n";
        return;
    }

    double duration = 1.0 / fps;
    for (const auto& file : png_files) {
        outfile << "file '" << file << "'\n";
        outfile << "duration " << duration << "\n";
    }
    if (!png_files.empty()) {
        outfile << "file '" << png_files.back() << "'\n";
    }
    outfile.close();

    std::string ffmpeg_cmd = "ffmpeg -y -f concat -safe 0 -i " + list_file +
    " -c:v h264_qsv -global_quality 18 -pix_fmt yuv420p " +
    output_path;

    std::cout << "Đang thực thi lệnh FFmpeg mã hóa bằng Intel GPU...\n";
    int result = std::system(ffmpeg_cmd.c_str());

    fs::remove(list_file);

    if (result == 0) {
        std::cout << "Gom video thành công: " << output_path << "\n";
    } else {
        std::cerr << "FFmpeg gặp lỗi trong quá trình xử lý.\n";
    }
}
