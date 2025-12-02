import { BeadColor } from './types';

// A subset of popular Perler Bead colors
export const BEAD_PALETTE: BeadColor[] = [
  { id: 'P01', name: 'Black', hex: '#2E2E2E' },
  { id: 'P02', name: 'White', hex: '#FFFFFF' },
  { id: 'P03', name: 'Red', hex: '#C62933' },
  { id: 'P04', name: 'Orange', hex: '#EF7D26' },
  { id: 'P05', name: 'Yellow', hex: '#FBD822' },
  { id: 'P06', name: 'Dark Green', hex: '#0B6841' },
  { id: 'P07', name: 'Dark Blue', hex: '#213B8B' },
  { id: 'P08', name: 'Purple', hex: '#583688' },
  { id: 'P09', name: 'Pink', hex: '#DB5F89' },
  { id: 'P10', name: 'Grey', hex: '#87888A' },
  { id: 'P11', name: 'Brown', hex: '#5A3D31' },
  { id: 'P12', name: 'Light Blue', hex: '#3E91C9' },
  { id: 'P13', name: 'Light Green', hex: '#6BCB77' },
  { id: 'P14', name: 'Tan', hex: '#D6A681' },
  { id: 'P15', name: 'Peach', hex: '#F5C6A5' },
  { id: 'P16', name: 'Cream', hex: '#F0EAD6' },
  { id: 'P17', name: 'Magenta', hex: '#B22E68' },
  { id: 'P18', name: 'Turquoise', hex: '#008C95' },
  { id: 'P19', name: 'Rust', hex: '#8A3222' },
  { id: 'P20', name: 'Cheddar', hex: '#F6A024' },
  { id: 'P21', name: 'Butterscotch', hex: '#D58C46' },
  { id: 'P22', name: 'Parrot Green', hex: '#00904B' },
  { id: 'P23', name: 'Dark Grey', hex: '#48494B' },
  { id: 'P24', name: 'Toothpaste', hex: '#94D6D6' },
  { id: 'P25', name: 'Hot Coral', hex: '#FF5C5C' },
  { id: 'P26', name: 'Plum', hex: '#7A3575' },
  { id: 'P27', name: 'Kiwi Lime', hex: '#7BC744' },
  { id: 'P28', name: 'Blush', hex: '#FF9796' },
];

// Helper to convert hex to RGB
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

// Color distance (Euclidean approximation is usually enough for this scale, 
// though LAB is better, we stick to simple weighted RGB for performance/simplicity)
export const getColorDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) => {
  const rmean = (c1.r + c2.r) / 2;
  const r = c1.r - c2.r;
  const g = c1.g - c2.g;
  const b = c1.b - c2.b;
  return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
};
