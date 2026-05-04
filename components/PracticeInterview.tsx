"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Speech Recognition type (Web Speech API) ──────────────────────
interface SpeechRecognitionEvent {
  results: { [key: number]: { [key: number]: { transcript: string } } };
  resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

// ── Constants ─────────────────────────────────────────────────────
const ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "DevOps Engineer",
  "Mobile Developer",
  "UI/UX Designer",
  "Product Manager",
  "QA Engineer",
  "Machine Learning Engineer",
];

const TUTOR_INTROS: Record<string, string> = {
  "Frontend Developer": "Great! I'll be your AI interviewer for a Frontend Developer position. I'll ask you questions and give you feedback on your answers. Let's begin!",
  "Backend Developer": "Perfect! I'm your AI interviewer for a Backend Developer role. I'll guide you through the interview and share feedback after each answer. Ready?",
  "Full Stack Developer": "Excellent choice! I'm your AI interviewer for a Full Stack Developer position. I'll ask you targeted questions and coach you through your answers.",
  "Data Scientist": "Wonderful! I'll be interviewing you for a Data Scientist role. I'll ask domain-specific questions and provide detailed feedback on each response.",
  "DevOps Engineer": "Let's get started! I'm your AI interviewer for a DevOps Engineer position. I'll assess your experience and give you constructive feedback.",
  "Mobile Developer": "Great! I'm your AI interviewer for a Mobile Developer role. I'll walk you through a structured interview with instant coaching feedback.",
  "UI/UX Designer": "I'm excited to interview you for a UI/UX Designer position! I'll ask about your design process and give you feedback to sharpen your responses.",
  "Product Manager": "Let's do this! I'm your AI interviewer for a Product Manager role. I'll ask behavioral and strategic questions with detailed coaching feedback.",
  "QA Engineer": "Hello! I'm your AI interviewer for a QA Engineer position. I'll test your knowledge and give you pointed feedback after every answer.",
  "Machine Learning Engineer": "Great choice! I'm your AI interviewer for a Machine Learning Engineer role. I'll ask technical and practical questions with in-depth feedback.",
};

// ── Types ─────────────────────────────────────────────────────────
interface Feedback {
  score: number;
  rating: string;
  behaviorTips: string[];
  strengths: string[];
  corrections: string[];
  idealAnswer: string;
  encouragement: string;
  fillerWordsCount?: number;
  fillerWordsUsed?: Record<string, number>;
}

interface Message {
  id: string;
  sender: "tutor" | "user";
  text: string;
  feedback?: Feedback;
  questionIndex?: number;
  isTyping?: boolean;
}

type Phase = "setup" | "chat" | "results";

// ── Helpers ───────────────────────────────────────────────────────
const getRatingColor = (rating: string) => {
  switch (rating) {
    case "Excellent": return "text-green-400";
    case "Good": return "text-blue-400";
    case "Average": return "text-yellow-400";
    case "Needs Improvement": return "text-orange-400";
    case "Poor": return "text-red-400";
    default: return "text-gray-400";
  }
};

const getScoreBg = (score: number) => {
  if (score >= 8) return "bg-green-500/20 border-green-500 text-green-400";
  if (score >= 6) return "bg-blue-500/20 border-blue-500 text-blue-400";
  if (score >= 4) return "bg-yellow-500/20 border-yellow-500 text-yellow-400";
  return "bg-red-500/20 border-red-500 text-red-400";
};

// ── Main Component ────────────────────────────────────────────────
const PracticeInterview = () => {
  // Setup
  const [role, setRole] = useState(ROLES[0]);
  const [level, setLevel] = useState("Junior");
  const [type, setType] = useState("Technical");
  const [techStack, setTechStack] = useState("");

  // Chat state
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [allFeedback, setAllFeedback] = useState<(Feedback | null)[]>([]);

  // AI Speaker (text-to-speech) state
  const [aiVoiceOn, setAiVoiceOn] = useState(true);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);

  // Webcam state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamOn, setWebcamOn] = useState(false);

  // Voice recognition state
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Use a ref to track the latest user input so speech recognition can append to it
  const userInputRef = useRef(userInput);
  useEffect(() => {
    userInputRef.current = userInput;
  }, [userInput]);

  // ── Check voice support on mount ──────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") {
      setVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    }
  }, []);

  // ── Webcam helpers ────────────────────────────────────────
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamOn(true);
      }
    } catch (err) {
      console.warn("Webcam not available:", err);
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setWebcamOn(false);
    }
  }, []);

  // ── Voice recognition helpers ─────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // Save whatever text was already in the input box before we started listening
    const currentText = userInputRef.current || "";
    const initialText = currentText ? currentText + (currentText.endsWith(" ") ? "" : " ") : "";
    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result && result[0]) {
          const transcript = result[0].transcript;
          const isFinal = (result as any).isFinal;
          if (isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interim += transcript;
          }
        }
      }
      
      setUserInput(initialText + finalTranscript + interim);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [voiceSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // ── Text-to-Speech helper ─────────────────────────────────
  const speakText = useCallback((text: string) => {
    if (!aiVoiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up markdown/special chars for natural speech
    const cleaned = text
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // remove bold markers
      .replace(/\n/g, ". ")                 // newlines to pauses
      .replace(/[#*_~`]/g, "")             // remove markdown chars
      .trim();

    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";

    // Try to pick a good female voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
    ) || voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Samantha") || v.name.includes("Zira") || v.name.includes("Google US English"))
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeakingTTS(true);
    utterance.onend = () => setIsSpeakingTTS(false);
    utterance.onerror = () => setIsSpeakingTTS(false);

    window.speechSynthesis.speak(utterance);
  }, [aiVoiceOn]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingTTS(false);
  }, []);

  // Stop AI speech when user starts voice input
  const toggleListeningWithTTSStop = useCallback(() => {
    if (!isListening) {
      stopSpeaking(); // stop AI voice so mic doesn't pick it up
    }
    toggleListening();
  }, [isListening, stopSpeaking, toggleListening]);

  // Preload voices (Chrome needs this)
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // ── Cleanup webcam + voice + TTS on unmount ───────────────
  useEffect(() => {
    return () => {
      stopWebcam();
      stopListening();
      stopSpeaking();
    };
  }, [stopWebcam, stopListening, stopSpeaking]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when tutor finishes typing
  useEffect(() => {
    if (phase === "chat" && !isLoading && !isEvaluating) {
      inputRef.current?.focus();
    }
  }, [isLoading, isEvaluating, phase]);

  // Auto-start webcam when entering chat phase
  useEffect(() => {
    if (phase === "chat") {
      // Small delay to ensure the video element is rendered in the DOM
      const timer = setTimeout(() => {
        startWebcam();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [phase, startWebcam]);

  const addMessage = (msg: Omit<Message, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setMessages((prev) => [...prev, { ...msg, id }]);
    return id;
  };

  // ── Start Session ───────────────────────────────────────────────
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          role, level, type,
          techstack: techStack || "General",
          amount: 10,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.questions?.length) throw new Error("No questions");

      setQuestions(data.questions);
      setAllFeedback(new Array(data.questions.length).fill(null));
      setCurrentQ(0);
      setMessages([]);
      setPhase("chat");

      // Tutor intro
      await delay(300);
      const introText = TUTOR_INTROS[role] || `Welcome! I'm your AI interviewer for the ${role} role. Let's start!`;
      addMessage({ sender: "tutor", text: introText });
      speakText(introText);

      // First question after short pause
      await delay(900);
      const q1Text = `Question 1 of ${data.questions.length}: ${data.questions[0]}`;
      addMessage({
        sender: "tutor",
        text: `**Question 1 of ${data.questions.length}:**\n\n${data.questions[0]}`,
        questionIndex: 0,
      });
      speakText(q1Text);
    } catch {
      addMessage({ sender: "tutor", text: "Sorry, I had trouble loading your questions. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Submit Answer ───────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmed = userInput.trim();
    if (!trimmed || isEvaluating) return;

    // Add user message
    addMessage({ sender: "user", text: trimmed });
    setUserInput("");
    setIsEvaluating(true);

    // Capture an image frame from the webcam if it's on
    let imageBase64 = null;
    if (webcamOn && videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Extract the base64 string without the "data:image/jpeg;base64," prefix
        const dataUrl = canvas.toDataURL("image/jpeg");
        imageBase64 = dataUrl.split(",")[1];
      }
    }

    // Thinking indicator
    const thinkingId = addMessage({ sender: "tutor", text: "Analyzing your answer...", isTyping: true });

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          role,
          level,
          question: questions[currentQ],
          answer: trimmed,
          imageBase64,
        }),
      });
      const data = await res.json();
      const feedback: Feedback = data.success ? data.feedback : generateFallbackFeedback(trimmed);

      // Update allFeedback
      setAllFeedback((prev) => {
        const copy = [...prev];
        copy[currentQ] = feedback;
        return copy;
      });

      // Remove thinking bubble, add feedback bubble
      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
      addMessage({ sender: "tutor", text: "", feedback });

      // Build a detailed spoken feedback response
      const spoken: string[] = [];
      spoken.push(`You scored ${feedback.score} out of 10. That's rated ${feedback.rating}.`);

      if (feedback.strengths?.length) {
        spoken.push(`Here's what you did well: ${feedback.strengths.slice(0, 2).join(". ")}.`);
      }
      if (feedback.corrections?.length) {
        spoken.push(`To improve: ${feedback.corrections.slice(0, 2).join(". ")}.`);
      }
      if (feedback.behaviorTips?.length) {
        spoken.push(`A tip for you: ${feedback.behaviorTips[0]}.`);
      }
      if (feedback.encouragement) {
        spoken.push(feedback.encouragement);
      }

      const fullFeedbackSpeech = spoken.join(" ");

      // Speak feedback, then read next question after speech finishes
      const nextQ = currentQ + 1;
      if (nextQ < questions.length) {
        // Use a promise to wait for speech to finish or pause so user can read
        await new Promise<void>((resolve) => {
          if (!aiVoiceOn || typeof window === "undefined" || !window.speechSynthesis) {
            // Wait 4 seconds so the user can read the feedback before the next question starts
            setTimeout(resolve, 4000);
            return;
          }
          window.speechSynthesis.cancel();
          const cleaned = fullFeedbackSpeech.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\n/g, ". ").replace(/[#*_~`]/g, "").trim();
          const utterance = new SpeechSynthesisUtterance(cleaned);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          utterance.lang = "en-US";
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
            || voices.find(v => v.lang.startsWith("en") && (v.name.includes("Samantha") || v.name.includes("Zira") || v.name.includes("Google US English")))
            || voices.find(v => v.lang.startsWith("en"));
          if (preferred) utterance.voice = preferred;
          utterance.onstart = () => setIsSpeakingTTS(true);
          utterance.onend = () => { setIsSpeakingTTS(false); resolve(); };
          utterance.onerror = () => { setIsSpeakingTTS(false); resolve(); };
          window.speechSynthesis.speak(utterance);
        });

        // Small pause between feedback and next question
        await delay(500);

        const nextQText = `Alright, let's move on. Question ${nextQ + 1} of ${questions.length}: ${questions[nextQ]}`;
        addMessage({
          sender: "tutor",
          text: `**Question ${nextQ + 1} of ${questions.length}:**\n\n${questions[nextQ]}`,
          questionIndex: nextQ,
        });
        setCurrentQ(nextQ);
        speakText(nextQText);
      } else {
        speakText(fullFeedbackSpeech);
        await delay(4000);
        const endText = "That was the last question! Well done for completing the practice interview. Let me show you your full performance summary.";
        addMessage({ sender: "tutor", text: endText });
        speakText(endText);
        await delay(3000);
        setPhase("results");
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
      const errorMsg = "I had trouble evaluating that answer. Let's continue to the next question.";
      addMessage({ sender: "tutor", text: errorMsg });
      speakText(errorMsg);
    } finally {
      setIsEvaluating(false);
    }
  };

  // ── Skip Question ───────────────────────────────────────────────
  const handleSkip = async () => {
    if (isEvaluating) return;
    addMessage({ sender: "user", text: "*(Skipped this question)*" });
    setAllFeedback((prev) => {
      const copy = [...prev];
      copy[currentQ] = null;
      return copy;
    });

    const nextQ = currentQ + 1;
    if (nextQ < questions.length) {
      await delay(300);
      const skipText = `No problem! Let's move on. Question ${nextQ + 1} of ${questions.length}: ${questions[nextQ]}`;
      addMessage({
        sender: "tutor",
        text: `No problem! Let's move on.\n\n**Question ${nextQ + 1} of ${questions.length}:**\n\n${questions[nextQ]}`,
        questionIndex: nextQ,
      });
      setCurrentQ(nextQ);
      speakText(skipText);
    } else {
      const endText = "That was the last question! Let me show your summary.";
      addMessage({ sender: "tutor", text: endText });
      speakText(endText);
      await delay(2000);
      setPhase("results");
    }
  };

  // ── Overall score ───────────────────────────────────────────────
  const overallScore = () => {
    const valid = allFeedback.filter((f) => f && f.score > 0) as Feedback[];
    if (!valid.length) return 0;
    return Math.round((valid.reduce((a, f) => a + f.score, 0) / valid.length) * 10);
  };

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — SETUP
  // ═══════════════════════════════════════════════════════════
  if (phase === "setup") {
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-200/10 rounded-full mb-4">
            <span className="w-2 h-2 rounded-full bg-primary-200 animate-pulse" />
            <span className="text-xs font-semibold text-primary-200 uppercase tracking-wider">AI Tutor Mode</span>
          </div>
          <h2 className="text-3xl font-bold mb-2">AI Interview Tutor</h2>
          <p className="text-light-400 text-sm">
            Your AI tutor will ask questions, listen to your answers, and coach you with instant feedback
          </p>
        </div>

        <div className="card-border">
          <div className="card p-7 space-y-5">
            {/* Role */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary-100">Job Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-dark-200 border border-dark-100 rounded-lg p-3 text-white focus:border-primary-200 focus:outline-none transition-colors"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Level */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary-100">Experience Level</label>
              <div className="flex gap-2">
                {["Junior", "Mid-Level", "Senior"].map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={cn("flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                      level === l ? "bg-primary-200 text-dark-100 border-primary-200" : "bg-dark-200 border-dark-100 text-light-100 hover:border-primary-200/50"
                    )}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary-100">Interview Focus</label>
              <div className="flex gap-2">
                {["Technical", "Behavioral", "Mixed"].map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className={cn("flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                      type === t ? "bg-primary-200 text-dark-100 border-primary-200" : "bg-dark-200 border-dark-100 text-light-100 hover:border-primary-200/50"
                    )}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary-100">Tech Stack <span className="text-light-400 font-normal">(optional)</span></label>
              <input type="text" placeholder="e.g. React, Node.js, TypeScript"
                value={techStack} onChange={(e) => setTechStack(e.target.value)}
                className="w-full bg-dark-200 border border-dark-100 rounded-lg p-3 text-white placeholder-light-400 focus:border-primary-200 focus:outline-none transition-colors"
              />
            </div>

            {/* Camera Preview */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-primary-100">Camera Preview</label>
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-full">
                  {webcamOn ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-40 rounded-xl object-cover -scale-x-100 border-2 border-primary-200/50"
                    />
                  ) : (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                      <button
                        onClick={startWebcam}
                        type="button"
                        className="w-full h-40 rounded-xl bg-dark-300 border-2 border-dashed border-dark-100 flex flex-col items-center justify-center text-light-400 hover:border-primary-200/50 transition-colors group gap-2"
                      >
                        <span className="text-3xl group-hover:scale-110 transition-transform">📷</span>
                        <span className="text-sm font-medium">Enable Camera</span>
                        <span className="text-[10px] text-light-400">Click to see yourself</span>
                      </button>
                    </>
                  )}
                </div>
                {webcamOn && (
                  <button
                    onClick={stopWebcam}
                    type="button"
                    className="text-xs text-light-400 hover:text-red-400 transition-colors"
                  >
                    Turn off camera
                  </button>
                )}
              </div>
            </div>

            <button onClick={handleStart} disabled={isLoading}
              className="w-full bg-primary-200 hover:bg-primary-200/90 text-dark-100 font-bold py-3.5 rounded-full transition-all disabled:opacity-50 shadow-lg shadow-primary-200/20">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-dark-100 border-t-transparent rounded-full animate-spin" />
                  Preparing Your Interview...
                </span>
              ) : "Start Interview with AI Tutor →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2 — CHAT INTERVIEW
  // ═══════════════════════════════════════════════════════════
  if (phase === "chat") {
    return (
      <div className="w-full max-w-5xl mx-auto flex gap-4" style={{ height: "calc(100vh - 120px)", minHeight: 500 }}>

        {/* ── LEFT: Chat Area ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-primary-200/20 flex items-center justify-center text-lg">
                🤖
                {isSpeakingTTS && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full animate-pulse border border-dark-100" />
                )}
              </div>
              <div>
                <p className="font-semibold text-white">
                  AI Interview Tutor
                  {isSpeakingTTS && <span className="text-xs text-green-400 ml-2 animate-pulse">🔊 Speaking...</span>}
                </p>
                <p className="text-xs text-light-400">{role} · {level} · {type}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* AI Voice Toggle */}
              <button
                onClick={() => { setAiVoiceOn(!aiVoiceOn); if (aiVoiceOn) stopSpeaking(); }}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all border",
                  aiVoiceOn
                    ? "bg-green-500/20 border-green-500 text-green-400"
                    : "bg-dark-200 border-dark-100 text-light-400 hover:border-primary-200/50"
                )}
                title={aiVoiceOn ? "AI voice ON — click to mute" : "AI voice OFF — click to unmute"}
              >
                {aiVoiceOn ? "🔊" : "🔇"}
              </button>
              <div className="text-sm text-light-400">
                {currentQ + 1}/{questions.length}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="w-full bg-dark-200 rounded-full h-1 mb-4 flex-shrink-0">
            <div className="bg-primary-200 h-1 rounded-full transition-all duration-500"
              style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
          </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
          {messages.map((msg) => (
            <div key={msg.id}
              className={cn("flex gap-3", msg.sender === "user" ? "flex-row-reverse" : "flex-row")}
            >
              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm",
                msg.sender === "tutor" ? "bg-primary-200/20 text-primary-200" : "bg-dark-200 text-white"
              )}>
                {msg.sender === "tutor" ? "🤖" : "👤"}
              </div>

              {/* Bubble */}
              <div className={cn(
                "max-w-[80%] space-y-1",
                msg.sender === "user" ? "items-end flex flex-col" : "items-start flex flex-col"
              )}>
                {/* Text bubble */}
                {(msg.text || msg.isTyping) && (
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    msg.sender === "tutor"
                      ? "bg-dark-200 text-white rounded-tl-sm"
                      : "bg-primary-200/20 text-primary-100 rounded-tr-sm",
                    msg.isTyping && "italic text-light-400"
                  )}>
                    {msg.isTyping ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-light-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-light-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-light-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <FormattedText text={msg.text} />
                    )}
                  </div>
                )}

                {/* Feedback card */}
                {msg.feedback && <FeedbackCard feedback={msg.feedback} />}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 mt-3 border-t border-dark-100 pt-4">
          {/* Voice status indicator */}
          {isListening && (
            <div className="flex items-center gap-2 mb-2 px-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-400 font-semibold">🎤 Listening — speak your answer...</span>
              <div className="flex gap-0.5 ml-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 bg-red-400 rounded-full animate-bounce"
                    style={{ height: `${8 + Math.random() * 12}px`, animationDelay: `${i * 100}ms`, animationDuration: "0.6s" }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Mic Button */}
            {voiceSupported && (
              <button
                onClick={toggleListeningWithTTSStop}
                disabled={isEvaluating || isLoading}
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg transition-all border",
                  isListening
                    ? "bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/20 animate-pulse"
                    : "bg-dark-200 border-dark-100 text-light-400 hover:border-primary-200/50 hover:text-primary-200",
                  (isEvaluating || isLoading) && "opacity-40 cursor-not-allowed"
                )}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? "⏹️" : "🎤"}
              </button>
            )}

            <textarea
              ref={inputRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={voiceSupported ? "Type or click 🎤 to speak your answer..." : "Type your answer here... (Ctrl+Enter to submit)"}
              rows={3}
              disabled={isEvaluating || isLoading}
              className={cn(
                "flex-1 bg-dark-200 border rounded-xl px-4 py-3 text-white placeholder-light-400 resize-none focus:border-primary-200 focus:outline-none transition-colors text-sm leading-relaxed",
                isListening ? "border-red-500/50" : "border-dark-100"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handleSubmit();
              }}
            />
            <div className="flex flex-col gap-2">
              <button onClick={() => { stopListening(); handleSubmit(); }}
                disabled={isEvaluating || isLoading || !userInput.trim()}
                className="px-5 py-3 bg-primary-200 hover:bg-primary-200/90 text-dark-100 font-bold rounded-xl transition-all disabled:opacity-40 text-sm">
                {isEvaluating ? (
                  <span className="w-4 h-4 border-2 border-dark-100 border-t-transparent rounded-full animate-spin block" />
                ) : "Send"}
              </button>
              <button onClick={handleSkip} disabled={isEvaluating || isLoading}
                className="px-5 py-2 bg-dark-200 hover:bg-dark-300 text-light-400 rounded-xl border border-dark-100 transition-all disabled:opacity-40 text-xs">
                Skip
              </button>
            </div>
          </div>
          <p className="text-xs text-light-400 mt-1.5 text-center">
            {voiceSupported
              ? <>🎤 Click mic to speak · ⌨️ Type your answer · Press <kbd className="px-1 py-0.5 bg-dark-200 rounded text-xs">Ctrl+Enter</kbd> to submit</>
              : <>Press <kbd className="px-1 py-0.5 bg-dark-200 rounded text-xs">Ctrl+Enter</kbd> to submit</>}
          </p>
        </div>
        </div> {/* end left column */}

        {/* ── RIGHT: Webcam Panel ── */}
        <div className="w-64 flex-shrink-0 flex flex-col items-center gap-4 pt-2">
          {/* Webcam Feed */}
          <div className="relative">
            {webcamOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-52 h-52 rounded-2xl object-cover -scale-x-100 border-2 border-primary-200 shadow-xl shadow-primary-200/10"
              />
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className="hidden" />
                <button
                  onClick={startWebcam}
                  className="w-52 h-52 rounded-2xl bg-dark-200 border-2 border-dashed border-dark-100 flex flex-col items-center justify-center text-light-400 hover:border-primary-200/50 transition-colors group gap-2"
                  title="Turn on webcam"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">📷</span>
                  <span className="text-xs">Click to enable webcam</span>
                </button>
              </>
            )}
          </div>

          {/* Webcam Toggle */}
          <button
            onClick={webcamOn ? stopWebcam : startWebcam}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-medium transition-all border flex items-center justify-center gap-2",
              webcamOn
                ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/20"
                : "bg-primary-200/10 border-primary-200/50 text-primary-200 hover:bg-primary-200/20"
            )}
          >
            {webcamOn ? <><span>🚫</span> Turn Off Camera</> : <><span>📷</span> Turn On Camera</>}
          </button>

          {/* Status Card */}
          <div className="w-full bg-dark-200 rounded-xl border border-dark-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-light-400 uppercase tracking-wider">Interview Status</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-light-400">Question</span>
                <span className="text-white font-semibold">{currentQ + 1} / {questions.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-light-400">Camera</span>
                <span className={cn("font-semibold", webcamOn ? "text-green-400" : "text-light-400")}>
                  {webcamOn ? "✓ Active" : "Off"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-light-400">AI Voice</span>
                <span className={cn("font-semibold", aiVoiceOn ? "text-green-400" : "text-light-400")}>
                  {aiVoiceOn ? "✓ On" : "Muted"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-light-400">Mic</span>
                <span className={cn("font-semibold", isListening ? "text-red-400" : "text-light-400")}>
                  {isListening ? "● Listening" : "Off"}
                </span>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="w-full bg-dark-200/50 rounded-xl border border-dark-100/50 p-3">
            <p className="text-[10px] text-light-400 leading-relaxed">
              💡 <strong className="text-primary-200">Tip:</strong> Maintain eye contact with the camera, speak clearly, and structure your answers with real examples.
            </p>
          </div>
        </div>

      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 — RESULTS
  // ═══════════════════════════════════════════════════════════
  const score = overallScore();
  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
      {/* Score Card */}
      <div className="card-border">
        <div className="card p-8 flex flex-col items-center gap-3">
          <p className="text-sm text-light-400 uppercase tracking-wider font-semibold">Interview Complete</p>
          <div className={cn(
            "w-28 h-28 rounded-full border-4 flex items-center justify-center text-4xl font-bold",
            getScoreBg(score / 10)
          )}>
            {score}
          </div>
          <p className="text-xl font-bold text-white">Overall Score: {score}/100</p>
          <p className="text-light-400 text-sm text-center max-w-md">
            {score >= 70 ? "Great performance! You demonstrated strong interview skills." :
              score >= 50 ? "Good effort! Keep practicing to boost your confidence and depth." :
                "Keep practicing! Review the feedback below — every session makes you better."}
          </p>
          <p className="text-primary-200 font-semibold">{role} · {level} · {type}</p>
        </div>
      </div>

      {/* Per-Question Breakdown */}
      <h3 className="text-xl font-bold">Question-by-Question Breakdown</h3>
      {questions.map((q, idx) => {
        const fb = allFeedback[idx];
        return (
          <div key={idx} className="card-border">
            <div className="card p-6 space-y-4">
              <div className="flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-primary-200/20 flex items-center justify-center text-primary-200 text-xs font-bold flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="text-white font-medium text-sm">{q}</p>
              </div>

              {/* User answer */}
              {messages.find((m) => m.sender === "user" && messages.indexOf(m) > messages.findIndex((n) => n.questionIndex === idx)) && (
                <div className="bg-dark-200 rounded-lg p-3">
                  <p className="text-xs text-light-400 font-semibold mb-1">Your Answer:</p>
                  <p className="text-light-100 text-sm leading-relaxed">
                    {messages.filter((m) => m.sender === "user")[idx]?.text || "(Skipped)"}
                  </p>
                </div>
              )}

              {fb ? <FeedbackCard feedback={fb} expanded /> :
                <p className="text-xs text-light-400 italic">This question was skipped.</p>}
            </div>
          </div>
        );
      })}

      {/* Actions */}
      <div className="flex gap-4 justify-center pt-2">
        <button onClick={() => { setPhase("setup"); setMessages([]); setAllFeedback([]); setCurrentQ(0); }}
          className="px-8 py-3 bg-dark-200 hover:bg-dark-300 text-primary-200 font-bold rounded-full border border-dark-100 transition-all">
          New Session
        </button>
        <button onClick={handleStart}
          className="px-8 py-3 bg-primary-200 hover:bg-primary-200/90 text-dark-100 font-bold rounded-full transition-all shadow-lg shadow-primary-200/20">
          Retry Same Role
        </button>
      </div>
    </div>
  );
};

// ── Feedback Card Component ───────────────────────────────────────
const FeedbackCard = ({ feedback, expanded = false }: { feedback: Feedback; expanded?: boolean }) => (
  <div className="rounded-xl border border-dark-100 bg-dark-300 overflow-hidden w-full max-w-[80%] text-sm">
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-2.5 bg-dark-200 border-b border-dark-100">
      <span className="text-xs font-bold text-light-400 uppercase tracking-wider">AI Feedback</span>
      <div className="flex items-center gap-2">
        <span className={cn("font-bold text-base", getRatingColor(feedback.rating))}>{feedback.rating}</span>
        <span className={cn("px-2 py-0.5 rounded-full border text-xs font-bold", getScoreBg(feedback.score))}>
          {feedback.score}/10
        </span>
      </div>
    </div>

    <div className="p-4 space-y-3">
      {/* Speaking Fluency (Filler Words) */}
      {feedback.fillerWordsCount !== undefined && feedback.fillerWordsCount > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <p className="text-xs font-bold text-orange-400 mb-1.5 flex items-center gap-1">
            🗣️ Speaking Fluency
          </p>
          <p className="text-xs text-light-100 mb-2">
            You used <strong className="text-orange-400">{feedback.fillerWordsCount}</strong> filler word{feedback.fillerWordsCount === 1 ? "" : "s"}. Try pausing instead of filling the silence!
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(feedback.fillerWordsUsed || {}).map(([word, count]) => (
              <span key={word} className="px-2 py-0.5 rounded-full bg-dark-200 border border-dark-100 text-[10px] text-light-400">
                "{word}": <strong className="text-orange-400">{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Behavioral Tips */}
      {feedback.behaviorTips?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-blue-400 mb-1.5 flex items-center gap-1">🎯 Behavior & Delivery Tips</p>
          <ul className="space-y-1">
            {feedback.behaviorTips.map((tip, i) => (
              <li key={i} className="text-xs text-light-100 flex gap-2">
                <span className="text-blue-400 flex-shrink-0">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Strengths */}
      {feedback.strengths?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-green-400 mb-1.5">✅ What You Did Well</p>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-xs text-light-100 flex gap-2">
                <span className="text-green-400 flex-shrink-0">+</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrections */}
      {feedback.corrections?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-orange-400 mb-1.5">✏️ Where to Correct</p>
          <ul className="space-y-1">
            {feedback.corrections.map((c, i) => (
              <li key={i} className="text-xs text-light-100 flex gap-2">
                <span className="text-orange-400 flex-shrink-0">→</span>{c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ideal Answer */}
      {(expanded || feedback.idealAnswer) && feedback.idealAnswer && (
        <div className="bg-dark-200 rounded-lg px-3 py-2.5">
          <p className="text-xs font-bold text-purple-400 mb-1">💡 Model Answer</p>
          <p className="text-xs text-light-100 leading-relaxed">{feedback.idealAnswer}</p>
        </div>
      )}

      {/* Encouragement */}
      {feedback.encouragement && (
        <p className="text-xs text-primary-200 italic border-t border-dark-100 pt-2">
          {feedback.encouragement}
        </p>
      )}
    </div>
  </div>
);

// ── Formatted Text (bold with **) ─────────────────────────────────
const FormattedText = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="text-primary-100">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
};

// ── Fallback feedback ─────────────────────────────────────────────
function generateFallbackFeedback(answer: string): Feedback {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 10) return {
    score: 3, rating: "Needs Improvement",
    behaviorTips: ["Try to speak more confidently and provide a complete response", "Take a moment to gather your thoughts before answering"],
    strengths: ["You attempted the question"],
    corrections: ["Your answer is too brief — aim for at least 3-4 sentences", "Add a specific example from your experience"],
    idealAnswer: "A strong answer includes context, your specific action, and the result or outcome.",
    encouragement: "Don't worry — practice makes perfect! Try again with more detail.",
  };
  if (words < 40) return {
    score: 5, rating: "Average",
    behaviorTips: ["Good start! Try to be more specific with examples", "Structure your answer using STAR: Situation, Task, Action, Result"],
    strengths: ["Provided a relevant response", "Showed understanding of the topic"],
    corrections: ["Expand with a concrete example from your past experience", "Quantify your impact where possible (e.g., 'reduced load time by 30%')"],
    idealAnswer: "Strengthen your answer by adding measurable results and linking your experience directly to the role.",
    encouragement: "You're on the right track — just go deeper next time!",
  };
  return {
    score: 7, rating: "Good",
    behaviorTips: ["Great detail! Try to tighten your answer to 60-90 seconds in a real interview", "Make eye contact and speak with a steady pace"],
    strengths: ["Detailed and well-structured response", "Showed strong understanding of the topic", "Used appropriate terminology"],
    corrections: ["Connect your answer more directly to the specific role requirements", "Add a metric or outcome to make it more memorable"],
    idealAnswer: "Your answer is solid. Adding a clear outcome with numbers will make it excellent.",
    encouragement: "Strong answer! A small polish and this will be interview-ready.",
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default PracticeInterview;
