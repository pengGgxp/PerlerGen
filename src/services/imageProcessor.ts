import { BeadColor, PatternData } from "../types";
import { hexToRgb, getColorDistance } from "../beadPalettes";

export const processImageToPattern = (
  imageSrc: string,
  targetWidth: number,
  targetHeight: number | "auto",
  palette: BeadColor[],
  denoiseLevel: number = 0
): Promise<PatternData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // Calculate aspect ratio
      const aspectRatio = img.height / img.width;
      const finalHeight =
        targetHeight === "auto"
          ? Math.round(targetWidth * aspectRatio)
          : targetHeight;

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
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
      const paletteRgb = palette.map((p) => ({ ...p, rgb: hexToRgb(p.hex) }));

      if (paletteRgb.length === 0) {
        reject(new Error("No colors in palette"));
        return;
      }

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
            // Treat as transparent. We just map to the first color (usually black or white)
            // or ideally we skip. But for the grid array we need a value.
            // We'll map to White or closest lighter color if possible, or just the first one.
            // Let's assume white for background/transparency if available.
            const white =
              paletteRgb.find((c) => c.hex.toLowerCase() === "#ffffff") ||
              paletteRgb[0];
            const matchedBead: BeadColor = {
              id: white.id,
              name: white.name,
              hex: white.hex,
            };
            row.push(matchedBead);
            // Optionally don't count it if it's "background", but for now we count everything.
            counts[matchedBead.id] = (counts[matchedBead.id] || 0) + 1;
            continue;
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
            hex: closestBead.hex,
          };

          row.push(matchedBead);
          // Initial count (will be recalculated after denoise)
        }
        grid.push(row);
      }

      // Apply Denoising if requested
      if (denoiseLevel > 0) {
        // Run denoise passes
        // Strategy: Iterative "Smart Despeckle"
        // Level determines number of iterations and aggressiveness
        let currentGrid = grid;

        // Dynamic settings based on level
        const iterations = Math.min(denoiseLevel, 5); // Cap at 5 passes
        const threshold = denoiseLevel >= 3 ? 3 : 2; // Higher levels = more aggressive (remove larger clusters)

        for (let i = 0; i < iterations; i++) {
          currentGrid = applyDenoisePass(currentGrid, threshold);
        }
        // Update reference
        grid.splice(0, grid.length, ...currentGrid);
      }

      // Recalculate counts after all processing
      const finalCounts: Record<string, number> = {};
      grid.forEach((row) => {
        row.forEach((bead) => {
          finalCounts[bead.id] = (finalCounts[bead.id] || 0) + 1;
        });
      });

      resolve({
        grid,
        counts: finalCounts,
        width: targetWidth,
        height: finalHeight,
      });
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
};

// Helper: Single Pass Denoise (Mode Filter / Despeckle)
const applyDenoisePass = (
  grid: BeadColor[][],
  threshold: number
): BeadColor[][] => {
  const height = grid.length;
  const width = grid[0].length;
  const newGrid = grid.map((row) => [...row]); // Shallow copy for new state

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const currentBead = grid[y][x];

      // Collect neighbors (3x3 window)
      const neighborCounts: Record<string, number> = {};
      const neighborMap: Record<string, BeadColor> = {};
      let totalNeighbors = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;

          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const bead = grid[ny][nx];
            neighborCounts[bead.id] = (neighborCounts[bead.id] || 0) + 1;
            if (!neighborMap[bead.id]) neighborMap[bead.id] = bead;
            totalNeighbors++;
          }
        }
      }

      // Logic: If current bead's color count in neighborhood is below threshold,
      // swap it to the most frequent color in the neighborhood.
      const selfCount = neighborCounts[currentBead.id] || 0;

      if (selfCount < threshold) {
        // Find majority color
        let maxCount = -1;
        let majorityId = currentBead.id;

        Object.entries(neighborCounts).forEach(([id, count]) => {
          if (count > maxCount) {
            maxCount = count;
            majorityId = id;
          }
        });

        if (majorityId !== currentBead.id) {
          newGrid[y][x] = neighborMap[majorityId];
        }
      }
    }
  }
  return newGrid;
};
