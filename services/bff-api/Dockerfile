# Node 20 Alpine for smaller image
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./ 2>/dev/null || true
RUN npm -v >/dev/null 2>&1 && npm i -g pnpm@9 && pnpm fetch || true
COPY . .
RUN pnpm install --prod --no-optional || npm ci --only=production || true
EXPOSE 8080
CMD ["node", "src/index.js"]
