export interface BeadColor {
  id: string;
  name: string;
  hex: string;
}

export interface Palette {
  id: string;
  name: string;
  colors: BeadColor[];
}

export interface PatternData {
  grid: BeadColor[][]; // 2D array of colors representing the grid
  counts: Record<string, number>; // Map of Color ID to count
  width: number;
  height: number;
}

export interface AIAnalysis {
  title: string;
  description: string;
  difficulty: string;
  suggestedUsage: string;
}