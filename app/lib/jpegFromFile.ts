const AVATAR_EDGE = 1280;

export async function jpegFromFile(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("could not read that image");
  }
  try {
    const scale = Math.min(1, AVATAR_EDGE / Math.max(bitmap.width, bitmap.height));
    if (file.type === "image/jpeg" && scale === 1 && file.size <= 5 * 1024 * 1024) {
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("could not encode jpeg");
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      throw new Error("could not encode jpeg");
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
