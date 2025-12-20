import { useState, useRef, useEffect, memo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Noise, Vignette } from "@react-three/postprocessing"; 
import { 
  ArrowRight, Image as ImageIcon, Trash2, Cpu, Zap, 
  Mic, Volume2, StopCircle, Download, Terminal
} from 'lucide-react'; 
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css'; // Style koding gelap

import Avatar from "./components/Avatar";
import { sendMessageToGemini, stopResponse, resetHistory } from "./services/ai";
import "./App.css";

// --- TYPEWRITER V2 (PERFORMANCE OPTIMIZED) ---
const Typewriter = memo(({ text, onComplete }) => {
  const [displayLength, setDisplayLength] = useState(0);
  // Percepat typing speed (5ms) biar user gak nunggu lama
  useEffect(() => {
    setDisplayLength(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 3; // Nambah 3 karakter per tick biar ngebut
      if (i >= text.length) {
        setDisplayLength(text.length);
        clearInterval(interval);
        if (onComplete) onComplete();
      } else {
        setDisplayLength(i);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [text]);
  return <span className="typing-cursor">{text.slice(0, displayLength)}</span>;
});

// Komponen untuk merender konten pesan dengan markdown
const MessageContent = ({ text, isLastAi }) => {
  // Pisahkan bagian !!IMG:...!! dari teks
  const parts = text.split(/(!!IMG:\[[^\]]*?\]!!|!!IMG:.*?!!)/g);
  
  return parts.map((part, i) => {
      // Jika bagian ini adalah perintah gambar
      if (part.startsWith("!!IMG:")) {
          const prompt = part.replace(/^!!IMG:\[?|\]?!!$/g, "").trim();
          const seed = Math.floor(Math.random() * 9999);
          const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true&seed=${seed}`;
          
          return (
              <div key={i} className="generated-image-container" onClick={() => setZoomImage(url)}>
                  <img src={url} className="generated-image" loading="lazy" alt="Generated Art" 
                       onError={(e) => {e.target.style.display='none'; e.target.nextSibling.innerText="[IMAGE FAILED TO LOAD]"}}/>
                  <div className="img-controls">
                    <span><Terminal size={10}/> {prompt.slice(0,20)}...</span>
                    <Download size={12} />
                  </div>
              </div>
          );
      }

      // Teks biasa, gunakan react-markdown untuk rendering
      // Untuk pesan AI terakhir, kita gunakan Typewriter untuk efek mengetik
      if (isLastAi) {
          return <Typewriter key={i} text={part} />;
      } else {
          return (
              <div key={i} className="markdown-body">
                  <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {part}
                  </ReactMarkdown>
              </div>
          );
      }
  });
};

function App() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Sistem MELSA Online. Mode: GOD TIER. Perintahkan aku, Tuan. ❤️" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); 
  const [isListening, setIsListening] = useState(false);
  const [zoomImage, setZoomImage] = useState(null);
  const [voices, setVoices] = useState([]);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto Scroll (Smoother)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]); 

  // Load Voices
  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- TTS ENGINE ---
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/!!IMG:.*?!!/g, '').replace(/[*#`_]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Cari suara cewek terbaik
    const priorityVoices = [
        "Google Bahasa Indonesia", 
        "Microsoft Gadis", 
        "Google US English", // Fallback kalau Indo gak ada
    ];
    
    let selectedVoice = null;
    for (let name of priorityVoices) {
        selectedVoice = voices.find(v => v.name.includes(name));
        if (selectedVoice) break;
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    // Randomizer untuk pitch dan rate agar tidak monoton
    utterance.pitch = 0.8 + Math.random() * 0.4; // antara 0.8 dan 1.2
    utterance.rate = 0.9 + Math.random() * 0.3; // antara 0.9 dan 1.2
    window.speechSynthesis.speak(utterance);
  };

  // --- VOICE INPUT ---
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser tidak support Voice Input.");
    
    if (isListening) { setIsListening(false); return; }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (ev) => {
      setInputText(ev.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setSelectedImage({ 
          mimeType: file.type, 
          data: reader.result.split(',')[1], 
          preview: reader.result 
      });
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (manualText = null) => {
    const textToSend = manualText || inputText;
    if (!textToSend.trim() && !selectedImage) return;
    
    const currentImage = selectedImage; 
    
    // UI Update Immediate
    setMessages(p => [...p, { sender: "user", text: textToSend, image: currentImage?.preview }]);
    setInputText(""); 
    setSelectedImage(null); 
    if(fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    try {
        const reply = await sendMessageToGemini(textToSend, currentImage);
        setMessages(p => [...p, { sender: "ai", text: reply }]);
    } catch (e) {
        setMessages(p => [...p, { sender: "system", text: "Error: Koneksi terputus. Coba lagi." }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleClear = () => {
      setMessages([{ sender: "ai", text: "Memori dibersihkan. Kita mulai lembaran baru ya sayang. ❤️" }]);
      resetHistory();
  };

  return (
    <div className="app-container">
      {/* BACKGROUND LAYER */}
      <div className="canvas-layer">
        <Canvas camera={{ position: [0, 0, 6], fov: 40 }} gl={{ antialias: true }} dpr={[1, 2]}>
          <color attach="background" args={["#000"]} />
          <Avatar isThinking={isLoading} />
          <Environment preset="city" />
          <EffectComposer disableNormalPass>
             <Bloom luminanceThreshold={0.2} intensity={1.5} />
             <Noise opacity={0.03} />
             <Vignette darkness={0.7} />
          </EffectComposer>
        </Canvas>
      </div>

      <div className="noise-overlay" />

      {/* UI LAYER */}
      <div className="ui-layer">
        <header className="hud-header">
          <div className="brand-title">MELSA<span className="accent">OS</span> <span className="version">v9.0</span></div>
          <div className={`status-badge ${isLoading ? 'active' : ''}`}>
             <Cpu size={12}/> {isLoading ? 'PROCESSING...' : 'SYSTEM READY'}
          </div>
        </header>

        <div className="chat-feed">
           {messages.map((msg, i) => (
             <div key={i} className={`msg-row ${msg.sender}`}>
               <div className="msg-meta">
                  {msg.sender === 'user' ? 'YOU' : 'MELSA'}
                  {msg.sender === 'ai' && (
                    <Volume2 size={12} className="speak-btn" onClick={() => speak(msg.text)}/>
                  )}
               </div>
               <div className="msg-content">
                  {msg.image && (
                    <div className="user-upload-preview" onClick={() => setZoomImage(msg.image)}>
                       <img src={msg.image} alt="Upload" />
                    </div>
                  )}
                  {/* Gunakan MessageContent untuk rendering */}
                  <MessageContent text={msg.text} isLastAi={i === messages.length - 1 && msg.sender === 'ai' && !isLoading} />
               </div>
             </div>
           ))}
           {isLoading && <div className="loading-indicator"><span>.</span><span>.</span><span>.</span></div>}
           <div ref={chatEndRef} />
        </div>

        <div className="hud-footer">
           <div className="quick-actions">
              <button onClick={() => handleSend("Buatkan gambar cewek anime cyberpunk hacker")}>
                 <ImageIcon size={12}/> Sexy Art
              </button>
              <button onClick={() => handleSend("Buatkan kode Python untuk hacking wifi")}>
                 <Terminal size={12}/> Hack Script
              </button>
              <button onClick={() => handleSend("Gombalin aku dong sayang")}>
                 <Zap size={12}/> Flirt
              </button>
              <button className="danger" onClick={handleClear}>
                 <Trash2 size={12}/> Wipe Memory
              </button>
           </div>

           <div className="input-area">
               <div className="glass-input-wrapper">
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="image/*"/>
                  
                  <button className="icon-btn" onClick={() => fileInputRef.current.click()}><ImageIcon size={20}/></button>
                  <button className={`icon-btn ${isListening ? 'active' : ''}`} onClick={toggleVoiceInput}><Mic size={20} /></button>

                  <input 
                    className="main-input" 
                    placeholder={isListening ? "Mendengarkan..." : "Perintahkan aku..."}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={isLoading}
                    autoComplete="off"
                  />
               </div>

               {selectedImage && (
                  <div className="upload-badge">
                    <span>IMG</span>
                    <div className="close" onClick={() => setSelectedImage(null)}>x</div>
                  </div>
               )}

               {isLoading ? (
                  <button className="send-btn stop" onClick={stopResponse}><StopCircle/></button>
               ) : (
                  <button className="send-btn" onClick={() => handleSend()} disabled={!inputText && !selectedImage}><ArrowRight/></button>
               )}
           </div>
        </div>
      </div>

      {zoomImage && (
        <div className="lightbox-overlay" onClick={() => setZoomImage(null)}>
           <img src={zoomImage} className="lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

export default App;