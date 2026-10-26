import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dictionaries=Object.fromEntries(['ru','uk','en'].map(language=>[language,JSON.parse(fs.readFileSync(path.join(root,'src','shared','i18n','locales',language+'.json'),'utf8'))]));
// Native language names remain native. This is search-only metadata, not rendered UI.
const exceptions=new Set(['Русский','Українська','Kyiv Kiev Киев Київ']);
const errors=[];
const placeholders=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort().join(',');
const keys=Object.keys(dictionaries.ru).sort().join('\n');
for(const [language,dictionary] of Object.entries(dictionaries)){
 if(Object.keys(dictionary).sort().join('\n')!==keys)errors.push(`${language}: dictionary keys differ`);
 for(const [key,value] of Object.entries(dictionary))if(typeof value!=='string'||!value.trim()||placeholders(value)!==placeholders(key))errors.push(`${language}: invalid translation/placeholders for ${key}`);
}
function visitDirectory(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,entry.name);
 if(entry.isDirectory()){if(entry.name!=='locales')visitDirectory(file);continue;}
 if(!/\.tsx?$/.test(file)||file.endsWith('.test.ts'))continue;
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
 function visit(node){
  if(ts.isStringLiteral(node)&&/[А-Яа-яЁёІіЇїЄєҐґ]/.test(node.text)&&!exceptions.has(node.text)){
   for(const [language,dictionary]of Object.entries(dictionaries))if(!Object.hasOwn(dictionary,node.text))errors.push(`${path.relative(root,file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}: ${language} missing ${JSON.stringify(node.text)}`);
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
}}
visitDirectory(path.join(root,'src'));
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Translations: ${Object.keys(dictionaries.ru).length} keys in ru/uk/en; source coverage and placeholders OK.`);
