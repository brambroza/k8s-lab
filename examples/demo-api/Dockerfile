FROM node:22-alpine
WORKDIR /app
COPY --chown=node:node server.mjs ./
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
