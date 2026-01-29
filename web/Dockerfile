# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./
RUN npm install

# Копируем весь код
COPY . .

# Собираем production build
RUN npm run build

# Production stage
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Используем shell скрипт для определения папки сборки
COPY --from=builder /app /tmp/app

RUN if [ -d "/tmp/app/dist" ]; then \
        cp -r /tmp/app/dist/* /usr/share/nginx/html/; \
    elif [ -d "/tmp/app/build" ]; then \
        cp -r /tmp/app/build/* /usr/share/nginx/html/; \
    else \
        echo "Error: Neither dist nor build folder found!" && exit 1; \
    fi && \
    rm -rf /tmp/app

# Копируем конфигурацию nginx из исходников (не из builder)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]