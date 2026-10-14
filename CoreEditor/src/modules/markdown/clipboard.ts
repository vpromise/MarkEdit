import { Config, Host } from '../../config';
import { isReleaseMode } from '../../common/utils';

export async function copyText(text: string): Promise<boolean> {
  try {
    const config = Reflect.get(window, 'config') as Config | undefined;
    if (isReleaseMode && config?.host === Host.mainApp) {
      return await window.nativeModules.api.setPasteboardString({ text });
    }

    const clipboard = Reflect.get(navigator, 'clipboard') as Clipboard | undefined;
    if (clipboard === undefined) {
      return false;
    }

    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
