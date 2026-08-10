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
      platforms: ['darwin']
    }
  ],
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
