// Resolución de los validadores compartidos para herramientas locales de Node 24.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){if(specifier.startsWith('@/'))return nextResolve(new URL('../src/'+specifier.slice(2)+'.ts',import.meta.url).href,context);return nextResolve(specifier,context);}});
