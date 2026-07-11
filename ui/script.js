// Cấu trúc lưu trữ Frame và Vật thể
let frames = [];
let currentFrameIndex = -1;
let activeElementIndex = -1;

// Cài đặt Canvas
const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d');
const canvasHint = document.getElementById('canvas-hint');

// Trạng thái theo dõi chuột thời gian thực (180Hz+)
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let elementOriginalX = 0;
let elementOriginalY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

let needsUpdate = true;

// Tham chiếu Giao diện
const btnAddFrame = document.getElementById('btn-add-frame');
const btnDuplicateFrame = document.getElementById('btn-duplicate-frame'); // CHỈNH SỬA: Lấy tham chiếu nút duplicate
const btnAddCircle = document.getElementById('btn-add-circle');
const frameStrip = document.getElementById('frame-strip');
const frameCounter = document.getElementById('frame-counter');
const propsPanel = document.getElementById('props-panel');
const btnSaveProject = document.getElementById('btn-save-project'); // CHỈNH SỬA: Lấy tham chiếu nút lưu dự án
const btnRenderVideo = document.getElementById('btn-render-video'); // CHỈNH SỬA: Lấy tham chiếu nút Render Video mới

// Tự động tạo nút thêm Hình chữ nhật nếu chưa có trong HTML
let btnAddRect = document.getElementById('btn-add-rect');
if (!btnAddRect) {
    btnAddRect = document.createElement('button');
    btnAddRect.id = 'btn-add-rect';
    btnAddRect.className = 'btn btn-secondary';
    btnAddRect.textContent = '🟩 Add Movable Rect';
    document.querySelector('.controls').appendChild(btnAddRect);
}

// Khởi chạy hệ thống
function init() {
    setupEventListeners();
    // CHỈNH SỬA: Tự động nạp lại trạng thái đã lưu từ ổ cứng lên khi ứng dụng vừa chạy
    loadProjectFromDisk().then(() => {
        updateUIState();
        requestAnimationFrame(renderLoop);
    });
}

// Vòng lặp Render chính ở max refresh rate màn hình
function renderLoop() {
    if (isDragging && currentFrameIndex !== -1 && activeElementIndex !== -1) {
        const deltaX = currentMouseX - dragStartX;
        const deltaY = currentMouseY - dragStartY;

        const elem = frames[currentFrameIndex].elements[activeElementIndex];
        elem.x = elementOriginalX + deltaX;
        elem.y = elementOriginalY + deltaY;

        needsUpdate = true;
    }

    if (needsUpdate) {
        // Mặc định vẽ có hồng tâm để tương tác trên UI
        drawCanvas(false);
        needsUpdate = false;
    }
    requestAnimationFrame(renderLoop);
}

function updateUIState() {
    const hasFrames = frames.length > 0;
    canvasHint.style.display = hasFrames ? 'none' : 'block';
    btnAddCircle.disabled = !hasFrames;
    btnAddRect.disabled = !hasFrames;
    btnRenderVideo.disabled = !hasFrames; // CHỈNH SỬA: Bật tắt nút Render Video theo trạng thái project
    btnDuplicateFrame.disabled = currentFrameIndex === -1; // CHỈNH SỬA: Cập nhật trạng thái kích hoạt nút duplicate

    if (!hasFrames) {
        propsPanel.innerHTML = '<p class="empty-notice">No frame selected or active element to modify.</p>';
    }
    frameCounter.textContent = `Frames: ${frames.length}`;
}

function renderFrameStrip() {
    frameStrip.innerHTML = '';
    frames.forEach((frame, index) => {
        const thumb = document.createElement('div');
        thumb.className = `frame-thumb ${index === currentFrameIndex ? 'active' : ''}`;

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 120;
        thumbCanvas.height = 68;
        const tCtx = thumbCanvas.getContext('2d');

        tCtx.fillStyle = '#000000';
        tCtx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);

        const scale = 120 / canvas.width;

        // Sắp xếp theo độ nổi z trước khi vẽ thumbnail ẩn hồng tâm
        const sortedElements = [...frame.elements].sort((a, b) => a.z - b.z);

        sortedElements.forEach(elem => {
            tCtx.save();
            tCtx.translate(elem.x * scale, elem.y * scale);
            tCtx.rotate((elem.angle * Math.PI) / 180);
            tCtx.fillStyle = elem.color;

            if (elem.type === 'circle') {
                tCtx.beginPath();
                tCtx.arc(0, 0, elem.radius * scale, 0, Math.PI * 2);
                tCtx.fill();
            } else if (elem.type === 'rect') {
                tCtx.fillRect(- (elem.width * scale) / 2, - (elem.height * scale) / 2, elem.width * scale, elem.height * scale);
            }
            tCtx.restore();
        });

        thumb.appendChild(thumbCanvas);
        const label = document.createElement('span');
        label.textContent = `#${index + 1}`;
        thumb.appendChild(label);

        thumb.addEventListener('click', () => selectFrame(index));
        frameStrip.appendChild(thumb);
    });
}

function selectFrame(index) {
    currentFrameIndex = index;
    activeElementIndex = -1;
    needsUpdate = true;
    renderFrameStrip();
    updateUIState();
    updatePropertiesPanel();
}

function createNewFrame() {
    frames.push({ elements: [] });
    selectFrame(frames.length - 1);
    saveCurrentFrameToDisk();
}

// CHỈNH SỬA: Thêm hàm sao chép frame hiện tại thành một frame mới kế tiếp
function duplicateCurrentFrame() {
    if (currentFrameIndex === -1) return;

    // Sao chép sâu mảng vật thể của frame được chọn để tránh lỗi tham chiếu chéo
    const currentElements = frames[currentFrameIndex].elements;
    const clonedElements = JSON.parse(JSON.stringify(currentElements));

    // Chèn frame nhân bản ngay liền sau vị trí frame hiện tại
    frames.splice(currentFrameIndex + 1, 0, { elements: clonedElements });

    // Tự động chuyển vùng chọn sang frame mới tạo
    selectFrame(currentFrameIndex + 1);
    saveCurrentFrameToDisk();
}

function addCircleToCurrentFrame() {
    if (currentFrameIndex === -1) return;
    const currentElements = frames[currentFrameIndex].elements;

    frames[currentFrameIndex].elements.push({
        type: 'circle',
        x: canvas.width / 2,
        y: canvas.height / 2,
        radius: 40,
        angle: 0,
        z: currentElements.length, // Độ nổi mặc định cao nhất lúc thêm vào
        color: '#ff9800'
    });
    activeElementIndex = frames[currentFrameIndex].elements.length - 1;
    needsUpdate = true;
    renderFrameStrip();
    updatePropertiesPanel();
    saveCurrentFrameToDisk();
}

function addRectToCurrentFrame() {
    if (currentFrameIndex === -1) return;
    const currentElements = frames[currentFrameIndex].elements;

    frames[currentFrameIndex].elements.push({
        type: 'rect',
        x: canvas.width / 2,
        y: canvas.height / 2,
        width: 100,
        height: 60,
        angle: 0,
        z: currentElements.length, // Độ nổi mặc định cao nhất lúc thêm vào
        color: '#00bcd4'
    });
    activeElementIndex = frames[currentFrameIndex].elements.length - 1;
    needsUpdate = true;
    renderFrameStrip();
    updatePropertiesPanel();
    saveCurrentFrameToDisk();
}

// CHỈNH SỬA: Nhận tham số isExporting. Nếu true, bỏ qua việc vẽ hồng tâm.
function drawCanvas(isExporting = false) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentFrameIndex === -1) return;

    // Sắp xếp các hình theo thứ tự độ nổi z tăng dần trước khi render ra màn hình
    const sortedElements = [...frames[currentFrameIndex].elements].sort((a, b) => a.z - b.z);

    sortedElements.forEach((elem) => {
        ctx.save();
        ctx.translate(elem.x, elem.y);
        ctx.rotate((elem.angle * Math.PI) / 180);
        ctx.fillStyle = elem.color;

        if (elem.type === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, elem.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (elem.type === 'rect') {
            ctx.fillRect(-elem.width / 2, -elem.height / 2, elem.width, elem.height);
        }

        ctx.restore();
    });

    // CHỈNH SỬA: Chỉ vẽ hồng tâm phục vụ tương tác nếu KHÔNG phải xuất file ảnh
    if (!isExporting) {
        frames[currentFrameIndex].elements.forEach((elem, index) => {
            // Vẽ vòng tròn hồng tâm trắng
            ctx.beginPath();
            ctx.arc(elem.x, elem.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Vẽ tâm chữ thập định vị
            ctx.beginPath();
            ctx.moveTo(elem.x - 10, elem.y); ctx.lineTo(elem.x + 10, elem.y);
            ctx.moveTo(elem.x, elem.y - 10); ctx.lineTo(elem.x, elem.y + 10);
            ctx.strokeStyle = index === activeElementIndex ? '#2196F3' : '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }
}

// CHỈNH SỬA: Chuẩn hóa lại dải Z-index từ 0 đến N-1 tránh xung đột hoặc nhảy cóc số
function normalizeZIndices(elements) {
    const sorted = [...elements].sort((a, b) => a.z - b.z);
    sorted.forEach((elem, idx) => {
        elem.z = idx;
    });
}

// CHỈNH SỬA: Bổ sung thanh điều chỉnh Độ nổi (Z-index) chính xác
function updatePropertiesPanel() {
    if (currentFrameIndex === -1 || activeElementIndex === -1) {
        propsPanel.innerHTML = '<p class="empty-notice">Click directly on an object\'s center pivot to move or edit it.</p>';
        return;
    }

    const elements = frames[currentFrameIndex].elements;
    const elem = elements[activeElementIndex];
    let sizeControls = '';

    if (elem.type === 'circle') {
        sizeControls = `
        <div class="prop-group">
        <label>Radius (px)</label>
        <input type="number" id="prop-radius" value="${Math.round(elem.radius)}">
        </div>`;
    } else if (elem.type === 'rect') {
        sizeControls = `
        <div class="prop-group">
        <label>Width (Length X)</label>
        <input type="number" id="prop-width" value="${Math.round(elem.width)}">
        </div>
        <div class="prop-group">
        <label>Height (Length Y)</label>
        <input type="number" id="prop-height" value="${Math.round(elem.height)}">
        </div>`;
    }

    const maxZ = elements.length - 1;

    propsPanel.innerHTML = `
    <div style="margin-bottom: 10px; font-weight: bold; color: #ff9800;">Type: ${elem.type.toUpperCase()}</div>
    ${sizeControls}
    <div class="prop-group">
    <label>Rotation Angle (0 - 360°)</label>
    <div style="display: flex; gap: 10px; align-items: center;">
    <input type="range" id="prop-angle-slider" min="0" max="360" value="${elem.angle}" style="flex: 1;">
    <input type="number" id="prop-angle-num" min="0" max="360" value="${elem.angle}" style="width: 65px; text-align: center;">
    </div>
    </div>
    <div class="prop-group">
    <label>Z-Index / Layer Depth (0 to ${maxZ})</label>
    <input type="number" id="prop-zindex" min="0" max="${maxZ}" value="${elem.z}">
    </div>
    `;

    // Bind sự kiện size thay đổi
    if (elem.type === 'circle') {
        document.getElementById('prop-radius').addEventListener('input', (e) => {
            elem.radius = Math.max(1, Number(e.target.value));
            needsUpdate = true;
            renderFrameStrip();
        });
    } else if (elem.type === 'rect') {
        document.getElementById('prop-width').addEventListener('input', (e) => {
            elem.width = Math.max(1, Number(e.target.value));
            needsUpdate = true;
            renderFrameStrip();
        });
        document.getElementById('prop-height').addEventListener('input', (e) => {
            elem.height = Math.max(1, Number(e.target.value));
            needsUpdate = true;
            renderFrameStrip();
        });
    }

    // Xoay góc
    const slider = document.getElementById('prop-angle-slider');
    const numInput = document.getElementById('prop-angle-num');
    const handleAngleChange = (val) => {
        let angle = Number(val);
        if (angle < 0) angle = 0;
        if (angle > 360) angle = 360;
        elem.angle = angle;
        slider.value = angle;
        numInput.value = angle;
        needsUpdate = true;
        renderFrameStrip();
    };
    slider.addEventListener('input', (e) => handleAngleChange(e.target.value));
    numInput.addEventListener('input', (e) => handleAngleChange(e.target.value));

    // CHỈNH SỬA: Xử lý thay đổi Z-Index trực tiếp
    document.getElementById('prop-zindex').addEventListener('input', (e) => {
        let targetZ = Number(e.target.value);
        if (targetZ < 0) targetZ = 0;
        if (targetZ > maxZ) targetZ = maxZ;

        // Hoán đổi hoặc sắp xếp lại giá trị z của các phần tử khác
        const oldZ = elem.z;
        if (oldZ !== targetZ) {
            elements.forEach((item, idx) => {
                if (idx !== activeElementIndex) {
                    if (oldZ < targetZ && item.z > oldZ && item.z <= targetZ) {
                        item.z--;
                    } else if (oldZ > targetZ && item.z < oldZ && item.z >= targetZ) {
                        item.z++;
                    }
                }
            });
            elem.z = targetZ;
            normalizeZIndices(elements);
            needsUpdate = true;
            renderFrameStrip();
        }
    });
}

// CHỈNH SỬA: Bổ sung số lượng frame tổng vào tham số gửi đi để backend quản lý việc xóa file dư thừa
function saveCurrentFrameToDisk() {
    if (currentFrameIndex === -1) return;

    // 1. Tạm thời vẽ Canvas sạch hoàn toàn (Không chứa hồng tâm)
    drawCanvas(true);

    // 2. Chụp trạng thái nhị phân
    const dataUrl = canvas.toDataURL('image/png');
    const seqStr = String(currentFrameIndex + 1).padStart(4, '0');

    // 3. Trả lại giao diện UI có hồng tâm ngay lập tức cho chu kỳ kế tiếp
    needsUpdate = true;

    if (window.saveFrameBackend) {
        // CHỈNH SỬA: Truyền thêm frames.length làm đối số thứ 3 xuống C++
        window.saveFrameBackend(seqStr, dataUrl, frames.length).catch(err => console.error(err));
    }
}

// CHỈNH SỬA: Sửa lại logic phân tích phản hồi để tránh lỗi SyntaxError: JSON Parse error
function saveProjectToDisk() {
    if (!window.saveProjectBackend) return;

    const projectData = {
        frames: frames,
        currentFrameIndex: currentFrameIndex
    };

    const jsonString = JSON.stringify(projectData);
    window.saveProjectBackend(jsonString)
        .then(response => {
            // CHỈNH SỬA: Kiểm tra nếu response đã là object sẵn do thư viện ép kiểu thì không cần parse lại
            const res = (typeof response === 'object') ? response : JSON.parse(response);
            if (res.status === 'success') {
                alert('Project data saved to ~/.cache/animacium/project.json');
            } else {
                alert('Failed to save project data.');
            }
        })
        .catch(err => console.error('[Frontend Save] Error:', err));
}

// CHỈNH SỬA: Gọi xuống backend để gom frame thành video MKV
function renderVideoFromDisk() {
    if (!window.renderVideoBackend) return;
    
    window.renderVideoBackend("")
        .then(response => {
            const res = (typeof response === 'object') ? response : JSON.parse(response);
            if (res.status === 'success') {
                alert('Render video thành công! File lưu tại /mnt/ramdisk/animacium/output.mkv');
            } else {
                alert('Render video thất bại.');
            }
        })
        .catch(err => console.error('[Frontend Render] Error:', err));
}

// CHỈNH SỬA: Sửa lại logic nạp file cấu hình cũ từ đĩa lên hệ thống canvas
function loadProjectFromDisk() {
    return new Promise((resolve) => {
        if (!window.loadProjectBackend) {
            resolve();
            return;
        }

        window.loadProjectBackend("")
            .then(response => {
                // CHỈNH SỬA: Ép kiểu an toàn tránh xung đột kiểu định dạng dữ liệu nhận về
                const res = (typeof response === 'object') ? response : JSON.parse(response);
                if (res.status === 'success' && res.data) {
                    const projectData = JSON.parse(res.data);
                    if (projectData.frames && Array.isArray(projectData.frames)) {
                        frames = projectData.frames;
                        currentFrameIndex = projectData.currentFrameIndex !== undefined ? projectData.currentFrameIndex : -1;
                        activeElementIndex = -1;
                        
                        if (frames.length > 0 && currentFrameIndex !== -1) {
                            selectFrame(currentFrameIndex);
                        } else if (frames.length > 0) {
                            selectFrame(0);
                        }
                    }
                }
                resolve();
            })
            .catch(err => {
                console.error('[Frontend Load] Error:', err);
                resolve();
            });
    });
}

function setupEventListeners() {
    btnAddFrame.addEventListener('click', createNewFrame);
    btnDuplicateFrame.addEventListener('click', duplicateCurrentFrame); // CHỈNH SỬA: Lắng nghe sự kiện click nút duplicate
    btnAddCircle.addEventListener('click', addCircleToCurrentFrame);
    btnAddRect.addEventListener('click', addRectToCurrentFrame);
    btnSaveProject.addEventListener('click', saveProjectToDisk); // CHỈNH SỬA: Lắng nghe sự kiện click nút lưu dự án
    btnRenderVideo.addEventListener('click', renderVideoFromDisk); // CHỈNH SỬA: Lắng nghe sự kiện click nút Render Video mới

    canvas.addEventListener('mousedown', (e) => {
        if (currentFrameIndex === -1) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const elements = frames[currentFrameIndex].elements;
        let found = false;

        // Kiểm tra click trúng hồng tâm
        for (let i = elements.length - 1; i >= 0; i--) {
            const elem = elements[i];
            const distToPivot = Math.sqrt((mouseX - elem.x) ** 2 + (mouseY - elem.y) ** 2);

            if (distToPivot <= 12) {
                activeElementIndex = i;
                isDragging = true;
                dragStartX = mouseX;
                dragStartY = mouseY;
                currentMouseX = mouseX;
                currentMouseY = mouseY;
                elementOriginalX = elem.x;
                elementOriginalY = elem.y;
                found = true;
                break;
            }
        }

        if (!found) activeElementIndex = -1;

        needsUpdate = true;
        updatePropertiesPanel();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();

        if (e.getCoalescedEvents) {
            const coalescedEvents = e.getCoalescedEvents();
            if (coalescedEvents.length > 0) {
                const lastEvent = coalescedEvents[coalescedEvents.length - 1];
                currentMouseX = lastEvent.clientX - rect.left;
                currentMouseY = lastEvent.clientY - rect.top;
                return;
            }
        }
        currentMouseX = e.clientX - rect.left;
        currentMouseY = e.clientY - rect.top;
    });

    const stopDragging = () => {
        if (isDragging) {
            isDragging = false;
            renderFrameStrip();
            updatePropertiesPanel();
            saveCurrentFrameToDisk();
        }
    };

    canvas.addEventListener('mouseup', stopDragging);
    canvas.addEventListener('mouseleave', stopDragging);
}

document.addEventListener('DOMContentLoaded', init);