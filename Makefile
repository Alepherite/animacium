TARGET = my_app
CXX = g++
CXXFLAGS = -std=c++17 -O3 `pkg-config --cflags gtk+-3.0 webkit2gtk-4.1`
LIBS = `pkg-config --libs gtk+-3.0 webkit2gtk-4.1`

all: $(TARGET)

$(TARGET): src/main.cpp src/webview.h
	@mkdir -p build
	$(CXX) $(CXXFLAGS) src/main.cpp -o build/$(TARGET) $(LIBS)

clean:
	rm -rf build
