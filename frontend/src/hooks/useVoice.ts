import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

export interface UseVoiceOptions {
  onSpeechEnd?: () => void;
}

export function useVoice() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      stopRecording();
    };
  }, []);

  /**
   * Reads text aloud using Sarvam AI TTS if configured, or Web Speech API fallback.
   */
  const speak = async (text: string, lang: string = 'kn-IN', speechId: string = 'general') => {
    if (!text || !text.trim()) return;

    // Stop existing audio
    stopAudio();

    setIsPlaying(true);
    setActiveSpeechId(speechId);
    setVoiceNotice(null);

    try {
      // 1. Attempt Sarvam TTS via backend
      const res = await api.regional.tts(text.trim(), lang);
      if (res.success && res.audios && res.audios.length > 0) {
        const audioData = res.audios[0];
        const audioSrc = `data:audio/wav;base64,${audioData}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;

        audio.onended = () => {
          setIsPlaying(false);
          setActiveSpeechId(null);
        };

        audio.onerror = () => {
          console.warn('Sarvam audio playback failed, falling back to browser speech synthesis');
          speakWithBrowserFallback(text, lang);
        };

        await audio.play();
        return;
      } else {
        // Fallback to browser speech synthesis
        speakWithBrowserFallback(text, lang);
      }
    } catch (err) {
      console.warn('Sarvam TTS API error, falling back to browser speech synthesis:', err);
      speakWithBrowserFallback(text, lang);
    }
  };

  /**
   * Browser SpeechSynthesis fallback (native in all modern browsers)
   */
  const speakWithBrowserFallback = (text: string, lang: string) => {
    if (!('speechSynthesis' in window)) {
      setIsPlaying(false);
      setActiveSpeechId(null);
      setVoiceNotice('Audio speech synthesis is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;
    utterance.rate = 0.95; // Slightly slower, clear pace for farmers

    utterance.onend = () => {
      setIsPlaying(false);
      setActiveSpeechId(null);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setActiveSpeechId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  /**
   * Immediately stops any current audio playback.
   */
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setActiveSpeechId(null);
  };

  /**
   * Starts microphone recording for speech-to-text.
   */
  const startRecording = (
    lang: string,
    onResult: (transcript: string) => void,
    fieldId: string = 'input'
  ) => {
    stopRecording();
    setIsRecording(true);
    setRecordingId(fieldId);
    setVoiceNotice(null);

    // 1. Try Web Speech API SpeechRecognition first (instant live transcription)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            onResult(transcript);
          }
          setIsRecording(false);
          setRecordingId(null);
        };

        recognition.onerror = (event: any) => {
          console.warn('SpeechRecognition error:', event.error);
          setIsRecording(false);
          setRecordingId(null);
          // If permission denied or recognition error, try MediaRecorder fallback to Sarvam STT
          if (event.error !== 'not-allowed') {
            fallbackMediaRecorder(lang, onResult, fieldId);
          } else {
            setVoiceNotice('Microphone permission was denied. Please allow microphone access to speak.');
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          setRecordingId(null);
        };

        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition startup error:', err);
      }
    }

    // 2. MediaRecorder fallback to backend Sarvam STT
    fallbackMediaRecorder(lang, onResult, fieldId);
  };

  const fallbackMediaRecorder = async (
    lang: string,
    onResult: (transcript: string) => void,
    fieldId: string
  ) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsRecording(false);
      setRecordingId(null);
      setVoiceNotice('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setRecordingId(null);
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        try {
          const res = await api.regional.stt(audioBlob, lang);
          if (res.success && res.transcript) {
            onResult(res.transcript);
          } else if (res.message) {
            setVoiceNotice(res.message);
          }
        } catch (err: any) {
          setVoiceNotice('Could not transcribe audio. Please type your message.');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      setIsRecording(false);
      setRecordingId(null);
      setVoiceNotice('Could not access microphone.');
    }
  };

  /**
   * Stops current microphone recording.
   */
  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingId(null);
  };

  return {
    isPlaying,
    activeSpeechId,
    isRecording,
    recordingId,
    voiceNotice,
    speak,
    stopAudio,
    startRecording,
    stopRecording
  };
}

