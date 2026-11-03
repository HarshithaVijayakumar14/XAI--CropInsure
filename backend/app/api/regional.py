from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from backend.app.services.sarvam_service import sarvam_service

router = APIRouter()

class TranslationRequest(BaseModel):
    text: str
    target_language: str
    source_language: Optional[str] = "en-IN"

class BatchTranslationRequest(BaseModel):
    texts: List[str]
    target_language: str
    source_language: Optional[str] = "en-IN"

class TTSRequest(BaseModel):
    text: str
    target_language: str = "kn-IN"

@router.get("/languages")
def get_supported_languages():
    """Lists supported Indian regional languages and Sarvam API readiness."""
    languages = sarvam_service.get_supported_languages()
    return {
        "languages": languages,
        "sarvam_api_configured": sarvam_service.is_configured(),
        "default_language": "en-IN",
        "priority_language": "kn-IN"  # Kannada highlighted for ordinary Indian farmers
    }

@router.post("/translate")
def translate_text(req: TranslationRequest):
    """Translates single text string into target regional language."""
    res = sarvam_service.translate_text(
        text=req.text,
        target_lang=req.target_language,
        source_lang=req.source_language or "en-IN"
    )
    return res

@router.post("/translate-batch")
def translate_batch(req: BatchTranslationRequest):
    """Translates multiple text strings into target regional language."""
    results = []
    for t in req.texts:
        res = sarvam_service.translate_text(
            text=t,
            target_lang=req.target_language,
            source_lang=req.source_language or "en-IN"
        )
        results.append(res.get("translated_text", t))
    return {
        "translations": results,
        "target_language": req.target_language
    }

@router.post("/tts")
def text_to_speech(req: TTSRequest):
    """Converts farmer text into audible speech using Sarvam AI Bulbul model."""
    res = sarvam_service.text_to_speech(
        text=req.text,
        target_lang=req.target_language
    )
    return res

@router.post("/stt")
async def speech_to_text(
    file: UploadFile = File(...),
    language_code: Optional[str] = Form(None)
):
    """Converts farmer voice audio to text using Sarvam AI Saaras model."""
    audio_bytes = await file.read()
    res = sarvam_service.speech_to_text(
        audio_file_bytes=audio_bytes,
        language_code=language_code
    )
    return res

