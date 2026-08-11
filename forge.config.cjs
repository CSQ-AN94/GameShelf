const { writeFile } = require('node:fs/promises');
const path = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'GameShelf',
    icon: 'assets/app-icon.ico',
    overwrite: true,
    ...(process.env.GAMESHELF_ELECTRON_ZIP_DIR
      ? { electronZipDir: process.env.GAMESHELF_ELECTRON_ZIP_DIR }
      : {})
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'GameShelf'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  hooks: {
    postPackage: async (_config, result) => {
      if (process.env.GAMESHELF_PORTABLE !== '1' || result.platform !== 'win32') return;
      await Promise.all(result.outputPaths.map((outputPath) => writeFile(
        path.join(outputPath, 'gameshelf-portable'),
        'Keep this file next to GameShelf.exe to store data in the adjacent data folder.\n'
      )));
    }
  },
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main.ts',
            config: 'vite.main.config.mjs'
          },
          {
            entry: 'src/preload.ts',
            config: 'vite.preload.config.mjs'
          }
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs'
          }
        ]
      }
    }
  ]
};
