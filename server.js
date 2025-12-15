// ═══════════════════════════════════════════════════════════════
// SIGNALLING SERVER - ตัวกลางในการแลกเปลี่ยนข้อมูล SDP และ ICE
// ═══════════════════════════════════════════════════════════════
// Server นี้ทำหน้าที่เป็นตัวกลาง (Signalling Server) ให้ peer สองตัว
// สามารถแลกเปลี่ยน SDP (Offer/Answer) และ ICE Candidates ได้
// หลังจาก peer เชื่อมต่อกันได้แล้ว ข้อมูลจะส่งตรงกัน (P2P) ไม่ผ่าน server นี้

// ──────────────────────────────────────────────────────────────
// 1. โหลด Libraries ที่จำเป็น
// ──────────────────────────────────────────────────────────────
const express = require('express');        // Web framework สำหรับสร้าง HTTP server
const app = express();                     // สร้าง Express application
const http = require('http').createServer(app);  // สร้าง HTTP server จาก Express
const io = require('socket.io')(http);     // เปิดใช้ Socket.io สำหรับ real-time communication

// ──────────────────────────────────────────────────────────────
// 2. ตั้งค่า Static File Server
// ──────────────────────────────────────────────────────────────
// ให้ server สามารถเสิร์ฟไฟล์ HTML, CSS, JS ในโฟลเดอร์เดียวกันได้
app.use(express.static(__dirname));

// ──────────────────────────────────────────────────────────────
// 3. เก็บข้อมูล Peers ที่เชื่อมต่ออยู่
// ──────────────────────────────────────────────────────────────
// Map เก็บคู่ของ [peerId -> socketId]
// เช่น { 'peer1' => 'abc123', 'peer2' => 'xyz789' }
const peers = new Map();

// ══════════════════════════════════════════════════════════════
// 4. จัดการเมื่อมี Peer เชื่อมต่อเข้ามา
// ══════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  // socket คือการเชื่อมต่อแต่ละตัวที่มี unique ID
  console.log('Peer connected:', socket.id);
  
  // ────────────────────────────────────────────────────────────
  // 4.1 Event: 'register' - ลงทะเบียน Peer
  // ────────────────────────────────────────────────────────────
  // เมื่อ peer ส่ง peerId มา (เช่น 'peer1' หรือ 'peer2')
  // เราจะเก็บไว้ว่า peerId นี้ใช้ socket ไหน
  socket.on('register', (peerId) => {
    // เก็บ mapping: peerId -> socket.id
    peers.set(peerId, socket.id);
    console.log(`Peer registered: ${peerId} (Socket: ${socket.id})`);
    
    // สร้างรายชื่อ peer อื่นๆ ที่เชื่อมต่ออยู่ (ไม่รวมตัวเอง)
    const peerList = Array.from(peers.keys()).filter(id => id !== peerId);
    
    // ส่งรายชื่อ peer ที่มีอยู่กลับไปให้ peer ที่เพิ่งเข้ามา
    socket.emit('peers-list', peerList);
    
    // แจ้งทุก peer อื่นๆ (broadcast) ว่ามี peer ใหม่เข้ามา
    socket.broadcast.emit('peer-joined', peerId);
  });
  
  // ────────────────────────────────────────────────────────────
  // 4.2 Event: 'offer' - ส่งต่อ SDP Offer
  // ────────────────────────────────────────────────────────────
  // เมื่อ peer1 สร้าง Offer และต้องการส่งให้ peer2
  // Server แค่ทำหน้าที่ส่งต่อ (relay) ไม่ได้ดูหรือแก้ไขข้อมูล
  socket.on('offer', (data) => {
    // data มี: { target: 'peer2', offer: {...}, from: 'peer1' }
    
    // หา socket.id ของ peer ปลายทาง
    const targetSocketId = peers.get(data.target);
    
    // ถ้าเจอ peer ปลายทาง ให้ส่ง offer ไป
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', {
        offer: data.offer,      // SDP offer object
        from: data.from         // บอกว่ามาจาก peer ไหน
      });
      console.log(`Offer sent from ${data.from} to ${data.target}`);
    }
  });
  
  // ────────────────────────────────────────────────────────────
  // 4.3 Event: 'answer' - ส่งต่อ SDP Answer
  // ────────────────────────────────────────────────────────────
  // เมื่อ peer2 สร้าง Answer และต้องการส่งกลับไปให้ peer1
  // Server ส่งต่อเหมือนกับ offer
  socket.on('answer', (data) => {
    // data มี: { target: 'peer1', answer: {...}, from: 'peer2' }
    
    const targetSocketId = peers.get(data.target);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', {
        answer: data.answer,    // SDP answer object
        from: data.from
      });
      console.log(`Answer sent from ${data.from} to ${data.target}`);
    }
  });
  
  // ────────────────────────────────────────────────────────────
  // 4.4 Event: 'ice-candidate' - ส่งต่อ ICE Candidate
  // ────────────────────────────────────────────────────────────
  // เมื่อ peer หนึ่งหา ICE candidate ได้ (เส้นทางการเชื่อมต่อที่เป็นไปได้)
  // ต้องส่งให้อีก peer เพื่อให้ลองเชื่อมต่อ
  socket.on('ice-candidate', (data) => {
    // data มี: { target: 'peer2', candidate: {...}, from: 'peer1' }
    
    const targetSocketId = peers.get(data.target);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate: data.candidate,  // ICE candidate object
        from: data.from
      });
      console.log(`ICE candidate sent from ${data.from} to ${data.target}`);
    }
  });
  
  // ────────────────────────────────────────────────────────────
  // 4.5 Event: 'disconnect' - จัดการเมื่อ Peer ตัดการเชื่อมต่อ
  // ────────────────────────────────────────────────────────────
  // เมื่อ peer ปิดหน้าเว็บหรือตัดการเชื่อมต่อ
  socket.on('disconnect', () => {
    // วนหา peerId ที่ใช้ socket.id นี้
    for (const [peerId, socketId] of peers.entries()) {
      if (socketId === socket.id) {
        // ลบ peer ออกจาก Map
        peers.delete(peerId);
        
        // แจ้งทุก peer อื่นๆ ว่า peer นี้ออกไปแล้ว
        socket.broadcast.emit('peer-left', peerId);
        
        console.log(`Peer disconnected: ${peerId}`);
        break;  // หยุดวนเมื่อเจอแล้ว
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 5. เริ่ม HTTP Server
// ══════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;  // ใช้ port 3000 หรือตาม environment variable
http.listen(PORT, () => {
  console.log(`Signalling Server running on http://localhost:${PORT}`);
  console.log('\nเปิด Peer1: http://localhost:3000/peer1.html');
  console.log('เปิด Peer2: http://localhost:3000/peer2.html');
});
