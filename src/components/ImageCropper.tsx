import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { NeuButton, NeuCard } from './NeumorphicComponents';
import { Jimp } from 'jimp';
import { translations } from '../translations';

interface Props {
  imageSrc: string;
  onConfirm: (croppedImageSrc: string) => void;
  onCancel: () => void;
  t: typeof translations.en;
}

// Helper to center the crop initially
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect?: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect || 16 / 9, // Default aspect, but we allow free crop
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export const ImageCropper: React.FC<Props> = ({ imageSrc, onConfirm, onCancel, t }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  };

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) {
      // If no crop, just return original
      onConfirm(imageSrc);
      return;
    }

    setIsProcessing(true);
    try {
      // Use Jimp for cropping as requested
      const image = await Jimp.read(imageSrc);
      
      // Calculate scale if the displayed image is scaled
      // But here we use the natural dimensions from the crop data if we use the image ref correctly
      // React-image-crop returns coordinates relative to the *displayed* image usually, 
      // but PixelCrop is in pixels. We need to map it to natural dimensions.
      
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const x = Math.round(completedCrop.x * scaleX);
      const y = Math.round(completedCrop.y * scaleY);
      const w = Math.round(completedCrop.width * scaleX);
      const h = Math.round(completedCrop.height * scaleY);

      // Validate dimensions
      if (w <= 0 || h <= 0) {
          onConfirm(imageSrc);
          return;
      }

      image.crop({ x, y, w, h });
      
      // 使用 getBase64 替代 getBase64Async
      const base64 = await image.getBase64("image/png");
      onConfirm(base64);
    } catch (err) {
      console.error("Jimp cropping failed:", err);
      alert(t.cropError);
      onConfirm(imageSrc);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-0 md:p-4">
      <NeuCard className="bg-slate-200 max-w-7xl w-full h-[100dvh] md:h-[90vh] flex flex-col gap-2 md:gap-4 overflow-hidden rounded-none md:rounded-2xl">
        <div className="flex justify-between items-center border-b border-slate-300 pb-2 px-4 pt-2 md:pt-0">
            <h2 className="text-xl font-bold text-slate-700">{t.cropTitle}</h2>
            <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="flex-1 min-h-0 overflow-auto flex bg-slate-800/10 rounded-lg p-2 md:p-4">
            <ReactCrop 
                crop={crop} 
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                className="m-auto"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
            >
                <img 
                    ref={imgRef}
                    src={imageSrc} 
                    alt={t.cropImageAlt}
                    onLoad={onImageLoad}
                    className="max-w-full max-h-[calc(100dvh-180px)] md:max-h-[calc(90vh-160px)] object-contain"
                />
            </ReactCrop>
        </div>

        <div 
            className="flex justify-end gap-4 pt-2 px-4 pb-4 md:pb-0"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
            <NeuButton onClick={onCancel} className="bg-slate-300 text-slate-600 hover:bg-slate-400">
                {t.cropCancel}
            </NeuButton>
            <NeuButton 
                onClick={handleCropConfirm} 
                className="bg-blue-500 text-white hover:bg-blue-600"
                disabled={isProcessing}
            >
                {isProcessing ? t.processing : t.cropConfirm}
            </NeuButton>
        </div>
      </NeuCard>
    </div>
  );
};
