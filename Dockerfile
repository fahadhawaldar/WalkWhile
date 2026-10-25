# WalkWhile API, deployed on Render (see render.yaml).
# Build context is the repo root: the API needs the shared package and the
# pedestrian graph (data/graphs/dubai.graph, built by
# apps/api/scripts/prepareOsm.sh).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

# Workspace manifests first, so dependency installs are cached.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
# Only the API and shared packages; tsx (a dev dependency) runs the server.
RUN npm ci --include=dev -w @walkwhile/api -w @walkwhile/shared --ignore-scripts

COPY packages/shared packages/shared
RUN npm run build -w @walkwhile/shared

COPY apps/api apps/api
COPY data/graphs data/graphs

# Render sets PORT.
WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/index.ts"]
