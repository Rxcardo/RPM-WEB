'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function RecursosPage(){

const supabase=createBrowserClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const [recursos,setRecursos]=useState<any[]>([])
const [loading,setLoading]=useState(true)

async function load(){

const {data}=await supabase
.from('recursos')
.select('*')
.order('created_at',{ascending:false})

setRecursos(data||[])
setLoading(false)

}

useEffect(()=>{
load()
},[])

async function eliminar(id:string){

await supabase
.from('recursos')
.delete()
.eq('id',id)

load()

}

return(

<div className="p-6">

{/* HEADER */}

<div className="flex items-center justify-between mb-6">

<div>

<h1 className="text-2xl font-bold text-slate-900">
Recursos
</h1>

<p className="text-sm text-slate-500">
Gestión de espacios y recursos
</p>

</div>

<Link
href="/admin/operaciones/recursos/nuevo"
className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium"
>
Nuevo recurso
</Link>

</div>

{/* CARD */}

<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

<table className="w-full">

<thead className="bg-slate-50 border-b">

<tr className="text-sm text-slate-600">

<th className="text-left p-4">
Nombre
</th>

<th className="text-left p-4">
Tipo
</th>

<th className="text-left p-4">
Capacidad
</th>

<th className="text-left p-4">
Estado
</th>

<th className="text-right p-4">
Acciones
</th>

</tr>

</thead>

<tbody>

{loading && (

<tr>

<td className="p-6 text-sm text-slate-500">
Cargando recursos...
</td>

</tr>

)}

{recursos.map((r)=>(

<tr key={r.id} className="border-b">

<td className="p-4 text-sm font-medium text-slate-900">
{r.nombre}
</td>

<td className="p-4 text-sm text-slate-600 capitalize">
{r.tipo}
</td>

<td className="p-4 text-sm text-slate-600">
{r.capacidad}
</td>

<td className="p-4">

<span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">

{r.estado}

</span>

</td>

<td className="p-4 text-right space-x-4">

<Link
href={`/admin/operaciones/recursos/${r.id}`}
className="text-blue-600 text-sm font-medium"
>
Ver
</Link>

<Link
href={`/admin/operaciones/recursos/${r.id}/editar`}
className="text-amber-600 text-sm font-medium"
>
Editar
</Link>

<button
onClick={()=>eliminar(r.id)}
className="text-red-600 text-sm font-medium"
>
Eliminar
</button>

</td>

</tr>

))

}

</tbody>

</table>

</div>

</div>

)

}