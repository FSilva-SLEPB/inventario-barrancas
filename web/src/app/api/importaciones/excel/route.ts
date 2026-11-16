import {procesarImportacionExcel} from '@/lib/importacion-excel/http';
export const runtime='nodejs';
export async function POST(req:Request){return procesarImportacionExcel(req);}
