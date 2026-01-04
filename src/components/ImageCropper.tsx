import React, { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { NeuButton, NeuCard } from './NeumorphicComponents';
import { Jimp } from 'jimp';
import { translations } from '../translations';
import { Logger } from '../services/logger';
import { Icon } from '@iconify/react';

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
        unit: 'px',
        width: mediaWidth * 0.9,
      },
      aspect || 16 / 9,
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
    Logger.log('crop_image_loaded', { width, height });
    const startCrop = centerAspectCrop(width, height);
    setCrop(startCrop);
    setCompletedCrop(startCrop);
  };

  const handleCancel = () => {
    Logger.log('crop_cancelled');
    onCancel();
  };

  const handleCropConfirm = async () => {
    if (!completedCrop || !imgRef.current) {
      onConfirm(imageSrc);
      return;
    }

    setIsProcessing(true);
    try {
      const image = await Jimp.read(imageSrc);
      const img = imgRef.current;
      
      // Ensure we have valid dimensions
      if (!img.width || !img.height) {
        throw new Error("Image dimensions not available");
      }

      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;

      const x = Math.round(completedCrop.x * scaleX);
      const y = Math.round(completedCrop.y * scaleY);
      const w = Math.round(completedCrop.width * scaleX);
      const h = Math.round(completedCrop.height * scaleY);

      // Boundary checks to prevent rounding errors causing out-of-bounds
      const safeX = Math.max(0, x);
      const safeY = Math.max(0, y);
      const safeW = Math.min(w, img.naturalWidth - safeX);
      const safeH = Math.min(h, img.naturalHeight - safeY);

      // Validate dimensions
      if (safeW <= 0 || safeH <= 0) {
          onConfirm(imageSrc);
          return;
      }

      image.crop({ x: safeX, y: safeY, w: safeW, h: safeH });
      
      // 使用 getBase64 替代 getBase64Async
      const base64 = await image.getBase64("image/png");
      Logger.log('crop_success', { width: safeW, height: safeH });
      onConfirm(base64);
    } catch (err) {
      console.error("Jimp cropping failed:", err);
      Logger.log('crop_failed', { error: String(err) });
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
            <button onClick={handleCancel} className="text-slate-500 hover:text-slate-700">
                <Icon icon="lucide:x" className="w-6 h-6" />
            </button>
        </div>
        
        <div className="flex-1 min-h-0 overflow-auto flex bg-slate-800/10 rounded-lg p-2 md:p-4 touch-none">
            <ReactCrop 
                crop={crop} 
                onChange={(pixelCrop) => setCrop(pixelCrop)}
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
            <NeuButton onClick={handleCancel} className="bg-slate-300 text-slate-600 hover:bg-slate-400">
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
