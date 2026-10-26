import ru from './locales/ru.json' with { type: 'json' };
import uk from './locales/uk.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
export type Language = 'ru' | 'uk' | 'en';
export const languages = [{value:'en',label:'English'},{value:'ru',label:'Русский'},{value:'uk',label:'Українська'}] as const;
export const locales: Record<Language,string> = {ru:'ru-RU',uk:'uk-UA',en:'en-US'};
export const defaultLanguage: Language = 'en';
const dictionaries: Record<Language,Record<string,string>> = {ru,uk,en};
export function translator(language: Language) {
  return (key: string, values: Record<string,string|number> = {}) => {
    const text = dictionaries[language][key] ?? key;
    return text.replace(/\{(\w+)\}/g,(match,name:string)=>Object.hasOwn(values,name)?String(values[name]):match);
  };
}
