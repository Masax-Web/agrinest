const maxCompressedBytes = 1_000_000;

export function resizeImageForUpload(file, maxDimension = 1280) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return Promise.reject(new Error('Choose a valid image file.'));
  }
  if (file.size > 20_000_000) {
    return Promise.reject(new Error('Choose an image smaller than 20 MB.'));
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  return new Promise((resolve, reject) => {
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image processing is unavailable in this browser.');

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = [0.82, 0.68, 0.54]
          .map((quality) => canvas.toDataURL('image/webp', quality))
          .find((candidate) => {
            const encoded = candidate.split(',')[1] || '';
            return /^data:image\/(?:webp|jpeg|png);base64,/i.test(candidate)
              && Math.floor(encoded.length * 0.75) <= maxCompressedBytes;
          });
        if (!dataUrl) throw new Error('This image is too large to upload. Choose a smaller image.');

        cleanup();
        resolve(dataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    image.onerror = () => {
      cleanup();
      reject(new Error('Choose a valid image file.'));
    };
    image.src = objectUrl;
  });
}
