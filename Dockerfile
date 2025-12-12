FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat yarn

FROM base AS deps
ENV NODE_ENV=development
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS builder
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn prisma:generate && \
    yarn build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat yarn
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/main.js"]

