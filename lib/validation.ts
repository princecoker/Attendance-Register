import { z } from 'zod';
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a valid HH:MM time');
const optionalTime = z.union([time, z.literal('')]).optional().transform(v => v || undefined);
export const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Use a valid calendar date');
export const sessionSchema = z.object({
  school: z.string().trim().min(2).max(150), date: dateField, week: z.number().int().min(1).max(53),
  arrivalTime: time, departureTime: optionalTime, topic: z.string().trim().min(3).max(5000),
  attendance: z.array(z.object({ name: z.string().trim().min(2).max(120), status: z.enum(['PRESENT','ABSENT','LATE']), arrivalTime: optionalTime, departureTime: optionalTime })).min(1).max(500)
}).superRefine((v,ctx) => {
  if(v.departureTime && v.departureTime < v.arrivalTime) ctx.addIssue({code:'custom',path:['departureTime'],message:'Departure must follow arrival on the same day'});
  const names = v.attendance.map(a => a.name.toLocaleLowerCase());
  if(new Set(names).size !== names.length) ctx.addIssue({code:'custom',path:['attendance'],message:'Participant names must be unique within a session'});
  v.attendance.forEach((a,i) => {
    if(a.status === 'ABSENT' && (a.arrivalTime || a.departureTime)) ctx.addIssue({code:'custom',path:['attendance',i],message:'Absent participants cannot have arrival or departure times'});
    if(a.departureTime && !a.arrivalTime) ctx.addIssue({code:'custom',path:['attendance',i],message:'Participant arrival is required before departure'});
    if(a.arrivalTime && a.departureTime && a.departureTime < a.arrivalTime) ctx.addIssue({code:'custom',path:['attendance',i],message:'Participant departure must follow arrival'});
  });
});
export type SessionInput = z.infer<typeof sessionSchema>;
