FROM node:24-alpine
RUN npm install -g pnpm@12.14.0
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter api --prod=false
COPY apps/api apps/api
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3000
# SEED_ON_START=true: seed idempotent trước khi chạy (có marker thì bỏ qua, có dữ liệu lạ thì từ chối, không bao giờ FLUSHDB)
CMD ["sh", "-c", "if [ \"$SEED_ON_START\" = \"true\" ]; then ./node_modules/.bin/tsx scripts/seed.ts || { status=$?; echo '[seed] failed; API startup aborted' >&2; exit \"$status\"; }; fi; exec ./node_modules/.bin/tsx src/server.ts"]
