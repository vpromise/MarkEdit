declare module 'markdown-it-task-lists' {
  import { PluginWithOptions } from 'markdown-it';
  const plugin: PluginWithOptions<{ enabled?: boolean; label?: boolean }>;
  export default plugin;
}
