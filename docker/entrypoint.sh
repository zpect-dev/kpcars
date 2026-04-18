#!/bin/sh
set -e

# Ensure writable directories have correct ownership
chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

# Production optimizations — cache config, routes, and views
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Run pending migrations
php artisan migrate --force

# Seed only on first run (flag file persists in the storage volume)
SEED_FLAG="/var/www/storage/.seeded"
if [ ! -f "$SEED_FLAG" ]; then
    echo "First run detected — seeding database..."
    php artisan db:seed --force
    touch "$SEED_FLAG"
fi

exec php-fpm
