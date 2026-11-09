FROM node:26-alpine
WORKDIR /app
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN chmod -R a+rX /app && mkdir /app/var && chown -R node:node /app
USER 1000:1000
ENV HOST=0.0.0.0 PORT=8080 DATA_DIR=/app/var
EXPOSE 8080
HEALTHCHECK --interval=2s --timeout=2s --retries=15 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server.ts"]
