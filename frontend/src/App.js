
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const SERVER_URL = "http://localhost:5000";

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    socketRef.current.emit('join-room', 'my-room');

    socketRef.current.on('user-connected', (userId) => {
      callUser(userId);
    });

    socketRef.current.on('signal', (data) => {
      if (data.sdp) {
        peerRef.current.setRemoteDescription(new window.RTCSessionDescription(data.sdp)).then(() => {
          if (data.sdp.type === 'offer') {
            peerRef.current.createAnswer().then(answer => {
              peerRef.current.setLocalDescription(answer);
              socketRef.current.emit('signal', { sdp: answer });
            });
          }
        });
      } else if (data.candidate) {
        peerRef.current.addIceCandidate(new window.RTCIceCandidate(data.candidate));
      }
    });

    socketRef.current.on('chat-message', ({ id, message }) => {
      setMessages((prev) => [...prev, { id, message }]);
    });

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      localVideoRef.current.srcObject = stream;

      const peer = new window.RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.onicecandidate = event => {
        if (event.candidate) {
          socketRef.current.emit('signal', { candidate: event.candidate });
        }
      };

      peer.ontrack = event => {
        remoteVideoRef.current.srcObject = event.streams[0];
      };
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  function callUser(userId) {
    peerRef.current.createOffer().then(offer => {
      peerRef.current.setLocalDescription(offer);
      socketRef.current.emit('signal', { sdp: offer });
    });
  }

  function sendMessage() {
    socketRef.current.emit('chat-message', message);
    setMessages(prev => [...prev, { id: 'Me', message }]);
    setMessage('');
  }

  return (
    <div>
      <div>
        <video ref={localVideoRef} autoPlay muted style={{ width: 200, height: 150, backgroundColor: 'black' }} />
        <video ref={remoteVideoRef} autoPlay style={{ width: 200, height: 150, backgroundColor: 'black' }} />
      </div>
      <div>
        <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type message" />
        <button onClick={sendMessage}>Send</button>
      </div>
      <div>
        <h3>Messages</h3>
        {messages.map((m, i) => <div key={i}><b>{m.id}:</b> {m.message}</div>)}
      </div>
    </div>
  );
}

export default App;
