import { fileURLToPath } from 'url';
import { createLogger, defineConfig } from 'vite';

export default defineConfig(({ command }) => (
  {
    base: command === 'build' ? '/chunk-loader/' : '',
    experimental: command === 'build' ? {
      // Runtime dependencies such as Mermaid diagram chunks can preload CSS
      // after EditorConfig has already transformed index.html. Emit the
      // custom WKURLSchemeHandler URL directly so those requests do not fall
      // back to the unreachable /chunk-loader/ HTTP path.
      renderBuiltUrl: fileName => `chunk-loader://${fileName}`,
    } : undefined,
    resolve: {
      alias: {
        '@codemirror/lang-markdown': fileURLToPath(new URL('./src/@vendor/lang-markdown', import.meta.url)),
        '@codemirror/language-data': fileURLToPath(new URL('./src/@vendor/language-data', import.meta.url)),
      },
    },
    build: {
      assetsDir: 'chunks',
      chunkSizeWarningLimit: 768,
    },
    customLogger: (() => {
      const logger = createLogger();
      const warn = logger.warn;

      logger.warn = (message, options) => {
        // Ignore CodeMirror dynamic import warnings since we are not going to do anything (#214)
        if (message.includes('@vendor/language-data') && message.includes('dynamic import will not move module into another chunk')) {
          return;
        }

        warn(message, options);
      };

      return logger;
    })(),
  }
));
