import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'ClassLedger | Attendance & Class Tracking',description:'Track school sessions, attendance and curriculum with ClassLedger.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
