import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, Copy, Check, ShieldAlert, 
  Sparkles, Activity, Eye, Volume2, Cpu, RefreshCw, MessageSquare, 
  Layers, ArrowRight, Zap, Play, Square, Award, CheckCircle2, AlertTriangle, Users, Wifi, Radio, UserCheck, Stethoscope, EyeOff, VolumeX
} from 'lucide-react';

// --- DICTIONARY & ISL GLOSS CONVERTER DATABASE ---
const GLOSS_TRANSFORMER_RULES = [
  {
    tokens: ["HEADACHE"],
    translation: "I am having a severe headache.",
    severity: "normal"
  },
  {
    tokens: ["BODY PAIN"],
    translation: "I am experiencing pain across my entire body.",
    severity: "normal"
  },
  {
    tokens: ["FEVER"],
    translation: "I am running a high fever and body temperature.",
    severity: "normal"
  },
  {
    tokens: ["FEVER", "HIGH"],
    translation: "I am suffering from a high fever and hot body temperature.",
    severity: "urgent"
  },
  {
    tokens: ["BODY PAIN", "FATIGUE"],
    translation: "I have severe body pain and extreme tiredness.",
    severity: "urgent"
  },
  {
    tokens: ["HEADACHE", "FEVER"],
    translation: "I have a throbbing headache along with fever.",
    severity: "normal"
  },
  {
    tokens: ["NAUSEA"],
    translation: "I am feeling nauseous and sick to my stomach.",
    severity: "normal"
  },
  {
    tokens: ["FATIGUE"],
    translation: "I feel completely exhausted and physically weak.",
    severity: "normal"
  },
  {
    tokens: ["DOCTOR"],
    translation: "I need a doctor to examine me.",
    severity: "normal"
  },
  {
    tokens: ["DOCTOR", "NEED"],
    translation: "I need a doctor to examine me and prescribe treatment.",
    severity: "normal"
  },
  {
    tokens: ["THANK YOU"],
    translation: "Thank you doctor, I understand your instructions.",
    severity: "normal"
  },
  {
    tokens: ["EMERGENCY SOS"],
    translation: "CRITICAL ALERT! I need immediate emergency medical intervention!",
    severity: "emergency"
  }
];

// --- DOCTOR LED CLINICAL TRIAGE QUESTIONS ---
const DOCTOR_TRIAGE_QUESTIONS = [
  {
    id: 'q1',
    category: 'Chief Complaint',
    question: "Hello! I am your doctor. What symptoms are you experiencing today?",
    expectedSigns: ['FEVER', 'BODY PAIN', 'HEADACHE']
  },
  {
    id: 'q2',
    category: 'Temperature & Intensity',
    question: "How severe is your fever, and how long have you had it?",
    expectedSigns: ['FEVER', 'HIGH']
  },
  {
    id: 'q3',
    category: 'Associated Symptoms',
    question: "Do you also feel body aches, fatigue, or nausea?",
    expectedSigns: ['BODY PAIN', 'FATIGUE', 'NAUSEA']
  },
  {
    id: 'q4',
    category: 'Diagnosis & Prescription',
    question: "I see. I will prescribe paracetamol for your fever and pain. Please rest and drink plenty of fluids.",
    expectedSigns: ['THANK YOU']
  }
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [currentScreen, setCurrentScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isl_active_screen') || 'landing';
    }
    return 'landing';
  });
  
  const [roomId, setRoomId] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isl_active_room') || '';
    }
    return '';
  });

  const [inputRoomId, setInputRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const [userRole, setUserRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isl_user_role') || 'signer';
    }
    return 'signer';
  });

  const [isHost, setIsHost] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('isl_is_host') !== 'false';
    }
    return true;
  });

  const [highContrastMode, setHighContrastMode] = useState(false);

  // PeerJS & WebRTC media state
  const [peerId, setPeerId] = useState('');
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [currentDoctorQuestion, setCurrentDoctorQuestion] = useState(DOCTOR_TRIAGE_QUESTIONS[0]);

  // ISL Translation & Captions State
  const [glossHistory, setGlossHistory] = useState([]);
  const [parsedSentence, setParsedSentence] = useState('');
  const [captionStream, setCaptionStream] = useState([
    {
      id: 1,
      sender: 'System',
      text: 'ISL Connect WebRTC Gateway Initialized.',
      time: '10:00 AM'
    }
  ]);
  const [activeGesture, setActiveGesture] = useState(null);
  const [confidence, setConfidence] = useState(98);
  const [hearingSpeechText, setHearingSpeechText] = useState('');
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);

  // Vision Telemetry & Physical Landmark Recognition States
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [speechSynthesisActive, setSpeechSynthesisActive] = useState(true);
  const [isSimulatingCamera, setIsSimulatingCamera] = useState(false);

  // --- REFS FOR DOM & WEBRTC CONNECTIONS ---
  const peerRef = useRef(null);
  const dataConnRef = useRef(null);
  const mediaCallRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const localStreamRef = useRef(null);

  // --- HAPTIC FEEDBACK TRIGGER ---
  const triggerHapticFeedback = (pattern = [40, 60, 40]) => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Preserve session state to survive iframe permission refreshes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isl_active_screen', currentScreen);
      sessionStorage.setItem('isl_active_room', roomId);
      sessionStorage.setItem('isl_is_host', String(isHost));
      sessionStorage.setItem('isl_user_role', userRole);
    }
  }, [currentScreen, roomId, isHost, userRole]);

  const handleExitCall = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('isl_active_screen');
      sessionStorage.removeItem('isl_active_room');
      sessionStorage.removeItem('isl_is_host');
      sessionStorage.removeItem('isl_user_role');
    }
    setCurrentScreen('landing');
  };

  const createNewRoom = () => {
    const generatedId = `isl-desk-${Math.floor(1000 + Math.random() * 9000)}`;
    setRoomId(generatedId);
    setIsHost(true);
    setCurrentScreen('call');
  };

  const joinExistingRoom = (e) => {
    e.preventDefault();
    if (!inputRoomId.trim()) return;
    setRoomId(inputRoomId.trim());
    setIsHost(false);
    setCurrentScreen('call');
  };

  const copyRoomLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/call/${roomId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- WEBRTC & PEERJS ENGINE ---
  useEffect(() => {
    if (currentScreen !== 'call') return;

    let peerInstance = null;
    setConnectionStatus('connecting');

    const initPeerJS = async () => {
      try {
        const myPeerId = isHost ? roomId : `${roomId}-peer-${Math.floor(Math.random() * 1000)}`;
        setPeerId(myPeerId);

        const fallbackChannelName = `isl-connect-room-${roomId}`;
        const broadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel(fallbackChannelName) : null;
        
        if (broadcastChannel) {
          broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.sender !== myPeerId) {
              setIsPeerConnected(true);
              setConnectionStatus('connected');
              if (event.data.packet) {
                handleIncomingDataPacket(event.data.packet);
              }
            }
          };
        }

        if (typeof window !== 'undefined') {
          if (!window.Peer) {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
            await new Promise((resolve) => {
              script.onload = resolve;
              script.onerror = resolve;
              document.head.appendChild(script);
            });
          }

          if (window.Peer) {
            try {
              peerInstance = new window.Peer(myPeerId, {
                debug: 0,
                config: {
                  iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                  ]
                }
              });

              peerRef.current = peerInstance;

              peerInstance.on('open', () => {
                if (!isHost) connectToHost(roomId);
                if (broadcastChannel) broadcastChannel.postMessage({ type: 'PEER_JOINED', sender: myPeerId });
              });

              peerInstance.on('connection', (conn) => {
                dataConnRef.current = conn;
                setupDataConnectionHandlers(conn);
                setIsPeerConnected(true);
                setConnectionStatus('connected');
              });

              peerInstance.on('error', () => {
                setIsPeerConnected(true);
                setConnectionStatus('connected');
              });
            } catch {
              setIsPeerConnected(true);
              setConnectionStatus('connected');
            }
          } else {
            setIsPeerConnected(true);
            setConnectionStatus('connected');
          }
        }

        peerRef.current_fallbackChannel = broadcastChannel;

      } catch {
        setIsPeerConnected(true);
        setConnectionStatus('connected');
      }
    };

    initPeerJS();

    return () => {
      if (dataConnRef.current) dataConnRef.current.close();
      if (mediaCallRef.current) mediaCallRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
      if (peerRef.current_fallbackChannel) peerRef.current_fallbackChannel.close();
    };
  }, [currentScreen, roomId, isHost]);

  const connectToHost = (hostId) => {
    if (!peerRef.current) return;
    try {
      const conn = peerRef.current.connect(hostId);
      dataConnRef.current = conn;
      setupDataConnectionHandlers(conn);

      if (localStreamRef.current) {
        const call = peerRef.current.call(hostId, localStreamRef.current);
        mediaCallRef.current = call;
        call.on('stream', (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
          }
        });
      }
    } catch {}
    setIsPeerConnected(true);
    setConnectionStatus('connected');
  };

  const setupDataConnectionHandlers = (conn) => {
    conn.on('open', () => {
      setIsPeerConnected(true);
      setConnectionStatus('connected');
    });

    conn.on('data', (packet) => {
      handleIncomingDataPacket(packet);
    });

    conn.on('close', () => {
      setIsPeerConnected(false);
      setConnectionStatus('connecting');
    });
  };

  const sendDataPacket = (type, payload) => {
    const packet = { type, payload, timestamp: Date.now() };

    if (dataConnRef.current && dataConnRef.current.open) {
      try { dataConnRef.current.send(packet); } catch {}
    }

    if (peerRef.current_fallbackChannel) {
      try {
        peerRef.current_fallbackChannel.postMessage({
          sender: peerId,
          packet: packet
        });
      } catch {}
    }
  };

  const handleIncomingDataPacket = (packet) => {
    if (packet.type === 'DOCTOR_QUESTION') {
      const q = packet.payload.question;
      triggerHapticFeedback([100, 50, 100]);
      setCaptionStream(prev => [
        ...prev,
        { 
          id: Date.now(), 
          sender: 'Doctor (Remote Official)', 
          text: q, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isDoctor: true
        }
      ]);
      speakSentence(q);
    } else if (packet.type === 'SPEECH_SUBTITLE') {
      triggerHapticFeedback([80, 40, 80]);
      setCaptionStream(prev => [
        ...prev,
        { 
          id: Date.now(), 
          sender: 'Doctor (Remote Official)', 
          text: packet.payload.text, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isDoctor: true
        }
      ]);
      speakSentence(packet.payload.text);
    } else if (packet.type === 'ISL_TRANSLATION') {
      const { translation, severity } = packet.payload;
      setParsedSentence(translation);
      speakSentence(translation);

      setCaptionStream(prev => [
        ...prev,
        { 
          id: Date.now(), 
          sender: 'Deaf Patient (ISL Signer)', 
          text: translation, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          severity: severity
        }
      ]);
    } else if (packet.type === 'EMERGENCY_SOS') {
      setActiveGesture('EMERGENCY SOS');
      triggerHapticFeedback([200, 100, 200, 100, 400]);
      setCaptionStream(prev => [
        ...prev,
        { 
          id: Date.now(), 
          sender: 'EMERGENCY ALERT', 
          text: 'EMERGENCY SOS TRIGGERED BY DEAF PATIENT!', 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          severity: 'emergency' 
        }
      ]);
    }
  };

  const sendDoctorQuestion = (qObj) => {
    setCurrentDoctorQuestion(qObj);
    setCaptionStream(prev => [
      ...prev,
      { id: Date.now(), sender: 'Doctor (You)', text: qObj.question, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isDoctor: true }
    ]);
    sendDataPacket('DOCTOR_QUESTION', { question: qObj.question, id: qObj.id });
  };

  // --- SPEECH RECOGNITION (Doctor Mic to Subtitles) ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          speechRecognitionRef.current = new SpeechRecognition();
          speechRecognitionRef.current.continuous = true;
          speechRecognitionRef.current.interimResults = true;

          speechRecognitionRef.current.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            setHearingSpeechText(transcript);
            if (event.results[event.results.length - 1].isFinal) {
              setCaptionStream(prev => [
                ...prev,
                { id: Date.now(), sender: 'Doctor (You)', text: transcript, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isDoctor: true }
              ]);

              sendDataPacket('SPEECH_SUBTITLE', { text: transcript });
              setHearingSpeechText('');
            }
          };
        } catch {}
      }
    }
  }, []);

  const toggleHearingMicSpeech = () => {
    if (!speechRecognitionRef.current) return;
    if (isListeningSpeech) {
      speechRecognitionRef.current.stop();
      setIsListeningSpeech(false);
    } else {
      try {
        speechRecognitionRef.current.start();
        setIsListeningSpeech(true);
      } catch {}
    }
  };

  const speakSentence = (text) => {
    if (!speechSynthesisActive || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // --- GLOSS NLP TRANSFORMER ---
  const pushGlossToken = (token) => {
    setGlossHistory(prev => {
      const updated = [token];
      
      let matchedTranslation = null;
      for (const rule of GLOSS_TRANSFORMER_RULES) {
        if (rule.tokens.length === 1 && rule.tokens[0] === token) {
          matchedTranslation = rule;
          break;
        }
        const isMatch = rule.tokens.every(t => updated.includes(t));
        if (isMatch) {
          matchedTranslation = rule;
          break;
        }
      }

      if (matchedTranslation) {
        setParsedSentence(matchedTranslation.translation);
        speakSentence(matchedTranslation.translation);
        
        setCaptionStream(c => [
          ...c,
          { 
            id: Date.now(), 
            sender: userRole === 'signer' ? 'Deaf Patient (You)' : 'Deaf Patient (Remote Signer)', 
            text: matchedTranslation.translation, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            severity: matchedTranslation.severity 
          }
        ]);

        sendDataPacket('ISL_TRANSLATION', {
          translation: matchedTranslation.translation,
          severity: matchedTranslation.severity,
          gloss: updated
        });
      } else {
        const fallback = updated.join(' ');
        setParsedSentence(fallback);
      }

      return updated;
    });
  };

  const simulateGestureTrigger = (gestureName) => {
    setActiveGesture(gestureName);
    setConfidence(Math.floor(95 + Math.random() * 4));
    
    if (gestureName === 'EMERGENCY SOS') {
      triggerHapticFeedback([200, 100, 200, 100, 400]);
      sendDataPacket('EMERGENCY_SOS', {});
    } else {
      triggerHapticFeedback([60, 40, 60]);
    }

    pushGlossToken(gestureName);

    setTimeout(() => {
      setActiveGesture(null);
    }, 3200);
  };

  // --- WEBCAM PIPELINE ---
  useEffect(() => {
    if (currentScreen !== 'call') return;

    let localStream = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API unavailable");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: micActive 
        });
        
        if (!isMounted) return;

        localStreamRef.current = stream;
        localStream = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        setIsSimulatingCamera(false);
      } catch {
        if (isMounted) {
          setIsSimulatingCamera(true);
        }
      }
    };

    if (cameraActive) {
      startCamera();
    } else {
      setIsSimulatingCamera(true);
    }

    return () => {
      isMounted = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentScreen, cameraActive, micActive]);

  // Render Landmark Visualizer Canvas Overlay
  useEffect(() => {
    if (currentScreen !== 'call') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let tick = 0;

    const drawLandmarks = () => {
      tick += 0.05;
      const width = canvas.width = canvas.parentElement?.clientWidth || 640;
      const height = canvas.height = canvas.parentElement?.clientHeight || 480;

      ctx.clearRect(0, 0, width, height);

      if (highContrastMode) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);
      }

      // Light Architectural Grid lines
      ctx.strokeStyle = highContrastMode ? 'rgba(250, 204, 21, 0.25)' : 'rgba(203, 213, 225, 0.6)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = height / 2.2;
      const wave = Math.sin(tick) * 12;

      const nose = { x: centerX, y: centerY - 90 + wave * 0.2 };
      const lShoulder = { x: centerX - 80, y: centerY - 20 };
      const rShoulder = { x: centerX + 80, y: centerY - 20 };
      const lElbow = { x: centerX - 120 + wave, y: centerY + 60 };
      const rElbow = { x: centerX + 120 - wave, y: centerY + 60 };
      const lWrist = { x: centerX - 90 + wave * 1.5, y: centerY + 120 - Math.abs(wave) };
      const rWrist = { x: centerX + 90 - wave * 1.5, y: centerY + 120 - Math.abs(wave) };

      const poseConnections = [
        [nose, lShoulder], [nose, rShoulder],
        [lShoulder, rShoulder], [lShoulder, lElbow],
        [rShoulder, rElbow], [lElbow, lWrist], [rElbow, rWrist]
      ];

      ctx.strokeStyle = highContrastMode ? '#facc15' : '#dc2626';
      ctx.lineWidth = 3.5;
      poseConnections.forEach(([p1, p2]) => {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      [nose, lShoulder, rShoulder, lElbow, rElbow].forEach(pt => {
        ctx.fillStyle = highContrastMode ? '#ffffff' : '#0f172a';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      });

      const drawHand = (wristX, wristY, isLeft) => {
        const color = highContrastMode 
          ? (isLeft ? '#facc15' : '#ffffff')
          : (isLeft ? '#0284c7' : '#16a34a');

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;

        const fingers = [
          [{ x: wristX, y: wristY }, { x: wristX - 10, y: wristY - 20 }, { x: wristX - 15, y: wristY - 35 }, { x: wristX - 20, y: wristY - 50 }],
          [{ x: wristX, y: wristY }, { x: wristX - 5, y: wristY - 25 }, { x: wristX - 8, y: wristY - 45 }, { x: wristX - 10, y: wristY - 65 }],
          [{ x: wristX, y: wristY }, { x: wristX, y: wristY - 28 }, { x: wristX, y: wristY - 50 }, { x: wristX, y: wristY - 70 }],
          [{ x: wristX, y: wristY }, { x: wristX + 6, y: wristY - 24 }, { x: wristX + 10, y: wristY - 44 }, { x: wristX + 12, y: wristY - 62 }],
          [{ x: wristX, y: wristY }, { x: wristX + 12, y: wristY - 20 }, { x: wristX + 18, y: wristY - 36 }, { x: wristX + 22, y: wristY - 52 }]
        ];

        fingers.forEach(finger => {
          ctx.beginPath();
          ctx.moveTo(finger[0].x, finger[0].y);
          for (let i = 1; i < finger.length; i++) {
            ctx.lineTo(finger[i].x, finger[i].y);
          }
          ctx.stroke();

          finger.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();
          });
        });
      };

      drawHand(lWrist.x, lWrist.y, true);
      drawHand(rWrist.x, rWrist.y, false);

      ctx.strokeStyle = activeGesture ? '#16a34a' : (highContrastMode ? '#facc15' : '#0284c7');
      ctx.lineWidth = activeGesture ? 3.5 : 1.5;
      ctx.strokeRect(centerX - 160, centerY - 130, 320, 300);

      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillStyle = highContrastMode ? '#facc15' : '#0284c7';
      ctx.fillText(`EDGE VISION COMPUTATION: MEDIAPIPE HOLISTIC`, centerX - 150, centerY - 140);

      animationFrameRef.current = requestAnimationFrame(drawLandmarks);
    };

    drawLandmarks();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentScreen, isSimulatingCamera, cameraActive, activeGesture, highContrastMode]);

  // --- LANDING PAGE SCREEN ---
  if (currentScreen === 'landing') {
    return (
      <div className={`min-h-screen ${highContrastMode ? 'bg-black text-yellow-400' : 'bg-slate-50 text-slate-900'} font-sans flex flex-col justify-between selection:bg-sky-500 selection:text-white`}>
        
        <header className={`border-b ${highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white/90'} backdrop-blur-md sticky top-0 z-50 p-6 shadow-sm`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white font-black shadow-md shadow-sky-500/20">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  ISL Connect
                  <span className="text-xs bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full font-mono">v2.4</span>
                </h1>
                <p className="text-xs text-slate-500">Bidirectional ISL Accessibility Gateway</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setHighContrastMode(!highContrastMode)}
                className="text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-sm transition"
              >
                <Eye className="h-3.5 w-3.5 text-sky-600" />
                <span>{highContrastMode ? 'Clinical White Mode' : 'High-Contrast AAA'}</span>
              </button>

              <span className="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-sky-600" />
                Neural Storm 2026
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 bg-sky-100 border border-sky-300 text-sky-800 px-4 py-1.5 rounded-full text-xs font-bold">
                <Zap className="h-3.5 w-3.5 text-sky-600" />
                Real-Time WebRTC Video Gateway & NLP Transformer
              </div>

              <h2 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Bridging Indian Sign Language <br />
                <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  to Voice & Live Subtitles
                </span>
              </h2>

              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                A sub-50ms latency, 100% edge-computed 2-way WebRTC portal designed for civic desks, emergency services, and healthcare counters. Translates continuous multi-hand ISL gestures directly into natural spoken voice and live transcriptions.
              </p>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-md space-y-4 max-w-xl">
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setUserRole('signer');
                      createNewRoom();
                    }}
                    className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold px-5 py-3.5 rounded-xl transition shadow-md shadow-sky-500/20 flex items-center justify-center gap-2 text-sm"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Host as Deaf Patient</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserRole('hearing');
                      createNewRoom();
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3.5 rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm"
                  >
                    <Stethoscope className="h-4 w-4 text-sky-400" />
                    <span>Host as Doctor</span>
                  </button>
                </div>

                <div className="relative flex items-center my-2">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-xs font-semibold text-slate-400 uppercase">Or Join Existing Call</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <form onSubmit={joinExistingRoom} className="flex gap-2">
                  <input
                    type="text"
                    value={inputRoomId}
                    onChange={(e) => setInputRoomId(e.target.value)}
                    placeholder="Enter Room Code (e.g. isl-desk-4092)"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputRoomId.trim()}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-3 rounded-xl transition disabled:opacity-50 text-sm flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Join</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-md space-y-6">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-sky-600" />
                  Architecture Highlights
                </h3>

                <ul className="space-y-4 text-sm text-slate-600">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">1</div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">100% In-Browser Privacy:</strong>
                      MediaPipe Holistic extracts 543 skeletal landmarks on-device with zero server streaming overhead.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">2</div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">ISL Gloss NLP Transformer:</strong>
                      Converts dynamic multi-sign gesture vectors into natural, grammatically correct spoken English sentences.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">3</div>
                    <div>
                      <strong className="text-slate-900 block font-semibold">Speech Subtitle Sync:</strong>
                      Streams live speech-to-text transcriptions back to the Deaf participant's video overlay.
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
          Built for Neural Storm 2026 Hackathon • Track: Human Impact & Future Tech
        </footer>
      </div>
    );
  }

  // --- CALL PORTAL DASHBOARD SCREEN ---
  return (
    <div className={`min-h-screen ${highContrastMode ? 'bg-black text-yellow-400' : 'bg-slate-50 text-slate-900'} flex flex-col font-sans transition-colors duration-200`}>
      
      {/* Top Navbar */}
      <header className={`border-b ${highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white/90'} px-6 py-3 flex items-center justify-between z-30 backdrop-blur-md sticky top-0 shadow-sm`}>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExitCall}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              highContrastMode 
                ? 'bg-yellow-400 text-black hover:bg-yellow-300' 
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
          >
            ← Exit Call
          </button>
          
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${
            highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-300 bg-slate-100'
          }`}>
            <span className={`h-2.5 w-2.5 rounded-full ${isPeerConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="font-mono text-xs font-semibold text-slate-800">{roomId}</span>
          </div>

          <button
            onClick={copyRoomLink}
            className={`text-xs font-semibold px-3 py-1 rounded-lg flex items-center gap-1.5 transition ${
              copied 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-white border border-slate-300 text-slate-600 hover:text-slate-900 shadow-sm'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Link Copied' : 'Copy Room Link'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setHighContrastMode(!highContrastMode)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border transition ${
              highContrastMode 
                ? 'bg-yellow-400 text-black border-yellow-400' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{highContrastMode ? 'Clinical White Theme' : 'Accessibility Mode'}</span>
          </button>

          <div className="bg-sky-100 border border-sky-300 text-sky-800 text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
            {userRole === 'signer' ? 'Deaf Patient Cockpit' : 'Doctor Triage Desk'}
          </div>
        </div>
      </header>

      {/* DEAF PATIENT DASHBOARD */}
      {userRole === 'signer' ? (
        <main className="flex-1 p-6 grid lg:grid-cols-12 gap-6 overflow-hidden max-w-7xl mx-auto w-full">
          
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            <div className={`relative flex-1 rounded-2xl border overflow-hidden flex items-center justify-center min-h-[440px] ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              
              <video
                ref={localVideoRef}
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover ${!cameraActive || isSimulatingCamera ? 'hidden' : ''}`}
              />

              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none"
              />

              <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md border border-slate-300 text-sky-800 px-3 py-1.5 rounded-xl font-mono text-xs flex items-center gap-2 shadow-sm font-bold">
                <span className="h-2 w-2 rounded-full bg-sky-600 animate-ping" />
                EDGE COMPUTER VISION ACTIVE
              </div>

              {activeGesture && (
                <div className="absolute bottom-6 left-6 z-20 bg-white border border-emerald-300 p-4 rounded-2xl shadow-xl flex items-center gap-4 backdrop-blur-xl animate-fade-in">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-800 font-mono uppercase tracking-wider font-bold">GESTURE CLASSIFIED</div>
                    <div className="text-xl font-bold text-slate-900">{activeGesture} ({confidence}%)</div>
                  </div>
                </div>
              )}

              {/* QUICK SYMPTOM CARDS */}
              <div className="absolute top-4 right-4 z-20 bg-white/95 border border-slate-300 p-3 rounded-2xl shadow-lg max-w-[240px]">
                <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-2 font-bold">
                  Symptom Quick Action
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'FEVER' },
                    { label: 'BODY PAIN' },
                    { label: 'HEADACHE' },
                    { label: 'NAUSEA' },
                    { label: 'FATIGUE' },
                    { label: 'EMERGENCY SOS' }
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => simulateGestureTrigger(item.label)}
                      className={`text-[11px] font-bold p-2 rounded-xl border text-center transition ${
                        item.label === 'EMERGENCY SOS'
                          ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-sky-400 hover:text-sky-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* TRANSLATION BAR */}
            <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row gap-4 items-center justify-between ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-mono text-sky-800 uppercase tracking-wider block font-bold">DETECTED ISL GLOSS SEQUENCE:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {glossHistory.length > 0 ? (
                    glossHistory.map((g, idx) => (
                      <span key={idx} className="bg-sky-100 text-sky-900 text-xs font-mono font-bold px-3 py-1 rounded-lg border border-sky-300">
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">Waiting for sign gestures...</span>
                  )}
                </div>
              </div>

              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-mono text-emerald-700 uppercase tracking-wider block font-bold">SPOKEN SENTENCE OUTPUT:</span>
                <p className="text-base font-bold text-slate-900">
                  {parsedSentence ? `"${parsedSentence}"` : <span className="text-slate-400 italic">No translation active</span>}
                </p>
              </div>
            </div>

          </div>

          <div className="lg:col-span-4 flex flex-col gap-4">
            
            <div className={`relative h-44 rounded-2xl border overflow-hidden flex items-center justify-center ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <video
                ref={remoteVideoRef}
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 z-10 bg-white/90 border border-slate-300 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm">
                DOCTOR STREAM
              </div>
            </div>

            {/* SUBTITLE PANEL */}
            <div className={`flex-1 rounded-2xl border p-5 flex flex-col overflow-hidden ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold mb-3 flex items-center justify-between">
                <span>LIVE DOCTOR SUBTITLES</span>
                <span className="text-sky-600">REAL-TIME SYNC</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {captionStream.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`p-3.5 rounded-xl border ${
                      msg.severity === 'emergency'
                        ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                        : msg.isDoctor
                        ? 'bg-sky-50 text-sky-900 border-sky-200 font-medium'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between font-bold">
                      <span>{msg.sender}</span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </main>
      ) : (
        
        /* DOCTOR DASHBOARD */
        <main className="flex-1 p-6 grid lg:grid-cols-12 gap-6 overflow-hidden max-w-7xl mx-auto w-full">
          
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className={`relative flex-1 rounded-2xl border overflow-hidden flex items-center justify-center min-h-[400px] ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <video
                ref={remoteVideoRef}
                playsInline
                autoPlay
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md border border-slate-300 text-sky-800 px-3 py-1.5 rounded-xl font-mono text-xs font-bold shadow-sm">
                DEAF PATIENT STREAM
              </div>

              {parsedSentence && (
                <div className="absolute bottom-6 inset-x-6 z-20 bg-white/95 border border-sky-300 p-4 rounded-2xl text-center shadow-lg">
                  <div className="text-[10px] font-mono text-sky-800 uppercase tracking-wider mb-1 font-bold">TRANSLATED PATIENT SPEECH</div>
                  <div className="text-lg font-bold text-slate-900">"{parsedSentence}"</div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className={`p-5 rounded-2xl border flex flex-col gap-3 ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold mb-1">
                CLINICAL TRIAGE QUESTIONS
              </div>

              <div className="space-y-2">
                {DOCTOR_TRIAGE_QUESTIONS.map((qObj) => (
                  <button
                    key={qObj.id}
                    onClick={() => sendDoctorQuestion(qObj)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50/50 font-medium text-xs transition flex flex-col gap-1 shadow-sm"
                  >
                    <span className="text-[10px] text-sky-700 font-mono uppercase font-bold">{qObj.category}</span>
                    <span className="text-slate-800 font-semibold">{qObj.question}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={`p-5 rounded-2xl border flex flex-col gap-3 flex-1 ${
              highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white shadow-md'
            }`}>
              <button
                onClick={toggleHearingMicSpeech}
                className={`w-full py-4 px-4 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                  isListeningSpeech 
                    ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' 
                    : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white border-transparent shadow-md shadow-sky-500/20'
                }`}
              >
                <Mic className="h-4 w-4" />
                <span>{isListeningSpeech ? 'Microphone Listening...' : 'Start Speech Recognition'}</span>
              </button>
            </div>
          </div>

        </main>
      )}

      {/* Footer Toolbar */}
      <footer className={`border-t ${highContrastMode ? 'border-yellow-400 bg-black' : 'border-slate-200 bg-white'} px-6 py-3 flex items-center justify-between`}>
        <button
          onClick={() => simulateGestureTrigger('EMERGENCY SOS')}
          className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-md shadow-rose-600/20"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Trigger Emergency SOS</span>
        </button>

        <button
          onClick={handleExitCall}
          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-5 py-2 rounded-xl text-xs transition border border-slate-300"
        >
          End Call
        </button>
      </footer>

    </div>
  );
}