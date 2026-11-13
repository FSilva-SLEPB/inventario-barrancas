import Informe from '../informe';export default async function Page(p:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <Informe {...p} stock/>;}
