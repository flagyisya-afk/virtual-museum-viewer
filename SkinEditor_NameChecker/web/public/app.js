const SKIN_SIZE = 64;
const socket = io();

const roomIdInput = document.getElementById("roomIdInput");
const joinRoomButton = document.getElementById("joinRoomButton");
const roomStatus = document.getElementById("roomStatus");

const skinCanvas = document.getElementById("skinCanvas");
const ctx = skinCanvas.getContext("2d", { willReadFrequently: true });
ctx.imageSmoothingEnabled = false;

const toolSelect = document.getElementById("toolSelect");
const colorPicker = document.getElementById("colorPicker");
const clearButton = document.getElementById("clearButton");
const importInput = document.getElementById("importInput");
const exportButton = document.getElementById("exportButton");

const nameInput = document.getElementById("nameInput");
const checkNameButton = document.getElementById("checkNameButton");
const nameResult = document.getElementById("nameResult");

const aiPrompt = document.getElementById("aiPrompt");
const generateButton = document.getElementById("generateButton");
const aiStatus = document.getElementById("aiStatus");

let roomId = "";
let drawing = false;
let pixels = createBlankSkin();

function createBlankSkin() {
  return Array.from({ length: SKIN_SIZE }, () =>
    Array.from({ length: SKIN_SIZE }, () => "#00000000")
  );
}

function hexToRgba(hex) {
  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: 255,
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: parseInt(clean.slice(6, 8), 16),
  };
}

function rgbaToHex(r, g, b, a = 255) {
  const toHex = (value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

function renderSkin() {
  const imageData = ctx.createImageData(SKIN_SIZE, SKIN_SIZE);
  let offset = 0;

  for (let y = 0; y < SKIN_SIZE; y += 1) {
    for (let x = 0; x < SKIN_SIZE; x += 1) {
      const { r, g, b, a } = hexToRgba(pixels[y][x]);
      imageData.data[offset] = r;
      imageData.data[offset + 1] = g;
      imageData.data[offset + 2] = b;
      imageData.data[offset + 3] = a;
      offset += 4;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function getMousePixel(event) {
  const rect = skinCanvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * SKIN_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * SKIN_SIZE);
  return {
    x: Math.max(0, Math.min(SKIN_SIZE - 1, x)),
    y: Math.max(0, Math.min(SKIN_SIZE - 1, y)),
  };
}

function applyPixel(x, y, color, broadcast = true) {
  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) {
    return;
  }

  if (pixels[y][x] === color) {
    return;
  }

  pixels[y][x] = color;
  const { r, g, b, a } = hexToRgba(color);
  const dot = ctx.createImageData(1, 1);
  dot.data[0] = r;
  dot.data[1] = g;
  dot.data[2] = b;
  dot.data[3] = a;
  ctx.putImageData(dot, x, y);

  if (broadcast && roomId) {
    socket.emit("pixel:update", { roomId, x, y, color });
  }
}

function floodFill(startX, startY, newColor) {
  const original = pixels[startY][startX];
  if (original === newColor) {
    return;
  }

  const stack = [[startX, startY]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) {
      continue;
    }
    if (pixels[y][x] !== original) {
      continue;
    }

    pixels[y][x] = newColor;
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  renderSkin();

  if (roomId) {
    socket.emit("skin:replace", { roomId, pixels });
  }
}

function currentPaintColor() {
  return `${colorPicker.value}FF`;
}

function applyTool(event) {
  const { x, y } = getMousePixel(event);
  const tool = toolSelect.value;

  if (tool === "fill") {
    floodFill(x, y, currentPaintColor());
    return;
  }

  if (tool === "erase") {
    applyPixel(x, y, "#00000000", true);
    return;
  }

  applyPixel(x, y, currentPaintColor(), true);
}

skinCanvas.addEventListener("mousedown", (event) => {
  drawing = true;
  applyTool(event);
});

window.addEventListener("mouseup", () => {
  drawing = false;
});

skinCanvas.addEventListener("mousemove", (event) => {
  if (!drawing) {
    return;
  }

  const tool = toolSelect.value;
  if (tool === "fill") {
    return;
  }

  applyTool(event);
});

clearButton.addEventListener("click", () => {
  pixels = createBlankSkin();
  renderSkin();
  if (roomId) {
    socket.emit("skin:replace", { roomId, pixels });
  }
});

importInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const image = new Image();
  const reader = new FileReader();
  reader.onload = () => {
    image.src = String(reader.result);
  };

  image.onload = () => {
    const offscreen = document.createElement("canvas");
    offscreen.width = SKIN_SIZE;
    offscreen.height = SKIN_SIZE;
    const offCtx = offscreen.getContext("2d", { willReadFrequently: true });
    offCtx.imageSmoothingEnabled = false;
    offCtx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
    offCtx.drawImage(image, 0, 0, SKIN_SIZE, SKIN_SIZE);

    const data = offCtx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE).data;
    const nextPixels = createBlankSkin();
    for (let y = 0; y < SKIN_SIZE; y += 1) {
      for (let x = 0; x < SKIN_SIZE; x += 1) {
        const index = (y * SKIN_SIZE + x) * 4;
        nextPixels[y][x] = rgbaToHex(
          data[index],
          data[index + 1],
          data[index + 2],
          data[index + 3]
        );
      }
    }

    pixels = nextPixels;
    renderSkin();
    if (roomId) {
      socket.emit("skin:replace", { roomId, pixels });
    }
  };

  reader.readAsDataURL(file);
  importInput.value = "";
});

exportButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `skin-${roomId || "local"}.png`;
  link.href = skinCanvas.toDataURL("image/png");
  link.click();
});

joinRoomButton.addEventListener("click", () => {
  const candidate = roomIdInput.value.trim();
  if (!candidate) {
    roomStatus.textContent = "Enter a room ID first.";
    roomStatus.className = "error";
    return;
  }

  roomId = candidate;
  socket.emit("room:join", { roomId });
  roomStatus.textContent = `Connected to room: ${roomId}`;
  roomStatus.className = "success";
});

socket.on("skin:init", (payload) => {
  if (!payload?.pixels) {
    return;
  }

  pixels = payload.pixels;
  roomId = payload.roomId;
  roomStatus.textContent = `Connected to room: ${roomId}`;
  roomStatus.className = "success";
  renderSkin();
});

socket.on("user:joined", () => {
  roomStatus.textContent = `Connected to room: ${roomId} (another collaborator joined)`;
  roomStatus.className = "success";
});

socket.on("pixel:update", ({ x, y, color }) => {
  applyPixel(x, y, color, false);
});

socket.on("skin:replace", ({ pixels: serverPixels }) => {
  if (!serverPixels) {
    return;
  }

  pixels = serverPixels;
  renderSkin();
});

checkNameButton.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    nameResult.textContent = "Enter a name first.";
    nameResult.className = "error";
    return;
  }

  nameResult.textContent = "Checking...";
  nameResult.className = "warning";

  try {
    const response = await fetch(`/api/name-check/${encodeURIComponent(name)}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unknown error");
    }

    if (data.available) {
      nameResult.textContent = `${name} is AVAILABLE`;
      nameResult.className = "success";
    } else {
      nameResult.textContent = `${name} is TAKEN`;
      nameResult.className = "error";
    }
  } catch (error) {
    nameResult.textContent = `Error: ${error.message}`;
    nameResult.className = "error";
  }
});

generateButton.addEventListener("click", async () => {
  const prompt = aiPrompt.value.trim();
  if (prompt.length < 2) {
    aiStatus.textContent = "Prompt must be at least 2 characters.";
    aiStatus.className = "error";
    return;
  }

  aiStatus.textContent = "Generating skin...";
  aiStatus.className = "warning";

  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style: "classic" }),
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Generation failed");
    }

    pixels = data.pixels;
    renderSkin();
    if (roomId) {
      socket.emit("skin:replace", { roomId, pixels });
    }

    aiStatus.textContent = `Generated with ${data.engine}`;
    aiStatus.className = "success";
  } catch (error) {
    aiStatus.textContent = `Error: ${error.message}`;
    aiStatus.className = "error";
  }
});

renderSkin();
