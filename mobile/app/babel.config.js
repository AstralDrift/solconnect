module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    ['module-resolver', {
      root: ['.'],
      extensions: [
        '.ios.ts',
        '.android.ts',
        '.ts',
        '.ios.tsx',
        '.android.tsx',
        '.tsx',
        '.jsx',
        '.js',
        '.json',
        '.web.js',
        '.web.jsx',
        '.web.ts',
        '.web.tsx'
      ],
      alias: {
        '^react-native$': 'react-native-web',
        '^react-native-web$': 'react-native-web'
      }
    }]
  ]
}; 