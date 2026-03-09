"use client";

import { useActionState, useState, useRef, useCallback, useEffect } from "react";
import { handleAiPrompt } from "@/app/dashboard/actions";

function getSpeechRecognition(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ??
    null
  );
}

export function CreateModuleAiForm({ tenantId }: { tenantId: string }) {
  const [prompt, setPrompt] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [state, formAction] = useActionState(
    handleAiPrompt.bind(null, tenantId),
    null
  );
  const recognitionRef = useRef<InstanceType<NonNullable<ReturnType<typeof getSpeechRecognition>>> | null>(null);
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

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

  return (
    <form action={formAction} className="ai-create-module-form">
      <div className="form-group">
        <label htmlFor="ai-prompt">Ask for changes</label>
        <div className="ai-prompt-row">
          <textarea
            id="ai-prompt"
            name="prompt"
            value={displayValue}
            onChange={(e) => {
              setPrompt(e.target.value);
              setInterim("");
            }}
            placeholder="e.g. Create a module for events — Add location to Events — Show Events on public site — Set default home to Events — Add an event: Meetup, March 15, 25 — Delete the All view from Events — Rename Events to Calendar — Remove location field from Events — Move description before date on Events — Move Events to the top"
            rows={3}
            className="ai-prompt-input"
            aria-describedby="ai-hint"
          />
          {supportsSpeech && (
            <button
              type="button"
              onClick={toggleListening}
              className={`ai-prompt-mic ${listening ? "ai-prompt-mic-active" : ""}`}
              title={listening ? "Stop capturing" : "Start voice input"}
              aria-label={listening ? "Stop capturing" : "Start voice input"}
            >
              {listening ? "Stop" : "Start"}
            </button>
          )}
        </div>
        <p className="form-hint" id="ai-hint">
          One prompt for anything: create module, add/remove fields, create/edit/delete view, enable module on public site, set default home, add a record, rename module, reorder sidebar. Set <code>OPENAI_API_KEY</code> for best results.
          {supportsSpeech && " Use Start to capture voice, Stop when done, then Apply."}
        </p>
      </div>
      {state && typeof state === "object" && "error" in state && (
        <p className="view-error" role="alert">
          {(state as { error: string }).error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Apply
      </button>
    </form>
  );
}
