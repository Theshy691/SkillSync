# SkillSync - Dockerfile
# Production-ready PHP 8.2 Apache Environment
FROM php:8.2-apache

# Set working directory
WORKDIR /var/www/html

# Install system dependencies and PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev \
    pkg-config \
    libssl-dev \
    unzip \
    && docker-php-ext-install curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache modules: rewrite for routing and headers for CORS/security
RUN a2enmod rewrite headers

# Copy project files to Apache root
COPY . /var/www/html/

# Configure permissions for web server and storage directories
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Expose standard Apache HTTP port
EXPOSE 80

# Start Apache in foreground
CMD ["apache2-foreground"]
