# --- Build stage: compile the static bundle -------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm silently skips an optional dependency it fails to download, and the native
# binaries of the bundler and the CSS tools are optional. Loading them here makes
# a broken install fail this step instead of being kept in the build cache.
RUN npm ci --no-fund --no-audit  && node --input-type=module -e "await import('rolldown'); await import('lightningcss'); await import('@tailwindcss/oxide');"
COPY . .
RUN npm run build

# --- Runtime stage: unprivileged Nginx serving static files + API proxy ----
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
