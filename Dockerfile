# ===== STAGE 1: BUILD VITE APP =====
FROM node:20-alpine AS build

# Thư mục làm việc
WORKDIR /app

# Copy file khai báo dependency
COPY package*.json ./

# Cài dependency
RUN npm install

# Copy toàn bộ source vào container
COPY . .

# Build FE (Vite)
RUN npm run build

# ===== STAGE 2: SERVE VỚI NGINX =====
FROM nginx:alpine

# Xoá config default
RUN rm /etc/nginx/conf.d/default.conf

# Copy file config Nginx (bước 2)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy thư mục build từ stage 1 sang nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Mở port 80
EXPOSE 80

# Chạy nginx
CMD ["nginx", "-g", "daemon off;"]
