# ═══════════════════════════════════════════════════════════════
# Dockerfile สำหรับ WebRTC Messaging Demo
# ═══════════════════════════════════════════════════════════════
# Dockerfile นี้สร้าง Docker image สำหรับรัน Signalling Server

# ──────────────────────────────────────────────────────────────
# 1. Base Image - ใช้ Node.js LTS version
# ──────────────────────────────────────────────────────────────
FROM node:18-alpine

# ระบุว่าใช้ Node.js 18 (LTS) บน Alpine Linux (เบามาก ~40MB)
# alpine = Linux distribution ที่เล็กมาก เหมาะกับ Docker

# ──────────────────────────────────────────────────────────────
# 2. ตั้งค่า Metadata
# ──────────────────────────────────────────────────────────────
LABEL maintainer="WebRTC Demo"
LABEL description="WebRTC Messaging Demo - Signalling Server"
LABEL version="1.0.0"

# ──────────────────────────────────────────────────────────────
# 3. กำหนด Working Directory
# ──────────────────────────────────────────────────────────────
WORKDIR /app

# ทุก command ต่อจากนี้จะทำงานใน /app
# ถ้า /app ไม่มี Docker จะสร้างให้อัตโนมัติ

# ──────────────────────────────────────────────────────────────
# 4. Copy package.json และ package-lock.json ก่อน
# ──────────────────────────────────────────────────────────────
COPY package*.json ./

# Copy ไฟล์ package.json และ package-lock.json (ถ้ามี) ไปที่ /app
# ทำก่อนเพื่อใช้ประโยชน์จาก Docker layer caching
# ถ้า dependencies ไม่เปลี่ยน Docker จะใช้ cache ทำให้ build เร็วขึ้น

# ──────────────────────────────────────────────────────────────
# 5. Install Dependencies
# ──────────────────────────────────────────────────────────────
RUN npm ci --only=production

# npm ci = clean install (เร็วกว่า npm install)
# --only=production = ติดตั้งแค่ dependencies ไม่รวม devDependencies
# เหมาะสำหรับ production environment

# ──────────────────────────────────────────────────────────────
# 6. Copy ไฟล์โปรเจคทั้งหมด
# ──────────────────────────────────────────────────────────────
COPY . .

# Copy ไฟล์ทั้งหมดจากโปรเจคไปที่ /app
# ไฟล์ที่อยู่ใน .dockerignore จะไม่ถูก copy

# ──────────────────────────────────────────────────────────────
# 7. Expose Port
# ──────────────────────────────────────────────────────────────
EXPOSE 3000

# บอกว่า container นี้จะใช้ port 3000
# หมายเหตุ: EXPOSE ไม่ได้เปิด port ให้ แค่เป็น documentation
# ต้องใช้ -p 3000:3000 ตอน docker run

# ──────────────────────────────────────────────────────────────
# 8. กำหนด Environment Variables (ถ้าต้องการ)
# ──────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3000

# NODE_ENV=production จะทำให้ Node.js รันในโหมด production
# PORT=3000 กำหนด port default (สามารถ override ได้ตอน run)

# ──────────────────────────────────────────────────────────────
# 9. สร้าง Non-root User (Security Best Practice)
# ──────────────────────────────────────────────────────────────
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# สร้าง user และ group ชื่อ nodejs
# รัน container ด้วย user นี้แทน root (ปลอดภัยกว่า)

# เปลี่ยนเจ้าของไฟล์ทั้งหมดเป็น nodejs user
RUN chown -R nodejs:nodejs /app

# ใช้ user nodejs ตอน run
USER nodejs

# ──────────────────────────────────────────────────────────────
# 10. Health Check (ตรวจสอบว่า container ทำงานปกติไหม)
# ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# ทุกๆ 30 วินาที จะลอง request ไปที่ localhost:3000
# ถ้า status code = 200 แสดงว่า healthy
# ถ้าไม่ healthy 3 ครั้งติด container จะถูกทำเครื่องหมายว่า unhealthy

# ──────────────────────────────────────────────────────────────
# 11. คำสั่งรัน Application
# ──────────────────────────────────────────────────────────────
CMD ["node", "server.js"]

# เมื่อ container start จะรัน: node server.js
# ใช้ CMD แทน RUN เพราะ CMD รันตอน container start
# RUN รันตอน build image
