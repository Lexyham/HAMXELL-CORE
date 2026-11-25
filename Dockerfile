# HAMXELL CORE: one image for the web server and the worker.
#   web:    docker run -p 3000:3000 --env-file .env.local hamxell-core
#   worker: docker run --env-file .env.local hamxell-core npm run worker
# NEXT_PUBLIC_* values (none are used today) must be present at build time. Everything else is read at run time.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
USER node
EXPOSE 3000
CMD ["npm", "run", "serve"]
