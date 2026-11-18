# --- Build stage: compile the static bundle -------------------------------
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm silently skips an optional dependency it fails to download, and the native
# binaries of the bundler and the CSS tools are optional. Loading them here makes
# a broken install fail this step instead of being kept in the build cache.
RUN npm ci --no-fund --no-audit  && node --input-type=module -e "await import('rolldown'); await import('lightningcss'); await import('@tailwindcss/oxide');"
COPY . .
RUN npm run build

# --- Runtime stage: unprivileged Nginx serving static files + API proxy ----
FROM nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
