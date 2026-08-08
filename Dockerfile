FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 py3-pip
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/miniprogram/package.json apps/miniprogram/
COPY apps/mobile/pubspec.yaml apps/mobile/ || true
COPY services/api/package.json services/api/
COPY services/ai/pyproject.toml services/ai/
COPY packages/contracts/package.json packages/contracts/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/version/package.json packages/version/
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

# ---------- API ----------
FROM deps AS api
WORKDIR /app
COPY services/api services/api
COPY packages packages
EXPOSE 3000
CMD ["node", "--env-file=.env", "services/api/dist/main.js"]

# ---------- AI ----------
FROM python:3.12-slim AS ai
WORKDIR /app
COPY services/ai services/ai
RUN pip install --no-cache-dir -e "./services/ai[dev]"
EXPOSE 8001
CMD ["uvicorn", "boks_ai.streaming.server:app", "--host", "0.0.0.0", "--port", "8001"]