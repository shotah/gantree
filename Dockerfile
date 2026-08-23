FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN HUSKY=0 npm ci
COPY . .
RUN npm run build
# Listen on all container interfaces; compose publishes host :80 → :3000.
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
