# בנייה לייצור. ייצוא PDF בשרת דורש Chromium – מותקן כאן מחבילת המערכת.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CHROMIUM_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium fonts-noto-core openssl && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p 3000"]
