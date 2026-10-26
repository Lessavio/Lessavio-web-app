import type { Student, Lesson } from '../../../domain/workspace';
export const studentColors=['#66824f','#397a70','#377ba0','#5269ac','#7960a4','#a45888','#ad5f63','#b06d3e','#9a7d2e','#6b8792','#7d6b5d','#57617d'] as const;
export function studentColor(student:Student|undefined,index=0):string{return student?.color??studentColors[index%studentColors.length];}
export function nextStudentColor(students:Student[]):string{return [...studentColors].sort((a,b)=>students.filter((s,i)=>!s.archived&&studentColor(s,i)===a).length-students.filter((s,i)=>!s.archived&&studentColor(s,i)===b).length)[0];}
export function visibleLessons(lessons:Lesson[],students:Student[]):Lesson[]{const active=new Set(students.filter(s=>!s.archived).map(s=>s.id));return lessons.filter(l=>active.has(l.studentId));}
