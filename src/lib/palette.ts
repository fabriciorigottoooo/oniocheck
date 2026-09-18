export const PALETTE = [
  "#2a9b81",
  "#2563eb",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#be185d",
];

export const pickColor = (index: number) =>
  PALETTE[Math.abs(index) % PALETTE.length];
