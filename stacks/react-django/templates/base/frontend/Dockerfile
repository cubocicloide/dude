FROM node:22-alpine
WORKDIR /app

RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

EXPOSE 5173
CMD ["pnpm", "dev", "--host"]
