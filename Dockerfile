FROM node:20-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
# /data is where orders.json lives; it is mounted as a volume so it survives restarts
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "server.js"]
