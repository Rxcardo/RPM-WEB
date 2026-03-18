'use client'

export const dynamic = 'force-dynamic'

import { useEffect,useState } from 'react'
import { useParams,useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function EditarRecurso(){

const {id}=useParams()
const router=useRouter()

const supabase=createBrowserClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const [loading,setLoading]=useState(true)

const [form,setForm]=useState({

nombre:'',
tipo:'',
capacidad:1,
descripcion:'',
estado:''

})

async function load(){

const {data}=await supabase
.from('recursos')
.select('*')
.eq('id',id)
.single()

if(data){

setForm({

nombre:data.nombre,
tipo:data.tipo,
capacidad:data.capacidad,
descripcion:data.descripcion||'',
estado:data.estado

})

}

setLoading(false)

}

useEffect(()=>{
load()
},[])

async function update(){

if(!form.nombre){
alert('Nombre requerido')
return
}

await supabase
.from('recursos')
.update(form)
.eq('id',id)

router.push('/admin/operaciones/recursos')

}

if(loading){

return(
<div className="p-6">
Cargando...
</div>
)

}

return(

<div className="p-6">

{/* HEADER */}

<div className="mb-6">

<h1 className="text-2xl font-bold text-slate-900">
Editar recurso
</h1>

<p className="text-sm text-slate-500">
Modificar información del recurso
</p>

</div>

{/* CARD */}

<div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl space-y-5">

{/* NOMBRE */}

<div>

<label className="text-sm font-medium text-slate-700">
Nombre
</label>

<input
value={form.nombre}
className="w-full border border-slate-300 rounded-lg p-2 mt-1"
onChange={e=>setForm({
...form,
nombre:e.target.value
})}
/>

</div>

{/* TIPO */}

<div>

<label className="text-sm font-medium text-slate-700">
Tipo
</label>

<select
value={form.tipo}
className="w-full border border-slate-300 rounded-lg p-2 mt-1"
onChange={e=>setForm({
...form,
tipo:e.target.value
})}
>

<option value="therapy">
Terapia
</option>

<option value="recovery">
Recovery
</option>

<option value="training">
Entrenamiento
</option>

<option value="evaluation">
Evaluación
</option>

<option value="other">
Otro
</option>

</select>

</div>

{/* CAPACIDAD */}

<div>

<label className="text-sm font-medium text-slate-700">
Capacidad
</label>

<input
type="number"
value={form.capacidad}
className="w-full border border-slate-300 rounded-lg p-2 mt-1"
onChange={e=>setForm({
...form,
capacidad:Number(e.target.value)
})}
/>

</div>

{/* DESCRIPCION */}

<div>

<label className="text-sm font-medium text-slate-700">
Descripción
</label>

<textarea
value={form.descripcion}
className="w-full border border-slate-300 rounded-lg p-2 mt-1"
onChange={e=>setForm({
...form,
descripcion:e.target.value
})}
/>

</div>

{/* ESTADO */}

<div>

<label className="text-sm font-medium text-slate-700">
Estado
</label>

<select
value={form.estado}
className="w-full border border-slate-300 rounded-lg p-2 mt-1"
onChange={e=>setForm({
...form,
estado:e.target.value
})}
>

<option value="activo">
Activo
</option>

<option value="inactivo">
Inactivo
</option>

<option value="mantenimiento">
Mantenimiento
</option>

</select>

</div>

{/* BOTONES */}

<div className="flex gap-3 pt-3">

<button
onClick={update}
className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium"
>

Guardar cambios

</button>

<button
onClick={()=>router.back()}
className="border border-slate-300 px-5 py-2 rounded-lg text-sm"
>

Cancelar

</button>

</div>

</div>

</div>

)

}