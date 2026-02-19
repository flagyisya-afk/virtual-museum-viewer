const express = require("express");
const http = require("http");
const path = require("path");
const axios = require("axios");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SKIN_SIZE = 64;
const skinsByRoom = new Map();

function isHexColor(value) {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function normalizeColor(value) {
  if (!isHexColor(value)) {
    return "#00000000";
  }
  return value.length === 7 ? `${value}FF` : value;
}

function createBlankSkin() {
  return Array.from({ length: SKIN_SIZE }, () =>
    Array.from({ length: SKIN_SIZE }, () => "#00000000")
  );
}

function getRoomSkin(roomId) {
  if (!skinsByRoom.has(roomId)) {
    skinsByRoom.set(roomId, createBlankSkin());
  }
  return skinsByRoom.get(roomId);
}

function isValidSkinMatrix(pixels) {
  if (!Array.isArray(pixels) || pixels.length !== SKIN_SIZE) {
    return false;
  }

  for (const row of pixels) {
    if (!Array.isArray(row) || row.length !== SKIN_SIZE) {
      return false;
    }

    for (const color of row) {
      if (!isHexColor(color)) {
        return false;
      }
    }
  }

  return true;
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function rgbToHex(r, g, b, alpha = 255) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(alpha)}`;
}

function generateAiSkin(prompt, style) {
  const normalizedPrompt = `${prompt || "default"}::${style || "classic"}`;
  const seed = hashString(normalizedPrompt);
  const random = seededRandom(seed);

  const primary = {
    r: Math.floor(random() * 200) + 40,
    g: Math.floor(random() * 200) + 40,
    b: Math.floor(random() * 200) + 40,
  };
  const secondary = {
    r: clamp(primary.r + Math.floor(random() * 80) - 40, 0, 255),
    g: clamp(primary.g + Math.floor(random() * 80) - 40, 0, 255),
    b: clamp(primary.b + Math.floor(random() * 80) - 40, 0, 255),
  };

  const pixels = createBlankSkin();

  for (let y = 0; y < SKIN_SIZE; y += 1) {
    for (let x = 0; x < SKIN_SIZE; x += 1) {
      const stripe = ((x + Math.floor(random() * 3)) % 8) < 4;
      const wave = Math.sin((x + y) / (4 + Math.floor(random() * 4)) + random() * 2);
      const noise = random() * 0.3;

      const source = stripe ? primary : secondary;
      const brightness = 0.75 + wave * 0.18 + noise;

      pixels[y][x] = rgbToHex(
        source.r * brightness,
        source.g * brightness,
        source.b * brightness,
        255
      );
    }
  }

  const accent = {
    r: clamp(255 - primary.r + Math.floor(random() * 50), 0, 255),
    g: clamp(255 - primary.g + Math.floor(random() * 50), 0, 255),
    b: clamp(255 - primary.b + Math.floor(random() * 50), 0, 255),
  };

  const panelSize = 8;
  const panelY = 8 + Math.floor(random() * 40);
  const panelX = 8 + Math.floor(random() * 40);
  for (let y = panelY; y < panelY + panelSize; y += 1) {
    for (let x = panelX; x < panelX + panelSize; x += 1) {
      pixels[y][x] = rgbToHex(accent.r, accent.g, accent.b, 255);
    }
  }

  return pixels;
}

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/name-check/:name", async (request, response) => {
  const { name } = request.params;

  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    return response.status(400).json({
      ok: false,
      error: "Name must be 3-16 chars and contain only letters, numbers, and underscore.",
    });
  }

  try {
    const mojangResponse = await axios.get(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`,
      {
        timeout: 8000,
        validateStatus: () => true,
      }
    );

    if (mojangResponse.status === 200) {
      return response.json({
        ok: true,
        name,
        available: false,
        profile: mojangResponse.data,
      });
    }

    if (mojangResponse.status === 204 || mojangResponse.status === 404) {
      return response.json({
        ok: true,
        name,
        available: true,
      });
    }

    if (mojangResponse.status === 429) {
      return response.status(429).json({
        ok: false,
        error: "Rate limited by Mojang API. Please try again in a moment.",
      });
    }

    return response.status(502).json({
      ok: false,
      error: `Unexpected Mojang status: ${mojangResponse.status}`,
    });
  } catch (error) {
    return response.status(500).json({
      ok: false,
      error: "Unable to reach Mojang API right now.",
      detail: error.message,
    });
  }
});

app.post("/api/ai/generate", (request, response) => {
  const { prompt = "", style = "classic" } = request.body || {};

  if (typeof prompt !== "string" || prompt.trim().length < 2) {
    return response.status(400).json({
      ok: false,
      error: "Prompt must be at least 2 characters.",
    });
  }

  const pixels = generateAiSkin(prompt.trim(), style);
  return response.json({ ok: true, pixels, engine: "local-procedural-v1" });
});

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId }) => {
    if (typeof roomId !== "string" || !roomId.trim()) {
      return;
    }

    const normalizedRoomId = roomId.trim().slice(0, 64);
    socket.join(normalizedRoomId);

    const skin = getRoomSkin(normalizedRoomId);
    socket.emit("skin:init", { roomId: normalizedRoomId, pixels: skin });
    socket.to(normalizedRoomId).emit("user:joined", { socketId: socket.id });
  });

  socket.on("pixel:update", ({ roomId, x, y, color }) => {
    if (typeof roomId !== "string") {
      return;
    }

    const normalizedRoomId = roomId.trim().slice(0, 64);
    const px = Number(x);
    const py = Number(y);
    if (
      Number.isNaN(px) ||
      Number.isNaN(py) ||
      px < 0 ||
      py < 0 ||
      px >= SKIN_SIZE ||
      py >= SKIN_SIZE
    ) {
      return;
    }

    const skin = getRoomSkin(normalizedRoomId);
    skin[py][px] = normalizeColor(color);

    socket.to(normalizedRoomId).emit("pixel:update", {
      x: px,
      y: py,
      color: skin[py][px],
      updatedBy: socket.id,
    });
  });

  socket.on("skin:replace", ({ roomId, pixels }) => {
    if (typeof roomId !== "string") {
      return;
    }

    const normalizedRoomId = roomId.trim().slice(0, 64);
    if (!isValidSkinMatrix(pixels)) {
      return;
    }

    const normalizedPixels = pixels.map((row) => row.map(normalizeColor));
    skinsByRoom.set(normalizedRoomId, normalizedPixels);

    socket.to(normalizedRoomId).emit("skin:replace", {
      pixels: normalizedPixels,
      updatedBy: socket.id,
    });
  });
});

app.get("*", (request, response) => {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Skin editor server running at http://localhost:${PORT}`);
});
