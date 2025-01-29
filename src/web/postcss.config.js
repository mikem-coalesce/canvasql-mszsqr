/**
 * PostCSS Configuration
 * Version: 1.0.0
 * 
 * Configures the CSS processing pipeline for the ERD visualization tool with:
 * - Tailwind CSS for utility-first styling
 * - Autoprefixer for cross-browser compatibility
 * - PostCSS Preset Env for modern CSS features
 */

const tailwindConfig = require('./tailwind.config.ts')

module.exports = {
  plugins: [
    // Tailwind CSS processing
    require('tailwindcss')({
      config: './tailwind.config.ts',
    }),

    // Autoprefixer for cross-browser compatibility
    require('autoprefixer')({
      flexbox: 'no-2009',
      grid: 'autoplace'
    }),

    // Modern CSS features with fallbacks
    require('postcss-preset-env')({
      stage: 3,
      features: {
        'custom-properties': false, // Handled by Tailwind
        'nesting-rules': true,      // Enable CSS nesting
        'color-function': true,     // Modern color functions
        'custom-media-queries': true // Responsive design helpers
      }
    })
  ]
}