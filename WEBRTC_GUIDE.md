# 📖 คู่มือทำความเข้าใจ WebRTC แบบละเอียด

## 🎯 WebRTC คืออะไร?

**WebRTC (Web Real-Time Communication)** เป็นเทคโนโลยีที่ให้เบราว์เซอร์สามารถสื่อสารกันแบบ **Peer-to-Peer (P2P)** ได้โดยตรง โดยไม่ต้องผ่าน server กลาง

### ข้อดีของ WebRTC:
- ✅ **เร็ว** - ส่งข้อมูลตรงระหว่าง peer ไม่ผ่าน server
- ✅ **ปลอดภัย** - เข้ารหัสด้วย DTLS/SRTP อัตโนมัติ
- ✅ **Real-time** - เหมาะกับ video call, live streaming, gaming
- ✅ **ประหยัด bandwidth** - server ไม่ต้องส่งผ่านข้อมูล
- ✅ **รองรับหลายแพลตฟอร์ม** - เบราว์เซอร์, มือถือ, desktop

---

## 🏗️ สถาปัตยกรรมของ WebRTC

```
┌─────────┐                                    ┌─────────┐
│  Peer 1 │                                    │  Peer 2 │
└────┬────┘                                    └────┬────┘
     │                                              │
     │  ① Register                    ① Register   │
     │─────────────►┌──────────────┐◄──────────────│
     │              │  Signalling  │               │
     │  ② Offer     │    Server    │   ② Offer     │
     │─────────────►│  (Socket.io) │◄──────────────│
     │              └──────────────┘               │
     │  ③ Answer                      ③ Answer     │
     │◄─────────────┤              ├──────────────►│
     │              │              │               │
     │  ④ ICE       │              │   ④ ICE       │
     │  Candidates  │              │   Candidates  │
     │◄────────────►│              │◄─────────────►│
     │              └──────────────┘               │
     │                                              │
     │                ┌───────────┐                 │
     │  Query IP ────►│   STUN    │◄──── Query IP  │
     │                │  Server   │                 │
     │◄─── IP ────────└───────────┘────── IP ──────┤
     │                                              │
     │                                              │
     │  ⑤ ✨ Direct P2P Connection ✨              │
     │◄════════════════════════════════════════════►│
     │         (ข้อมูลส่งตรง ไม่ผ่าน server)        │
     └──────────────────────────────────────────────┘
```

---

## 📦 องค์ประกอบหลักของ WebRTC

### 1. RTCPeerConnection
**หัวใจของ WebRTC** - จัดการการเชื่อมต่อระหว่าง peer

```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:myturnserver.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
};

const peerConnection = new RTCPeerConnection(configuration);
```

**หน้าที่สำคัญ:**
- จัดการ ICE candidates
- สร้าง/รับ SDP offer/answer
- จัดการ media streams
- จัดการ data channels

### 2. RTCDataChannel
**สำหรับส่งข้อมูล** (ไม่ใช่ video/audio)

```javascript
// สร้าง data channel
const dataChannel = peerConnection.createDataChannel('chat', {
  ordered: true,        // ส่งตามลำดับ
  maxRetransmits: 3    // ส่งซ้ำสูงสุด 3 ครั้ง
});

dataChannel.onopen = () => {
  console.log('Channel opened!');
  dataChannel.send('Hello!');
};

dataChannel.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

**Use cases:**
- Chat applications
- File sharing
- Gaming (real-time game state)
- Collaborative editing

### 3. RTCSessionDescription (SDP)
**Session Description Protocol** - บรรยายข้อมูลการเชื่อมต่อ

**Offer SDP** (จาก initiator):
```
v=0
o=- 123456789 2 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE data
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:xyz
a=ice-pwd:abc123...
```

ข้อมูลที่มี:
- Codec ที่รองรับ
- Media types (audio/video/data)
- Network information
- Encryption keys

### 4. ICE Candidate
**Interactive Connectivity Establishment** - เส้นทางที่เป็นไปได้ในการเชื่อมต่อ

ประเภทของ ICE Candidates:

#### **Host Candidate** (เครือข่ายภายใน)
```javascript
{
  candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host",
  sdpMid: "data",
  sdpMLineIndex: 0
}
```
- IP ภายในเครือข่าย LAN
- เร็วที่สุด แต่ใช้ได้แค่ในเครือข่ายเดียวกัน

#### **Server Reflexive (srflx)** - จาก STUN
```javascript
{
  candidate: "candidate:2 1 UDP 1694498815 203.154.1.100 12345 typ srflx",
  sdpMid: "data",
  sdpMLineIndex: 0
}
```
- Public IP ที่ได้จาก STUN server
- ใช้เชื่อมต่อผ่าน internet

#### **Relay Candidate** - จาก TURN
```javascript
{
  candidate: "candidate:3 1 UDP 16777215 turn.server.com 3478 typ relay",
  sdpMid: "data",
  sdpMLineIndex: 0
}
```
- ส่งผ่าน TURN server
- ใช้เมื่อเชื่อมต่อตรงไม่ได้

---

## 🌐 STUN, TURN และ Signalling Server

### 1. STUN Server (Session Traversal Utilities for NAT)

**ทำงานอย่างไร:**
```
┌──────────┐         ┌──────────┐         ┌──────────┐
│   You    │         │   NAT    │         │   STUN   │
│192.168.1.│────────►│ Router   │────────►│  Server  │
│   100    │         │          │         │          │
└──────────┘         └──────────┘         └──────────┘
     ▲                                          │
     │         Your Public IP is:               │
     │         203.154.1.100:54321              │
     └──────────────────────────────────────────┘
```

**STUN ฟรีที่ใช้ได้:**
```javascript
{ urls: 'stun:stun.l.google.com:19302' }
{ urls: 'stun:stun1.l.google.com:19302' }
{ urls: 'stun:stun.services.mozilla.com' }
```

**ข้อจำกัด:**
- ไม่ช่วยอะไรถ้า NAT เป็น Symmetric NAT
- ไม่ส่งข้อมูลผ่าน STUN แค่ query IP

### 2. TURN Server (Traversal Using Relays around NAT)

**ทำงานอย่างไร:**
```
Peer 1 ──►  TURN Server  ◄── Peer 2
           (relay data)
```

**เมื่อไหร่ต้องใช้:**
- Corporate firewall ที่บล็อก P2P
- Symmetric NAT (ประมาณ 8-10% ของกรณี)
- Mobile networks ที่เข้มงวด

**ตั้ง TURN Server เอง (ใช้ coturn):**
```bash
# Ubuntu/Debian
sudo apt-get install coturn

# Configuration (/etc/turnserver.conf)
listening-port=3478
external-ip=YOUR_SERVER_IP
realm=yourdomain.com
user=username:password
```

**TURN Services แบบเสียเงิน:**
- Twilio TURN
- Xirsys
- Metered.ca

### 3. Signalling Server

**หน้าที่:**
- แลกเปลี่ยน SDP (Offer/Answer)
- แลกเปลี่ยน ICE Candidates
- จัดการ peer discovery
- **ไม่ส่งผ่านข้อมูลจริง** (แค่จับคู่ peer)

**เทคโนโลยีที่ใช้ได้:**
- ✅ WebSocket / Socket.io (ตัวอย่างนี้ใช้)
- ✅ HTTP Long Polling
- ✅ Server-Sent Events (SSE)
- ✅ Firebase Realtime Database
- ✅ PubNub, Pusher

---

## 🔄 ขั้นตอนการเชื่อมต่อแบบละเอียด

### Phase 1: Signalling และ SDP Exchange

**1.1 Peer1 สร้าง Offer:**
```javascript
// Peer1: สร้าง offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

// ส่งผ่าน Signalling Server
socket.emit('offer', {
  target: 'peer2',
  offer: offer
});
```

**1.2 Peer2 รับ Offer และสร้าง Answer:**
```javascript
// Peer2: รับ offer
socket.on('offer', async (data) => {
  await peerConnection.setRemoteDescription(data.offer);
  
  // สร้าง answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  
  // ส่ง answer กลับ
  socket.emit('answer', {
    target: 'peer1',
    answer: answer
  });
});
```

**1.3 Peer1 รับ Answer:**
```javascript
// Peer1: รับ answer
socket.on('answer', async (data) => {
  await peerConnection.setRemoteDescription(data.answer);
  // พร้อมเชื่อมต่อ!
});
```

### Phase 2: ICE Gathering และ Exchange

**2.1 เก็บ ICE Candidates:**
```javascript
peerConnection.onicecandidate = (event) => {
  if (event.candidate) {
    // ส่งไปให้ peer อื่น
    socket.emit('ice-candidate', {
      target: remotePeerId,
      candidate: event.candidate
    });
  } else {
    // ICE gathering เสร็จสิ้น
    console.log('ICE gathering complete');
  }
};
```

**2.2 รับและเพิ่ม ICE Candidates:**
```javascript
socket.on('ice-candidate', async (data) => {
  if (data.candidate) {
    await peerConnection.addIceCandidate(
      new RTCIceCandidate(data.candidate)
    );
  }
});
```

### Phase 3: Connection Establishment

**3.1 ติดตาม Connection State:**
```javascript
peerConnection.onconnectionstatechange = () => {
  const state = peerConnection.connectionState;
  console.log('Connection state:', state);
  
  // States: new -> connecting -> connected -> disconnected -> closed
  if (state === 'connected') {
    console.log('✅ P2P connection established!');
  }
};

peerConnection.oniceconnectionstatechange = () => {
  const state = peerConnection.iceConnectionState;
  console.log('ICE state:', state);
  
  // States: new -> checking -> connected -> completed
};
```

### Phase 4: Data Transfer

**4.1 ส่งข้อมูล:**
```javascript
if (dataChannel.readyState === 'open') {
  // ส่งข้อความ
  dataChannel.send('Hello!');
  
  // ส่ง JSON
  dataChannel.send(JSON.stringify({ type: 'message', data: 'Hi' }));
  
  // ส่ง binary data
  const buffer = new ArrayBuffer(100);
  dataChannel.send(buffer);
}
```

---

## 🎓 Best Practices

### 1. Error Handling
```javascript
async function createOffer() {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    return offer;
  } catch (error) {
    console.error('Error creating offer:', error);
    
    // Retry logic
    if (error.name === 'InvalidStateError') {
      // Reset and try again
      peerConnection.close();
      await createPeerConnection();
      return createOffer();
    }
    
    throw error;
  }
}
```

### 2. Connection Timeout
```javascript
function waitForConnection(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeoutMs);
    
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        clearTimeout(timeout);
        resolve();
      } else if (peerConnection.connectionState === 'failed') {
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
      }
    };
  });
}
```

### 3. Reconnection Logic
```javascript
peerConnection.oniceconnectionstatechange = () => {
  if (peerConnection.iceConnectionState === 'disconnected') {
    console.log('Connection lost, attempting to reconnect...');
    
    // ICE restart
    const offer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(offer);
    // ส่ง offer ใหม่ผ่าน signalling
  }
};
```

### 4. Cleanup
```javascript
function cleanup() {
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Clear event listeners
  socket.off('offer');
  socket.off('answer');
  socket.off('ice-candidate');
}
```

---

## 🚀 ทำโปรเจคใหญ่ขึ้น

### 1. Video Chat Application

```javascript
// ขอ permission กล้อง/ไมค์
const stream = await navigator.mediaDevices.getUserMedia({
  video: { width: 1280, height: 720 },
  audio: {
    echoCancellation: true,
    noiseSuppression: true
  }
});

// เพิ่ม tracks เข้า peer connection
stream.getTracks().forEach(track => {
  peerConnection.addTrack(track, stream);
});

// แสดงวิดีโอของตัวเอง
localVideo.srcObject = stream;

// รับวิดีโอจาก peer
peerConnection.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};
```

### 2. Screen Sharing

```javascript
async function startScreenShare() {
  const screenStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: 'always',
      displaySurface: 'monitor'
    },
    audio: true
  });
  
  // เปลี่ยน video track
  const videoTrack = screenStream.getVideoTracks()[0];
  const sender = peerConnection.getSenders()
    .find(s => s.track?.kind === 'video');
  
  await sender.replaceTrack(videoTrack);
  
  // ตรวจจับเมื่อหยุด share
  videoTrack.onended = () => {
    stopScreenShare();
  };
}
```

### 3. File Sharing

```javascript
async function sendFile(file) {
  const chunkSize = 16384; // 16KB chunks
  const fileReader = new FileReader();
  let offset = 0;
  
  // ส่ง metadata ก่อน
  dataChannel.send(JSON.stringify({
    type: 'file-start',
    name: file.name,
    size: file.size,
    type: file.type
  }));
  
  // ส่งทีละ chunk
  fileReader.onload = (e) => {
    dataChannel.send(e.target.result);
    offset += e.target.result.byteLength;
    
    if (offset < file.size) {
      readSlice(offset);
    } else {
      dataChannel.send(JSON.stringify({ type: 'file-end' }));
    }
  };
  
  const readSlice = (o) => {
    const slice = file.slice(o, o + chunkSize);
    fileReader.readAsArrayBuffer(slice);
  };
  
  readSlice(0);
}
```

### 4. Multi-peer (Group Call)

**Mesh Topology** - แต่ละ peer เชื่อมกับทุก peer:
```
Peer1 ←→ Peer2
  ↕        ↕
Peer3 ←→ Peer4

// ข้อดี: ง่าย, latency ต่ำ
// ข้อเสีย: ใช้ bandwidth มาก (N² connections)
```

**SFU (Selective Forwarding Unit)**:
```
Peer1 ──┐
Peer2 ──┼──► SFU ──┬──► ส่งต่อให้ทุก peer
Peer3 ──┘          └──► (แต่ละ peer ส่ง 1 stream)

// ข้อดี: ประหยัด bandwidth
// ข้อเสีย: ต้องมี server (ใช้ Mediasoup, Janus)
```

### 5. สร้าง Signalling Server ที่ดีขึ้น

```javascript
// server.js - production ready
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Room management
const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(userId);
    
    // บอก peers ที่อยู่ใน room ว่ามีคนใหม่เข้ามา
    socket.to(roomId).emit('user-joined', userId);
    
    // ส่งรายชื่อคนใน room ให้คนใหม่
    const users = Array.from(rooms.get(roomId));
    socket.emit('room-users', users.filter(id => id !== userId));
  });
  
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      from: data.from
    });
  });
  
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      from: data.from
    });
  });
  
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      from: data.from
    });
  });
  
  socket.on('disconnect', () => {
    // ลบ user ออกจากทุก room
    rooms.forEach((users, roomId) => {
      users.forEach(userId => {
        socket.to(roomId).emit('user-left', userId);
      });
    });
  });
});
```

---

## 🔍 Debugging Tips

### 1. ดู WebRTC Internals
เปิด Chrome และไปที่: `chrome://webrtc-internals`

ดูได้:
- ICE candidates ทั้งหมด
- Connection stats
- Bandwidth usage
- Packet loss
- Codec information

### 2. Log ทุกอย่าง
```javascript
peerConnection.addEventListener('icecandidateerror', (event) => {
  console.error('ICE candidate error:', event);
});

peerConnection.addEventListener('icegatheringstatechange', () => {
  console.log('ICE gathering state:', peerConnection.iceGatheringState);
});

peerConnection.addEventListener('signalingstatechange', () => {
  console.log('Signaling state:', peerConnection.signalingState);
});
```

### 3. ตรวจสอบ Network
```javascript
peerConnection.getStats().then(stats => {
  stats.forEach(stat => {
    if (stat.type === 'candidate-pair' && stat.nominated) {
      console.log('Active connection:', stat);
      console.log('RTT:', stat.currentRoundTripTime);
      console.log('Bytes sent:', stat.bytesSent);
      console.log('Bytes received:', stat.bytesReceived);
    }
  });
});
```

---

## 📚 แหล่งเรียนรู้เพิ่มเติม

### Documentation
- [WebRTC API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [WebRTC for the Curious](https://webrtcforthecurious.com/)

### ไลบรารี่ที่น่าสนใจ
- **Simple-peer** - WebRTC wrapper ที่ใช้งานง่าย
- **PeerJS** - ทำ peer-to-peer ได้ง่ายมาก
- **Mediasoup** - SFU สำหรับ group call
- **Janus Gateway** - WebRTC gateway/SFU

### โปรเจคตัวอย่าง
1. **Video Chat App** - Zoom clone
2. **File Sharing** - P2P file transfer
3. **Live Streaming** - Twitch-like platform
4. **Collaborative Whiteboard** - Real-time drawing
5. **Multiplayer Game** - Real-time game state sync

---

## 💡 สรุป

WebRTC ไม่ยากอย่างที่คิด! จำหลักการสำคัญ:

1. **Signalling Server** = จัดการจับคู่ peer (แค่ตอนเริ่มต้น)
2. **STUN** = หา public IP (ฟรี, ใช้ของ Google ได้)
3. **TURN** = relay ข้อมูล (ใช้เมื่อจำเป็น, ต้องเสียเงิน)
4. **RTCPeerConnection** = หัวใจของ WebRTC
5. **SDP Exchange** = Offer → Answer
6. **ICE Candidates** = หาเส้นทางที่ดีที่สุด
7. **P2P Connection** = ส่งข้อมูลตรง เร็ว ปลอดภัย

เริ่มจากโปรเจคเล็กๆ แล้วค่อยๆ ขยาย จะเข้าใจมากขึ้นเรื่อยๆ! 🚀
