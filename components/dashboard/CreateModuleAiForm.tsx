"use client";

import { useActionState, useState, useRef, useCallback, useEffect } from "react";
import { handleAiPrompt } from "@/app/dashboard/actions";

/** Minimal type for Web Speech API recognition (not in TS lib by default). */
type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string }; length: number } };
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CreateModuleAiForm({ tenantId }: { tenantId: string }) {
  const [prompt, setPrompt] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [state, formAction] = useActionState(
    handleAiPrompt.bind(null, tenantId),
    null
  );
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const interimRef = useRef("");
  interimRef.current = interim;

  const toggleListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      if (finalTranscript) {
        setPrompt((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript).trim());
        setInterim("");
      }
      if (interimTranscript) {
        setInterim(interimTranscript);
      } else if (!finalTranscript) {
        setInterim("");
      }
    };

    recognition.onend = () => {
      const remaining = interimRef.current;
      if (remaining) {
        setPrompt((prev) => (prev ? `${prev} ${remaining}` : remaining).trim());
      }
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [listening]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const supportsSpeech = mounted && !!getSpeechRecognition();

  const displayValue = listening && (prompt || interim) ? `${prompt}${interim ? ` ${interim}` : ""}`.trim() : prompt;

  const MicIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
  const StopIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );

  return (
    <form action={formAction} className="ai-create-module-form">
      <div className="ai-prompt-main">
        <label htmlFor="ai-prompt" className="ai-prompt-label">Ask for changes</label>
        <textarea
          id="ai-prompt"
          name="prompt"
          value={displayValue}
          onChange={(e) => {
            setPrompt(e.target.value);
            setInterim("");
          }}
          placeholder="One prompt for anything: create module, add/remove fields, create/edit/delete view, enable on public site, set default home, add a record, rename module, reorder sidebar. e.g. Create a module for events — Add location to Events — Show Events on public site — Add an event: Meetup, March 15 — Rename Events to Calendar"
          rows={3}
          className="ai-prompt-input"
        />
      </div>
      <div className="ai-prompt-actions">
        {supportsSpeech && (
          <button
            type="button"
            onClick={toggleListening}
            className={`ai-prompt-mic ${listening ? "ai-prompt-mic-active" : ""}`}
            title={listening ? "Stop capturing" : "Start voice input"}
            aria-label={listening ? "Stop capturing" : "Start voice input"}
          >
            {listening ? <StopIcon /> : <MicIcon />}
          </button>
        )}
        <button type="submit" className="btn btn-primary ai-prompt-apply">
          Apply
        </button>
      </div>
      {state && typeof state === "object" && "error" in state && (
        <p className="view-error" role="alert">
          {(state as { error: string }).error}
        </p>
      )}
    </form>
  );
}
