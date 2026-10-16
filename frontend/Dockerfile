# Stage 1: build the static site with Node.
# Always runs on the build machine's own CPU: the output is plain HTML/JS/CSS, the same for every
# architecture, and npm under QEMU arm64 emulation can hang (it froze a CI job for 6 hours).
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve it with Nginx. No Node or node_modules in the final image.
# nginx-unprivileged runs as user 101 and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine
ENV BACKEND_URL=http://backend:8000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
