import { Jimp } from "jimp";
import chroma from "chroma-js";
import { BeadColor, PatternData } from "../types";
import { hexToRgb } from "../beadPalettes";

// Helper: Median Filter for Denoising
const applyMedianFilter = (
  width: number,
  height: number,
  data: Uint8Array | any,
  radius: number = 1
): { data: Uint8Array; width: number; height: number } => {
  const outputData = new Uint8Array(data.length);
  const size = (2 * radius + 1) * (2 * radius + 1);
  const mid = Math.floor(size / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const rValues: number[] = [];
      const gValues: number[] = [];
      const bValues: number[] = [];

      for (let ry = -radius; ry <= radius; ry++) {
        for (let rx = -radius; rx <= radius; rx++) {
          let nx = x + rx;
          let ny = y + ry;
          nx = Math.min(Math.max(nx, 0), width - 1);
          ny = Math.min(Math.max(ny, 0), height - 1);
          const nIdx = (ny * width + nx) * 4;
          rValues.push(data[nIdx]);
          gValues.push(data[nIdx + 1]);
          bValues.push(data[nIdx + 2]);
        }
      }

      rValues.sort((a, b) => a - b);
      gValues.sort((a, b) => a - b);
      bValues.sort((a, b) => a - b);

      outputData[idx] = rValues[mid];
      outputData[idx + 1] = gValues[mid];
      outputData[idx + 2] = bValues[mid];
      outputData[idx + 3] = data[idx + 3]; // Alpha
    }
  }

  return { width, height, data: outputData };
};

// Helper: Kuwahara Filter for Image Smoothing
const applyKuwaharaFilter = (
  width: number,
  height: number,
  data: Uint8Array | any,
  radius: number = 3 // Kernel radius
): { data: Uint8Array; width: number; height: number } => {
  const outputData = new Uint8Array(data.length);

  // Pre-calculate squared integral images for fast mean/variance calculation could be an optimization
  // But for client-side JS with smallish images, a direct sliding window is acceptable for now.
  // We will implement the standard Kuwahara filter logic.

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Handle borders simply by copying or clamping. Here we just process valid pixels and leave borders.
      // Or better, clamp coordinates.

      const subregions = [
        { x: -radius, y: -radius, w: radius + 1, h: radius + 1 }, // Top-Left
        { x: 0, y: -radius, w: radius + 1, h: radius + 1 }, // Top-Right
        { x: -radius, y: 0, w: radius + 1, h: radius + 1 }, // Bottom-Left
        { x: 0, y: 0, w: radius + 1, h: radius + 1 }, // Bottom-Right
      ];

      let minVariance = Infinity;
      let bestMean = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };

      for (const region of subregions) {
        let sumR = 0,
          sumG = 0,
          sumB = 0;
        let sumSqR = 0,
          sumSqG = 0,
          sumSqB = 0;
        let count = 0;

        for (let ry = region.y; ry < region.y + region.h; ry++) {
          for (let rx = region.x; rx < region.x + region.w; rx++) {
            let nx = x + rx;
            let ny = y + ry;

            // Clamp to image bounds
            nx = Math.min(Math.max(nx, 0), width - 1);
            ny = Math.min(Math.max(ny, 0), height - 1);

            const nIdx = (ny * width + nx) * 4;
            const r = data[nIdx];
            const g = data[nIdx + 1];
            const b = data[nIdx + 2];

            sumR += r;
            sumG += g;
            sumB += b;
            sumSqR += r * r;
            sumSqG += g * g;
            sumSqB += b * b;
            count++;
          }
        }

        const meanR = sumR / count;
        const meanG = sumG / count;
        const meanB = sumB / count;

        const varR = sumSqR / count - meanR * meanR;
        const varG = sumSqG / count - meanG * meanG;
        const varB = sumSqB / count - meanB * meanB;

        const totalVariance = varR + varG + varB;

        if (totalVariance < minVariance) {
          minVariance = totalVariance;
          bestMean = { r: meanR, g: meanG, b: meanB };
        }
      }

      outputData[idx] = bestMean.r;
      outputData[idx + 1] = bestMean.g;
      outputData[idx + 2] = bestMean.b;
      outputData[idx + 3] = data[idx + 3]; // Alpha
    }
  }

  return { width, height, data: outputData };
};

export const processImageToPattern = async (
  imageSrc: string,
  targetWidth: number,
  targetHeight: number | "auto",
  palette: BeadColor[],
  denoiseLevel: number = 0
): Promise<PatternData> => {
  try {
    const image = await Jimp.read(imageSrc);

    // 1. Calculate aspect ratio
    const aspectRatio = image.height / image.width;
    const finalHeight =
      targetHeight === "auto"
        ? Math.round(targetWidth * aspectRatio)
        : targetHeight;

    // 2. Pre-processing: Denoise & Smooth
    // Pipeline: Median Filter (Denoise) -> Kuwahara Filter (Stylize/Smooth)
    // Optimization: Resize to a "medium" working resolution (e.g., 4x target size) first.
    const workingWidth = Math.min(image.bitmap.width, targetWidth * 4);
    const workingHeight = Math.min(image.bitmap.height, finalHeight * 4);

    image.resize({ w: workingWidth, h: workingHeight }); // Standard bilinear resize for downscaling

    if (denoiseLevel > 0) {
      // Step A: Median Filter (Good for "Salt & Pepper" noise)
      // Radius increases with denoiseLevel (1 to 2)
      if (denoiseLevel >= 3) {
        const medianRadius = denoiseLevel >= 7 ? 2 : 1;
        const denoised = applyMedianFilter(
          image.bitmap.width,
          image.bitmap.height,
          image.bitmap.data,
          medianRadius
        );
        image.bitmap.data = denoised.data as any;
      }

      // Step B: Kuwahara Filter (Oil Painting Effect / Blocky Smoothing)
      // Radius: 2 to 4 based on level
      const kuwaharaRadius = 2 + Math.floor(denoiseLevel / 3);
      const smoothed = applyKuwaharaFilter(
        image.bitmap.width,
        image.bitmap.height,
        image.bitmap.data,
        kuwaharaRadius
      );
      image.bitmap.data = smoothed.data as any;
    }

    // TODO: Add ONNX Runtime integration here for Deep Learning models (e.g. NAFNet)
    // if (modelLoaded) { await runOnnxModel(image); }

    // 3. Pixelation (Resize to final grid)
    // Use Nearest Neighbor to keep the hard edges created by Kuwahara
    image.resize({
      w: targetWidth,
      h: finalHeight,
      mode: "nearestNeighbor" as any,
    });

    const grid: BeadColor[][] = [];
    const counts: Record<string, number> = {};

    // Pre-calculate Lab colors for palette
    const paletteLab = palette.map((p) => ({
      ...p,
      lab: chroma(p.hex).lab(),
    }));

    if (paletteLab.length === 0) {
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
            paletteLab.find((c) => c.hex.toLowerCase() === "#ffffff") ||
            paletteLab[0];
          const matchedBead: BeadColor = {
            id: white.id,
            name: white.name,
            hex: white.hex,
          };
          row.push(matchedBead);
          counts[matchedBead.id] = (counts[matchedBead.id] || 0) + 1;
          continue;
        }

        // 4. Color Quantization (CIELAB Delta E)
        const currentLab = chroma.rgb(r, g, b).lab();

        let minDistance = Infinity;
        let closestBead = paletteLab[0];

        for (const bead of paletteLab) {
          // Chroma.js deltaE (CIE76 by default, fast and good enough)
          // For better results, we can calculate DeltaE 2000 manually if needed,
          // but Euclidean in Lab space is already a huge upgrade over RGB.
          // Note: chroma.deltaE(color1, color2) accepts hex/css strings or chroma objects.

          // Manual Euclidean in Lab for speed (Delta E 76)
          const dL = currentLab[0] - bead.lab[0];
          const da = currentLab[1] - bead.lab[1];
          const db = currentLab[2] - bead.lab[2];
          const dist = Math.sqrt(dL * dL + da * da + db * db);

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

    // 5. Post-processing: Smart Despeckle (Mode Filter)
    // Only run if denoiseLevel > 0
    if (denoiseLevel > 0) {
      let currentGrid = grid;
      // Iterations based on denoise level (1 to 5 passes)
      const iterations = Math.ceil(denoiseLevel / 2);
      // Threshold: if a pixel has fewer than X neighbors of same color, it's noise.
      // Strictness increases with level.
      const threshold = denoiseLevel >= 5 ? 3 : 2;

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
