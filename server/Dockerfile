FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS build
RUN npm ci
COPY . ./
RUN npm run build

FROM build AS development
CMD ["npm", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN npm prune --omit=dev
CMD ["npm", "run", "start"]