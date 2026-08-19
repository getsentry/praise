const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const srcDir = path.join(__dirname, '..', 'src');

module.exports = {
  entry: {
    options: path.join(srcDir, 'options.tsx'),
    background: path.join(srcDir, 'background.ts'),
    content_script: path.join(srcDir, 'content_script.tsx'),
  },
  output: {
    path: path.join(__dirname, '../dist/js'),
    filename: '[name].js',
    clean: true,
  },
  optimization: {
    splitChunks: {
      name: 'vendor',
      // MV3's background.service_worker takes a single file, so the
      // background bundle must stay self-contained. content_script
      // uses nothing from vendor either, so keep it out of the split.
      chunks(chunk) {
        return chunk.name !== 'background' && chunk.name !== 'content_script';
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic' } },
              target: 'es2020',
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: '.', to: '../', context: 'public' },
        {
          // The extension CSP forbids loading CSS from a CDN, so Pico
          // must ship inside the bundle rather than being linked remotely.
          from: path.join(__dirname, '..', 'node_modules/@picocss/pico/css/pico.classless.min.css'),
          to: '../pico.min.css',
        },
      ],
    }),
  ],
};
