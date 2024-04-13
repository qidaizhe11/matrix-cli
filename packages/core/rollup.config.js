const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const path = require('path');
const { defineConfig } = require('rollup');
const ts = require('@rollup/plugin-typescript');
const terser = require('@rollup/plugin-terser');

const baseConfig = {
  input: ['src/index.ts'],
  output: {
    dir: 'dist',
    exports: 'named',
    sourcemap: process.env.NODE_ENV !== 'production',
    format: 'cjs'
  },
  treeshake: false,
  plugins: [
    ts(),
    commonjs({
      extensions: ['.js', '.ts']
    }),
    json()
  ].concat(process.env.NODE_ENV === 'production' ? [terser()] : [])
};

const esmConfig = {
  ...baseConfig,
  output: {
    file: path.join(__dirname, 'dist/index.es.js'),
    format: 'es',
    sourcemap: false
  }
};

module.exports = defineConfig(
  [baseConfig].concat(process.env.NODE_ENV === 'production' ? esmConfig : [])
);
