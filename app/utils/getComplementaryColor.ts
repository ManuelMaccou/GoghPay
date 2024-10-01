import tinycolor from 'tinycolor2';

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

// Get modified color based on lightness (lighter or darker)
export const getModifiedColor = (hex: string): string => {
  const color = tinycolor(hex);
  
  // Check if the color is light or dark
  if (color.isDark()) {
    // Lighten the color by 20%
    return color.lighten(20).toHexString();
  } else {
    // Darken the color by 20%
    return color.darken(20).toHexString();
  }
};

// Get modified color in RGBA with transparency based on lightness (lighter or darker)
export const getModifiedColorRgba = (hex: string, alpha: number = 1): string => {
  const color = tinycolor(hex);
  
  // Check if the color is light or dark
  const modifiedColor = color.isDark() ? color.lighten(20) : color.darken(20);

  // Return the RGBA value with the specified alpha
  return modifiedColor.setAlpha(alpha).toRgbString();
};
