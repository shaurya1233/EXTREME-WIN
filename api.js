export async function api(path, options={}){const r=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});let body=null;try{body=await r.json()}catch{}if(!r.ok)throw new Error(body?.error||body?.reason||`HTTP ${r.status}`);return body}
export async function health(){return api('/api/health')}
export async function capabilities(){return api('/api/capabilities')}
export async function analyze(url){return api('/api/analyze',{method:'POST',body:JSON.stringify({url})})}
export async function startDownload(data){return api('/api/download',{method:'POST',body:JSON.stringify(data)})}
export async function status(id){return api(`/api/status/${encodeURIComponent(id)}`)}
export async function cancel(id){return api(`/api/cancel/${encodeURIComponent(id)}`,{method:'POST'})}
export async function history(){return api('/api/history')}
export async function clearHistory(){return api('/api/history',{method:'DELETE'})}
