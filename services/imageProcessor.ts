import { BeadColor, PatternData } from '../types';
import { BEAD_PALETTE, hexToRgb, getColorDistance } from '../constants';

export const processImageToPattern = (
  imageSrc: string,
  targetWidth: number,
  targetHeight: number | 'auto'
): Promise<PatternData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      // Calculate aspect ratio
      const aspectRatio = img.height / img.width;
      const finalHeight = targetHeight === 'auto' 
        ? Math.round(targetWidth * aspectRatio) 
        : targetHeight;

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw resized image (browser does basic resampling here)
      ctx.drawImage(img, 0, 0, targetWidth, finalHeight);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, targetWidth, finalHeight);
      const data = imageData.data;

      const grid: BeadColor[][] = [];
      const counts: Record<string, number> = {};

      // Pre-calculate RGB for palette
      const paletteRgb = BEAD_PALETTE.map(p => ({ ...p, rgb: hexToRgb(p.hex) }));

      for (let y = 0; y < finalHeight; y++) {
        const row: BeadColor[] = [];
        for (let x = 0; x < targetWidth; x++) {
          const i = (y * targetWidth + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Simple handling for transparency
          if (a < 128) {
             // Treat as transparent/no bead. 
             // We'll use a placeholder "None" bead or just skip. 
             // For this app, let's just map to White if transparent, or maybe closest.
             // Let's assume white background for transparency for now.
             // Better: Use a specific ID for empty if needed, but for "materials" let's match to palette.
          }

          const currentPixel = { r, g, b };
          
          let minDistance = Infinity;
          let closestBead = paletteRgb[0];

          for (const bead of paletteRgb) {
            const dist = getColorDistance(currentPixel, bead.rgb);
            if (dist < minDistance) {
              minDistance = dist;
              closestBead = bead;
            }
          }

          // Convert back to simple BeadColor to avoid storing RGB in state
          const matchedBead: BeadColor = {
             id: closestBead.id,
             name: closestBead.name,
             hex: closestBead.hex
          };

          row.push(matchedBead);
          counts[matchedBead.id] = (counts[matchedBead.id] || 0) + 1;
        }
        grid.push(row);
      }

      resolve({
        grid,
        counts,
        width: targetWidth,
        height: finalHeight
      });
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
};
