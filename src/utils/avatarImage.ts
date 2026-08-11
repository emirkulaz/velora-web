const MAX_SOURCE_BYTES = 2 * 1024 * 1024
const MAX_EDGE = 256
const JPEG_QUALITY = 0.85

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Görsel okunamadı.'))
    }
    image.src = url
  })
}

/** Resize/compress a profile photo to a JPEG data URL suitable for API storage. */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Yalnızca görsel dosyaları yüklenebilir.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Dosya en fazla 2 MB olabilir.')
  }

  const image = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Görsel işlenemedi.')
  context.drawImage(image, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  if (dataUrl.length > 350_000) {
    throw new Error('Görsel sıkıştırıldıktan sonra hâlâ çok büyük. Daha küçük bir foto deneyin.')
  }
  return dataUrl
}
