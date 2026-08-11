import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const speechWindow = window as SpeechWindow
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

export function useSpeechToText(onText: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState('')
  const onTextRef = useRef(onText)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)

  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  useEffect(
    () => () => {
      shouldListenRef.current = false
      recognitionRef.current?.stop()
    },
    [],
  )

  const start = useCallback(() => {
    const Recognition = recognitionConstructor()
    if (!Recognition) {
      setError('Bu tarayıcı konuşmayı metne çevirme özelliğini desteklemiyor.')
      return
    }

    shouldListenRef.current = true
    setError('')

    const beginRecognition = () => {
      if (!shouldListenRef.current) return

      const recognition = new Recognition()
      recognition.lang = 'tr-TR'
      recognition.continuous = true
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .filter((result) => result.isFinal)
          .map((result) => result[0].transcript)
          .join(' ')
          .trim()

        if (transcript) onTextRef.current(transcript)
      }
      recognition.onerror = (event) => {
        const permissionDenied =
          event.error === 'not-allowed' || event.error === 'service-not-allowed'
        if (permissionDenied) {
          shouldListenRef.current = false
          setError('Mikrofon izni verilmedi. Tarayıcı ayarlarından izin verin.')
        } else if (event.error !== 'no-speech') {
          setError('Sesli giriş kesildi. Otomatik olarak yeniden bağlanıyor…')
        }
      }
      recognition.onend = () => {
        recognitionRef.current = null
        if (shouldListenRef.current) {
          window.setTimeout(beginRecognition, 250)
          return
        }
        setIsListening(false)
      }

      recognitionRef.current = recognition
      try {
        recognition.start()
        setIsListening(true)
      } catch {
        shouldListenRef.current = false
        setIsListening(false)
        setError('Sesli giriş başlatılamadı. Lütfen tekrar deneyin.')
      }
    }

    beginRecognition()
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  return {
    isSupported: Boolean(recognitionConstructor()),
    isListening,
    error,
    start,
    stop,
  }
}
