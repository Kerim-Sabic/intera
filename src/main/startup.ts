export async function startupDeadline<T>(work:Promise<T>,milliseconds=10000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Storage startup deadline exceeded')),milliseconds);})]);}
 finally{clearTimeout(timer);}
}
