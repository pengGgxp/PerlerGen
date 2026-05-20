import { BeadColor } from "../types";

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const parsePaletteCSV = (csvContent: string): BeadColor[] => {
  const lines = csvContent.split(/\r?\n/);
  const colors: BeadColor[] = [];

  // Expected headers: id, name, hex (case insensitive)
  // Or no headers, just data: ID, Name, Hex

  // Let's try to detect if the first line is a header
  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes("id") && firstLine.includes("hex")) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple split by comma, handling potential quotes is better but let's start simple
    // Regex to split by comma but ignore commas inside quotes
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    if (parts.length < 3) continue;

    const id = parts[0].trim().replace(/^"|"$/g, '');
    const name = parts[1].trim().replace(/^"|"$/g, '');
    let hex = parts[2].trim().replace(/^"|"$/g, '');

    // Basic hex validation/fix
    if (!hex.startsWith("#")) {
      hex = "#" + hex;
    }

    if (id && name && HEX_COLOR_RE.test(hex)) {
        colors.push({ id, name, hex });
    }
  }

  return colors;
};
