import type { Metadata } from 'next';
import { SectorDirectory } from '@/components/sector-directory';
export const revalidate=900;
export const metadata:Metadata={title:'US Stocks by Sector & Industry',description:'Explore US stocks by sector and industry, with company counts and links to detailed stock research.'};
export default function Page(){return <SectorDirectory/>;}