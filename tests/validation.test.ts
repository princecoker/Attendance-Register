import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionSchema } from '../lib/validation';
const valid={school:'Lagos School',date:'2026-10-08',week:1,arrivalTime:'09:00',departureTime:'11:00',topic:'Introduction to algebra',attendance:[{name:'Ada Coker',status:'PRESENT'}]};
test('accepts a session with all required fields',()=>assert.equal(sessionSchema.safeParse(valid).success,true));
test('rejects impossible dates and invalid times',()=>{for(const change of [{date:'2026-02-30'},{arrivalTime:'24:00'},{departureTime:'08:59'},{week:0}])assert.equal(sessionSchema.safeParse({...valid,...change}).success,false);});
test('rejects duplicate participants and empty attendance',()=>{assert.equal(sessionSchema.safeParse({...valid,attendance:[]}).success,false);assert.equal(sessionSchema.safeParse({...valid,attendance:[{name:'Ada',status:'PRESENT'},{name:'ada',status:'LATE'}]}).success,false);});
test('absent participants cannot clock in',()=>assert.equal(sessionSchema.safeParse({...valid,attendance:[{name:'Ada',status:'ABSENT',arrivalTime:'09:00'}]}).success,false));
test('participant departure requires arrival and correct order',()=>{for(const times of [{departureTime:'10:00'},{arrivalTime:'11:00',departureTime:'10:00'}])assert.equal(sessionSchema.safeParse({...valid,attendance:[{name:'Ada',status:'LATE',...times}]}).success,false);});
