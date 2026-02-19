# Skin Editor + Name Checker (Web)

This app combines:

- Real-time collaborative Minecraft skin editing (multiple users in the same room)
- Username availability checks via Mojang API
- AI-assisted skin generation (local procedural engine)

## Run locally

1. Open a terminal in `SkinEditor_NameChecker/web`
2. Install dependencies:
   - `npm install`
3. Start server:
   - `npm start`
4. Open:
   - `http://localhost:3000`

## Features included

- `Collaborate`: enter a room ID and click **Join Room**
- Pixel editor tools: Pen, Erase, Fill
- PNG import/export for 64x64 skin texture
- Name checker endpoint: `/api/name-check/:name`
- AI generation endpoint: `/api/ai/generate`

## Notes

- Collaboration state is in-memory (resets when server restarts).
- AI generation currently uses a deterministic local procedural engine (`local-procedural-v1`), not a hosted LLM/image model.
- Mojang may rate-limit requests.

## Next steps for SKINMC-level parity

- Full skin part/layer-aware editor UX (head/body/arms/legs regions and overlays)
- 3D preview with animated model rendering
- User authentication, projects, version history, and cloud persistence
- Gallery, publishing, moderation, and sharing tools
- Text-to-skin model integration with external AI APIs
