FROM composer:2.7.2 AS composer-build
WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --prefer-dist --optimize-autoloader --ignore-platform-reqs

FROM node:22.14.0-alpine AS node-build
RUN apk update && apk add --no-cache \
    php \
    php-dom \
    php-fileinfo \
    php-mbstring \
    php-openssl \
    php-pdo \
    php-pdo_mysql \
    php-phar \
    php-session \
    php-tokenizer \
    php-xml \
    php-xmlwriter

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY --from=composer-build /app/vendor/ ./vendor/
COPY artisan composer.json vite.config.ts tsconfig.json .env.example ./
COPY app/ ./app/
COPY bootstrap/ ./bootstrap/
COPY config/ ./config/
COPY database/ ./database/
COPY routes/ ./routes/
COPY storage/ ./storage/
COPY resources/ ./resources/
COPY public/ ./public/

RUN cp .env.example .env && \
    php artisan key:generate && \
    npm run build

FROM php:8.3.3-fpm AS production

LABEL org.opencontainers.image.source="https://github.com/zpect-dev/kpcars" \
      org.opencontainers.image.description="KPCars - Sistema de Control de Vehiculos (Laravel/React/Inertia)" \
      org.opencontainers.image.vendor="CristMedicals"

ARG VERSION=1.0.0
ENV APP_VERSION=$VERSION

WORKDIR /var/www

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libfcgi-bin \
    libicu-dev \
    unixodbc-dev \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc -o /etc/apt/keyrings/microsoft.asc \
    && echo "deb [arch=amd64,armhf,arm64 signed-by=/etc/apt/keyrings/microsoft.asc] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
    && docker-php-ext-install \
    bcmath \
    intl \
    opcache \
    pdo_mysql \
    && pecl install pdo_sqlsrv-5.12.0 sqlsrv-5.12.0 \
    && docker-php-ext-enable pdo_sqlsrv sqlsrv \
    && apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && printf 'upload_max_filesize = 64M\npost_max_size = 512M\nmemory_limit = 1024M\nmax_execution_time = 300\n' > /usr/local/etc/php/conf.d/uploads-limits.ini

COPY --chown=www-data:www-data . /var/www
COPY --chown=www-data:www-data --from=composer-build /app/vendor /var/www/vendor
COPY --chown=www-data:www-data --from=node-build /app/public/build /var/www/public/build

RUN php artisan storage:unlink || true && \
    php artisan storage:link

COPY --chown=root:root docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

FROM nginx:1.25.4-alpine AS web

COPY nginx-interno.conf /etc/nginx/conf.d/default.conf
COPY --from=production /var/www/public /var/www/public
