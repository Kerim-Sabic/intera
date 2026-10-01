export type UpdateView={status:'blocked'|'idle'|'checking'|'downloading'|'ready'|'error';message:string};
export function macUpdateFeed(arch:string,version:string){if(!['arm64','x64'].includes(arch)||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw new Error('Unsupported update target');return `https://update.electronjs.org/Kerim-Sabic/intera/darwin-${arch}/${version}`;}
