TARGET = my_app
CXX = g++
CXXFLAGS = -std=c++17 -O3 `pkg-config --cflags gtk+-3.0 webkit2gtk-4.1`
LIBS = `pkg-config --libs gtk+-3.0 webkit2gtk-4.1`

all: $(TARGET)

# Thêm video_encoder.cpp và video_encoder.h vào target
$(TARGET): src/main.cpp src/video_encoder.cpp src/webview.h src/video_encoder.h
	@mkdir -p build
	$(CXX) $(CXXFLAGS) src/main.cpp src/video_encoder.cpp -o build/$(TARGET) $(LIBS)

clean:
	rm -rf build