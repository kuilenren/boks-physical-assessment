FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/services/api/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
