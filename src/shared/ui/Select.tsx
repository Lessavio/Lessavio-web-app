import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
export interface SelectOption { value: string; label: string; description?: string; keywords?: string }
interface SelectProps {
 name?: string; label: string; options: readonly SelectOption[]; value?: string; defaultValue?: string;
 onChange?: (value: string, form: HTMLFormElement | null) => void; disabled?: boolean;
 searchable?: boolean; searchLabel?: string; emptyLabel: string;
}
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase();
export function Select({name,label,options,value,defaultValue,onChange,disabled,searchable,searchLabel,emptyLabel}: SelectProps) {
 const [internal,setInternal]=useState(defaultValue??options[0]?.value??'');
 const selected=value??internal;
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(-1);
 const [position,setPosition]=useState({left:0,top:0,width:240,maxHeight:320});
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const id=useId();
 const filtered=options.filter(option=>normalize(`${option.label} ${option.description??''} ${option.keywords??''}`).includes(normalize(query)));
 const close=(focus=false)=>{setOpen(false);if(focus)trigger.current?.focus();};
 const show=(last=false)=>{if(disabled)return;setQuery('');setActive(last?options.length-1:Math.max(0,options.findIndex(option=>option.value===selected)));setOpen(true);};
 const choose=(index:number)=>{const option=filtered[index];if(!option)return;setInternal(option.value);if(option.value!==selected)onChange?.(option.value,trigger.current?.form??null);close(true);};
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const below=window.innerHeight-rect.bottom-12;const naturalHeight=340;const height=Math.min(naturalHeight,Math.max(140,Math.max(below,rect.top-12)));const width=Math.min(Math.max(rect.width,250),window.innerWidth-24);setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:below>=Math.min(naturalHeight,rect.top)?rect.bottom+6:Math.max(12,rect.top-height-6),width,maxHeight:height});};
  const onScroll=(event:Event)=>{if(!panel.current?.contains(event.target as Node))place();};
  place();window.addEventListener('resize',place);window.addEventListener('scroll',onScroll,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',onScroll,true);};
 },[open]);
 useEffect(()=>{if(!open)return;search.current?.focus();const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!panel.current?.contains(e.target as Node))close();};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 useEffect(()=>{if(open)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,id]);
 function keys(e:KeyboardEvent){
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
  else if(e.key==='Tab'){
   if(e.target===search.current){
    e.preventDefault();
    const scope=trigger.current?.closest('form')??document;
    const elements=Array.from(scope.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(element=>element.getClientRects().length>0&&!panel.current?.contains(element));
    const index=elements.indexOf(trigger.current!);
    close();(elements[index+(e.shiftKey?-1:1)]??trigger.current)?.focus();
   }else close();
  }
  else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   if((e.key==='Home'||e.key==='End')&&e.target===search.current)return;
   e.preventDefault();if(!open){show(e.key==='ArrowUp');return;}
   setActive(index=>e.key==='Home'?0:e.key==='End'?filtered.length-1:e.key==='ArrowDown'?Math.min(filtered.length-1,index+1):Math.max(0,index-1));
  }else if(e.key==='Enter'||(e.key===' '&&e.target===trigger.current)){e.preventDefault();if(open)choose(active);else show();}
  else if(!open&&searchable&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();show();setQuery(e.key);setActive(0);}
 }
 const activeId=open&&active>=0&&filtered[active]?`${id}-${active}`:undefined;
 return <div className="select-control">
  {name&&<input type="hidden" name={name} value={selected}/>}
  <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={!searchable?activeId:undefined} disabled={disabled} className={`select-trigger ${open?'is-open':''}`} onKeyDown={keys} onClick={e=>{e.preventDefault();open?close():show();}}><span>{options.find(option=>option.value===selected)?.label??selected}</span><ChevronDown size={17}/></button>
  {open&&createPortal(<div ref={panel} className="select-popover" style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}} onKeyDown={keys}>
   {searchable&&<div className="select-search"><Search size={16}/><input ref={search} role="combobox" aria-label={searchLabel??label} aria-expanded="true" aria-controls={id} aria-activedescendant={activeId} placeholder={searchLabel} value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} autoComplete="off"/></div>}
   <div id={id} role="listbox" aria-label={label} className="select-options">{filtered.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value===selected} className={`select-option ${index===active?'is-active':''} ${option.value===selected?'is-selected':''}`} onPointerMove={()=>setActive(index)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(index)}><div><span>{option.label}</span>{option.description&&<small>{option.description}</small>}</div>{option.value===selected&&<Check size={17}/>}</div>)}{!filtered.length&&<p className="select-empty" role="status">{emptyLabel}</p>}</div>
  </div>,document.body)}
 </div>;
}
