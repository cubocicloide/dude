# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

ARG VITE_APP_TITLE
ARG VITE_REACT_QUERY_DEVTOOLS
ENV VITE_APP_TITLE=$VITE_APP_TITLE
ENV VITE_REACT_QUERY_DEVTOOLS=$VITE_REACT_QUERY_DEVTOOLS

COPY . .
RUN pnpm build

# ── Serve stage ─────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
