FROM node:20-alpine AS base
WORKDIR /app

RUN apk add --no-cache curl bash zip \
    && curl -fsSL https://bun.sh/install | bash

COPY bun.lock package.json tsconfig.json .
RUN /root/.bun/bin/bun install --frozen-lockfile

FROM base AS builder

COPY . .

ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ENV NEXT_PUBLIC_CONVEX_SITE_URL=$NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_VERSION
ENV NEXT_PUBLIC_VERSION=$NEXT_PUBLIC_VERSION
ARG NEXT_PUBLIC_VERSION_MOD
ENV NEXT_PUBLIC_VERSION_MOD=$NEXT_PUBLIC_VERSION_MOD

RUN /root/.bun/bin/bun run build

ARG VSPHERE_HOSTNAME
RUN cd /app/plugins \
 && ./setup.sh $VSPHERE_HOSTNAME $NEXT_PUBLIC_SITE_URL \
 && mkdir -p /app/public/plugins \
 && cp hypershelf-vsphere.zip /app/public/plugins/

FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl bash \
    && curl -fsSL https://bun.sh/install | bash

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock

RUN /root/.bun/bin/bun install --production --frozen-lockfile

EXPOSE 3000
CMD ["/root/.bun/bin/bun", "run", "start"]
