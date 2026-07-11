#include "webview.h"
#include <iostream>
#include <unistd.h>
#include <limits.h>

int main() {
    char cwd[PATH_MAX];
    if (getcwd(cwd, sizeof(cwd)) == NULL) {
        return 1;
    }

    std::string current_dir(cwd);
    if (current_dir.length() >= 6 && current_dir.substr(current_dir.length() - 6) == "/build") {
        current_dir = current_dir.substr(0, current_dir.length() - 6);
    }

    std::string url = std::string("file://") + current_dir + "/ui/index.html";

    webview::webview w(false, nullptr);
    w.set_title("Minimal Webview App");
    w.set_size(800, 600, WEBVIEW_HINT_NONE);

    w.bind("go_backend_xu_ly", [&](const std::string &req) -> std::string {
        std::cout << "Backend received: " << req << std::endl;
        return "{\"status\": \"Acknowledged\"}"; // Trả về chuỗi JSON hợp lệ để JS ở frontend parse được
    });

    w.navigate(url);
    w.run();

    return 0;
}
