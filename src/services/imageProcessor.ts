

import { Jimp } from "jimp";
import { BeadColor, PatternData } from "../types";
import { hexToRgb, getColorDistance } from "../beadPalettes";

export const processImageToPattern = async (
  imageSrc: string,
  targetWidth: number,
  targetHeight: number | "auto",
  palette: BeadColor[],
  denoiseLevel: number = 0
): Promise<PatternData> => {
  try {
    const image = await Jimp.read(imageSrc);

    // Calculate aspect ratio
    const aspectRatio = image.height / image.width;
    const finalHeight =
      targetHeight === "auto"
        ? Math.round(targetWidth * aspectRatio)
        : targetHeight;

    // Resize image to grid dimensions (pixelate)
    image.resize({ w: targetWidth, h: finalHeight });

    const grid: BeadColor[][] = [];
    const counts: Record<string, number> = {};
    const paletteRgb = palette.map((p) => ({ ...p, rgb: hexToRgb(p.hex) }));

    if (paletteRgb.length === 0) {
      throw new Error("No colors in palette");
    }

    const { width, height, data } = image.bitmap;

    for (let y = 0; y < height; y++) {
      const row: BeadColor[] = [];
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Simple handling for transparency
        if (a < 128) {
          // Treat as transparent. Map to white or first color.
          const white =
            paletteRgb.find((c) => c.hex.toLowerCase() === "#ffffff") ||
            paletteRgb[0];
          const matchedBead: BeadColor = {
            id: white.id,
            name: white.name,
            hex: white.hex,
          };
          row.push(matchedBead);
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

        const matchedBead: BeadColor = {
          id: closestBead.id,
          name: closestBead.name,
          hex: closestBead.hex,
        };

        row.push(matchedBead);
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

    return {
      grid,
      counts: finalCounts,
      width: targetWidth,
      height: finalHeight,
    };
  } catch (err) {
    console.error("Image processing failed:", err);
    throw err;
  }
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
