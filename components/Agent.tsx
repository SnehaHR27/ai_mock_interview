"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastMessage, setLastMessage] = useState<string>("");
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // Webcam refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamOn, setWebcamOn] = useState(false);

  // Transcript auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start webcam
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamOn(true);
      }
    } catch (err) {
      console.warn("Webcam not available:", err);
    }
  };

  // Stop webcam
  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
      videoRef.current.srcObject = null;
      setWebcamOn(false);
    }
  };

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // VAPI event listeners
  useEffect(() => {
    const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
    const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

    const onMessage = (message: Message) => {
      if (message.type === "transcript" && message.transcriptType === "final") {
        setMessages((prev) => [
          ...prev,
          { role: message.role, content: message.transcript },
        ]);
      }
    };

    const onSpeechStart = () => setIsSpeaking(true);
    const onSpeechEnd = () => setIsSpeaking(false);
    const onError = (error: Error) => {
      console.error("VAPI Error:", error);
      setCallStatus(CallStatus.INACTIVE);
      stopWebcam();
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
      stopWebcam();
    };
  }, []);

  // Handle call end → feedback
  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content);
    }

    const handleGenerateFeedback = async (msgs: SavedMessage[]) => {
      setIsGeneratingFeedback(true);
      const { success, feedbackId: id } = await createFeedback({
        interviewId: interviewId!,
        userId: userId!,
        transcript: msgs,
        feedbackId,
      });

      if (success && id) {
        router.push(`/interview/${interviewId}/feedback`);
      } else {
        router.push("/");
      }
    };

    if (callStatus === CallStatus.FINISHED) {
      stopWebcam();
      if (type === "generate") {
        router.push("/");
      } else {
        handleGenerateFeedback(messages);
      }
    }
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]);

  // Start call
  const handleCall = async () => {
    setCallStatus(CallStatus.CONNECTING);
    await startWebcam();

    try {
      if (type === "generate") {
        await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
          variableValues: { username: userName, userid: userId },
        });
      } else {
        let formattedQuestions = "";
        if (questions) {
          formattedQuestions = questions
            .map((question) => `- ${question}`)
            .join("\n");
        }
        await vapi.start(interviewer, {
          variableValues: { questions: formattedQuestions },
        });
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallStatus(CallStatus.INACTIVE);
      stopWebcam();
    }
  };

  // End call
  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
  };

  // Feedback loading screen
  if (isGeneratingFeedback) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <div className="w-14 h-14 border-4 border-primary-200 border-t-primary-100 rounded-full animate-spin" />
        <h3>Generating Your Feedback...</h3>
        <p className="text-sm text-light-100">
          AI is analyzing your interview. This may take a moment.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="AI Interviewer"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
          {isSpeaking && (
            <p className="text-sm text-primary-200 animate-pulse mt-1">
              🎙️ Speaking...
            </p>
          )}
        </div>

        {/* User Card — Live Webcam */}
        <div className="card-border">
          <div className="card-content">
            {webcamOn ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="rounded-full object-cover size-[120px] -scale-x-100 border-2 border-primary-200"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="hidden"
                />
                <Image
                  src="/user-avatar.png"
                  alt="User"
                  width={539}
                  height={539}
                  className="rounded-full object-cover size-[120px]"
                />
              </>
            )}
            <h3>{userName}</h3>
            {callStatus === "ACTIVE" && !isSpeaking && (
              <p className="text-xs text-light-100 mt-1">🎤 Listening...</p>
            )}
          </div>
        </div>
      </div>

      {/* Voice Transcript Log */}
      {messages.length > 0 && (
        <div className="w-full mt-5 bg-dark-200 rounded-2xl border border-dark-100 overflow-hidden">
          <div className="px-4 py-2 border-b border-dark-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-semibold text-light-100 uppercase tracking-wider">
              Live Transcript
            </span>
          </div>
          <div className="max-h-52 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col",
                  m.role === "user" ? "items-end" : "items-start"
                )}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider text-light-100 mb-0.5">
                  {m.role === "user" ? "You" : "Interviewer"}
                </span>
                <p
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm max-w-[85%] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary-200/20 text-primary-100 rounded-tr-sm"
                      : "bg-dark-300 text-light-100 rounded-tl-sm"
                  )}
                >
                  {m.content}
                </p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </div>
      )}

      {/* Latest message display */}
      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
          </div>
        </div>
      )}

      {/* Call / End buttons */}
      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />
            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleDisconnect}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;

