/**
 * Constants for timeline rendering configuration.
 * Centralized configuration values for easier maintenance and tuning.
 */

// Star rendering constants
// Note: PointsMaterial size is in pixels when sizeAttenuation is false
export const STAR_CONFIG = {
  BASE_SIZE: 3, // Base size in pixels (increased for visibility)
  TEXTURE_SIZE: 64, // Texture resolution (increased for better quality)
  SELECTED_SIZE: 8, // Selected node size in pixels (increased for visibility)
  QUERY_MATCH_SIZE: 6, // Query match size in pixels (increased for visibility)
  AI_TAG_SIZE: 5, // AI tag size in pixels (increased for visibility)
  NORMAL_SIZE: 4, // Normal size in pixels (increased for visibility)
  HIT_RADIUS_PX: 20, // Clickable hit radius in pixels (increased for easier clicking)
} as const;

// Star colors (RGB normalized 0-1)
export const STAR_COLORS = {
  SELECTED: [0.0, 0.94, 1.0], // Cyan
  QUERY_MATCH: [0.0, 0.94, 1.0], // Cyan
  AI_TAG: [0.0, 0.9, 1.0], // Lighter cyan
  NORMAL: [1.0, 1.0, 1.0], // White
} as const;

// Baseline rendering constants
export const BASELINE_CONFIG = {
  HORIZONTAL_PADDING: 40, // Padding from canvas edges
  GRADIENT_SEGMENTS: 20, // Reduced from 50 for performance
  LINE_WIDTH: 2.5,
  GLOW_LINE_WIDTH: 5,
  GLOW_OPACITY: 0.2,
  TICK_DECADE_INTERVAL: 10, // Show tick every 10 years
  TICK_HEIGHT: 8, // Tick mark height in pixels
  TICK_OPACITY: 0.4,
  YEAR_LABEL_OFFSET_Y: 20, // Offset below baseline
  YEAR_LABEL_SCALE_X: 60,
  YEAR_LABEL_SCALE_Y: 15,
} as const;

// Comet rendering constants
export const COMET_CONFIG = {
  NUCLEUS_RADIUS: 4.5,
  NUCLEUS_SEGMENTS: 16, // Reduced for performance
  PARTICLE_COUNT: 50, // Reduced from 100 for performance
  PARTICLE_BASE_SIZE: 1.5, // Reduced size to prevent giant circles
  PARTICLE_OPACITY: 0.5, // Reduced opacity for subtlety
  ION_TAIL_LENGTH: 140,
  DUST_TAIL_LENGTH: 120,
  DUST_TAIL_CURVE: -18,
  ANIMATION_SPEED: 25, // Multiplier for animation time
} as const;

// Constellation lines constants
export const CONSTELLATION_CONFIG = {
  MAX_CONNECTION_DISTANCE_FACTOR: 0.15, // 15% of canvas size
  MAX_CONNECTIONS: 100, // Limit total connections for performance
  BASE_OPACITY: 0.15, // Increased for better visibility
  LINE_WIDTH: 1.0, // Increased for better visibility
} as const;

// Edge (connection) rendering constants
export const EDGE_CONFIG = {
  CURVE_SEGMENTS: 20, // Reduced from 50 for performance
  MIN_CURVE_HEIGHT: 40,
  MAX_CURVE_HEIGHT: 140,
  CURVE_HEIGHT_FACTOR: 0.25, // Height as factor of horizontal distance
  NORMAL_OPACITY: 0.25, // Increased for better visibility
  HIGHLIGHTED_OPACITY: 0.8, // Increased for better visibility
  NORMAL_LINE_WIDTH: 1.5, // Increased for better visibility
  HIGHLIGHTED_LINE_WIDTH: 3.0, // Increased for better visibility
  COLOR: 0x00f0ff, // Cyan
} as const;

// Rendering performance constants
export const PERFORMANCE_CONFIG = {
  PIXEL_RATIO_MAX: 1.0, // Limit pixel ratio for consistent sizes
  BLOOM_STRENGTH: 0.8, // Reduced for performance
  BLOOM_RADIUS: 0.3, // Reduced for performance
  BLOOM_THRESHOLD: 0.9, // Higher threshold = less processing
  TARGET_FPS: 60,
  INITIALIZATION_FRAMES: 5, // Progressive initialization spread across frames
} as const;

// Coordinate transformation constants
export const COORDINATE_CONFIG = {
  CAMERA_Z_POSITION: 1000,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 10000,
} as const;

