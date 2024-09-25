// Convert hex to RGB
export const hexToRgb = (hex: string) => {
  const sanitizedHex = hex.replace(/^#/, '');

  const bigint = parseInt(sanitizedHex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b };
};

// Convert hex to RGBA with transparency
export const hexToRgba = (hex: string, alpha: number = 1) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Convert RGB to HSL
export const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
};

// Convert HSL to RGB
export const hslToRgb = (h: number, s: number, l: number) => {
  let r: number, g: number, b: number;

  h /= 360;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 3) return q;
      if (t < 1 / 2) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

// Convert HSL to RGBA with transparency
export const hslToRgba = (h: number, s: number, l: number, alpha: number = 1) => {
  const { r, g, b } = hslToRgb(h, s, l);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Convert RGB to Hex
export const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (c: number) => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Get complementary color in Hex with special handling for black and white
export const getComplementaryColor = (hex: string): string => {
  // Handle edge cases for black and white
  if (hex === '#000000') return '#FFFFFF'; // Complement of black is white
  if (hex === '#FFFFFF') return '#000000'; // Complement of white is black

  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  // Shift hue by 180 degrees to get the complementary color
  const complementaryHue = (h + 180) % 360;

  const { r: cr, g: cg, b: cb } = hslToRgb(complementaryHue, s, l);

  return rgbToHex(cr, cg, cb);
};

// Get complementary color in RGBA with optional transparency and special handling for black and white
export const getComplementaryColorRgba = (hex: string, alpha: number = 1): string => {
  // Handle edge cases for black and white
  if (hex === '#000000') return `rgba(255, 255, 255, ${alpha})`; // Complement of black is white
  if (hex === '#FFFFFF') return `rgba(0, 0, 0, ${alpha})`; // Complement of white is black

  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  // Shift hue by 180 degrees to get the complementary color
  const complementaryHue = (h + 180) % 360;

  return hslToRgba(complementaryHue, s, l, alpha);
};
