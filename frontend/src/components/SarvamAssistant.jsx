import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, Mic, MicOff, Send, Volume2, X, Sparkles, Navigation, Calendar, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function SarvamAssistant() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: `Namaste ${user?.name || "there"}! I'm your Sarvam AI campus event assistant (Saaras v4 + 105B). How can I help you today?`,
      chips: ["Find AI hackathons", "Check my exam clashes", "Navigate to Discover", "Add an event"],
    },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize Web Speech API for voice assistant if available
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = user?.primary_language === "hi-IN" ? "hi-IN" : "en-IN";

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        sendMessage(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [user?.primary_language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser. You can type your request directly.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const playBase64Audio = (b64Audio) => {
    if (!b64Audio) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(`data:audio/wav;base64,${b64Audio}`);
      audioRef.current = audio;
      setPlayingAudio(true);
      audio.onended = () => setPlayingAudio(false);
      audio.onerror = () => setPlayingAudio(false);
      audio.play();
    } catch (e) {
      console.warn("Audio playback failed", e);
      setPlayingAudio(false);
    }
  };

  const sendMessage = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || busy) return;

    setInput("");
    const newMessages = [...messages, { sender: "user", text: query }];
    setMessages(newMessages);
    setBusy(true);

    try {
      const resp = await api.post("/assistant/chat", {
        message: query,
        screen: location.pathname,
      });

      const botReply = {
        sender: "bot",
        text: resp.reply,
        audio: resp.audio,
        action: resp.action,
        chips: resp.chips || [],
      };

      setMessages((prev) => [...prev, botReply]);

      // If audio returned, auto-play response voice
      if (resp.audio) {
        playBase64Audio(resp.audio);
      }

      // If actionable navigation, offer automated transition
      if (resp.action?.type === "navigate" && resp.action.target) {
        setTimeout(() => {
          navigate(resp.action.target);
        }, 1200);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: err.message || "I encountered an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="sarvam-assistant-root">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          className="sarvam-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open Sarvam AI Assistant"
          title="Sarvam AI Voice & Chat Assistant (Saaras v4 + 105B)"
        >
          <Bot size={22} />
          <span className="sarvam-fab-badge">AI</span>
        </button>
      )}

      {/* Assistant Modal / Drawer */}
      {isOpen && (
        <div className="sarvam-chat-card">
          <div className="sarvam-chat-header">
            <div className="sarvam-header-title">
              <Bot size={18} className="sarvam-icon-pulse" />
              <div>
                <strong>Sarvam AI Assistant</strong>
                <span className="sarvam-model-tag">Saaras v4 · 105B</span>
              </div>
            </div>
            <button
              className="btn-icon-subtle"
              onClick={() => {
                setIsOpen(false);
                if (audioRef.current) audioRef.current.pause();
              }}
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div className="sarvam-chat-body">
            {messages.map((m, idx) => (
              <div key={idx} className={`sarvam-bubble-wrap ${m.sender === "user" ? "user" : "bot"}`}>
                <div className={`sarvam-bubble ${m.sender}`}>
                  <p>{m.text}</p>

                  {/* Audio read-aloud button */}
                  {m.audio && (
                    <button
                      className="sarvam-tts-btn"
                      onClick={() => playBase64Audio(m.audio)}
                      title="Listen with Sarvam Bulbul Voice"
                    >
                      <Volume2 size={13} /> {playingAudio ? "Playing..." : "Listen"}
                    </button>
                  )}

                  {/* Action indicator pill */}
                  {m.action && (
                    <div className="sarvam-action-pill">
                      {m.action.type === "navigate" && (
                        <span>
                          <Navigation size={12} /> Navigating to {m.action.target}
                        </span>
                      )}
                      {m.action.type === "draft_event" && (
                        <button
                          className="btn-tertiary small"
                          onClick={() => navigate("/add", { state: { parsed: m.action.event } })}
                        >
                          <Calendar size={12} /> Review Drafted Event
                        </button>
                      )}
                    </div>
                  )}

                  {/* Suggested chips */}
                  {m.chips && m.chips.length > 0 && idx === messages.length - 1 && (
                    <div className="sarvam-chips-row">
                      {m.chips.map((chip, cIdx) => (
                        <button key={cIdx} className="sarvam-chip" onClick={() => sendMessage(chip)}>
                          <Sparkles size={11} /> {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="sarvam-bubble-wrap bot">
                <div className="sarvam-bubble bot typing">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input box */}
          <form
            className="sarvam-chat-footer"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <button
              type="button"
              className={`sarvam-mic-btn ${isListening ? "listening" : ""}`}
              onClick={toggleVoice}
              title={isListening ? "Listening... click to stop" : "Speak via Sarvam Voice STT"}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              type="text"
              placeholder={isListening ? "Listening..." : "Ask in English, Hindi or Hinglish..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="sarvam-send-btn" disabled={!input.trim() || busy}>
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
