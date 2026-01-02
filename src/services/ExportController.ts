import JSZip from "jszip";
import { saveAs } from "file-saver";
import { PatternData, BeadColor } from "../types";
import { drawPatternToCanvas, drawMaterialListToCanvas } from "./exportUtils";

import { TranslationMap } from "../translations";

export interface ExportContext {
  siteLabel: string;
  translations: TranslationMap;
}

export interface PatternExportOptions {
  patternData: PatternData;
  beadShape: "round" | "square";
  hiddenBeadIds: Set<string>;
}

export interface SplitExportOptions extends PatternExportOptions {
  splitConfig: { width: number; height: number };
  isDualExport: boolean;
}

export interface MaterialExportOptions {
  patternData: PatternData;
  activePaletteColors: BeadColor[];
  hiddenBeadIds: Set<string>;
  excludeHiddenMaterials: boolean;
}

export class ExportController {
  /**
   * Handles the main download action.
   * Redirects to Dual Export if isDualExport is true, otherwise performs standard single image export.
   */
  static async handleDownload(
    context: ExportContext,
    options: PatternExportOptions & { isDualExport: boolean }
  ): Promise<void> {
    const { isDualExport, ...baseOptions } = options;

    if (isDualExport) {
      await this.exportDualPattern(context, baseOptions);
    } else {
      await this.exportSinglePattern(context, baseOptions);
    }
  }

  /**
   * Exports a single pattern image.
   */
  static async exportSinglePattern(
    context: ExportContext,
    options: PatternExportOptions
  ): Promise<void> {
    const { patternData, beadShape, hiddenBeadIds } = options;
    const { siteLabel } = context;

    const canvas = drawPatternToCanvas(patternData, {
      startX: 0,
      startY: 0,
      width: patternData.width,
      height: patternData.height,
      beadShape,
      hiddenBeadIds,
      title: `${siteLabel} - ${patternData.width}x${patternData.height}`,
    });

    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        saveAs(
          blob,
          `perler-pattern-w${patternData.width}-h${patternData.height}.png`
        );
      }
    });
  }

  /**
   * Exports a dual pattern (P1 Normal + P2 Rotated) as a ZIP file.
   */
  static async exportDualPattern(
    context: ExportContext,
    options: PatternExportOptions
  ): Promise<void> {
    const { patternData, beadShape, hiddenBeadIds } = options;
    const { siteLabel } = context;

    try {
      const zip = new JSZip();

      // 1. Normal View (Player 1)
      const canvas1 = drawPatternToCanvas(patternData, {
        startX: 0,
        startY: 0,
        width: patternData.width,
        height: patternData.height,
        beadShape,
        hiddenBeadIds,
        title: `${siteLabel} - P1 (Normal)`,
      });

      if (canvas1) {
        const blob1 = await new Promise<Blob | null>((resolve) =>
          canvas1.toBlob(resolve)
        );
        if (blob1) zip.file(`pattern_p1_normal.png`, blob1);
      }

      // 2. Rotated View (Player 2)
      const canvas2 = drawPatternToCanvas(patternData, {
        startX: 0,
        startY: 0,
        width: patternData.width,
        height: patternData.height,
        beadShape,
        hiddenBeadIds,
        title: `${siteLabel} - P2 (Face-to-Face 180°)`,
        rotation: 180,
      });

      if (canvas2) {
        const blob2 = await new Promise<Blob | null>((resolve) =>
          canvas2.toBlob(resolve)
        );
        if (blob2) zip.file(`pattern_p2_rotated_text.png`, blob2);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "perler-pattern-dual-coop.zip");
    } catch (error) {
      console.error("Dual export failed", error);
      throw error; // Re-throw to let caller handle/show alert if needed
    }
  }

  /**
   * Exports the pattern split into chunks as a ZIP file.
   */
  static async exportSplitPattern(
    context: ExportContext,
    options: SplitExportOptions
  ): Promise<void> {
    const { patternData, beadShape, hiddenBeadIds, splitConfig, isDualExport } =
      options;
    const { siteLabel } = context;

    try {
      const zip = new JSZip();
      const { width: chunkW, height: chunkH } = splitConfig;

      const rows = Math.ceil(patternData.height / chunkH);
      const cols = Math.ceil(patternData.width / chunkW);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const startX = c * chunkW;
          const startY = r * chunkH;
          const currentWidth = Math.min(chunkW, patternData.width - startX);
          const currentHeight = Math.min(chunkH, patternData.height - startY);

          const canvas = drawPatternToCanvas(patternData, {
            startX,
            startY,
            width: currentWidth,
            height: currentHeight,
            beadShape,
            hiddenBeadIds,
            title: isDualExport
              ? `P1 - ${siteLabel} (${r + 1}-${c + 1})`
              : `${siteLabel} - ${r + 1}-${c + 1}`,
          });

          if (canvas) {
            const blob = await new Promise<Blob | null>((resolve) =>
              canvas.toBlob(resolve)
            );
            if (blob) {
              zip.file(
                `row${r + 1}_col${c + 1}${isDualExport ? "_P1" : ""}.png`,
                blob
              );
            }
          }

          // If Dual Export is enabled, generate P2 chunk (Rotated Text)
          if (isDualExport) {
            const canvasP2 = drawPatternToCanvas(patternData, {
              startX,
              startY,
              width: currentWidth,
              height: currentHeight,
              beadShape,
              hiddenBeadIds,
              title: `P2 - ${siteLabel} (${r + 1}-${c + 1})`,
              rotation: 180,
            });

            if (canvasP2) {
              const blobP2 = await new Promise<Blob | null>((resolve) =>
                canvasP2.toBlob(resolve)
              );
              if (blobP2) {
                zip.file(`row${r + 1}_col${c + 1}_P2.png`, blobP2);
              }
            }
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "perler-pattern-split.zip");
    } catch (error) {
      console.error("Split export failed", error);
      throw error;
    }
  }

  /**
   * Exports the material list as an image.
   */
  static async exportMaterialList(
    context: ExportContext,
    options: MaterialExportOptions
  ): Promise<void> {
    const {
      patternData,
      activePaletteColors,
      hiddenBeadIds,
      excludeHiddenMaterials,
    } = options;
    const { siteLabel, translations } = context;

    const canvas = drawMaterialListToCanvas(
      patternData,
      activePaletteColors,
      hiddenBeadIds,
      excludeHiddenMaterials,
      `${siteLabel} - ${translations.materials}`
    );

    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          saveAs(
            blob,
            `perler-materials-${patternData.width}x${patternData.height}.png`
          );
        }
      });
    }
  }
}
