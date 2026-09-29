// USD in 10^-14 units. Provider costs have <=10 decimals; a basis-point fee
// therefore fits exactly without rounding any request or component to cents.
export const USD_SCALE=100_000_000_000_000n;
export function usd(value:string):bigint {
 if(!/^\d{1,20}(\.\d{1,14})?$/.test(value))throw new Error('Invalid USD amount.');
 const [whole,fraction='']=value.split('.');return BigInt(whole)*USD_SCALE+BigInt(fraction.padEnd(14,'0'));
}
export function decimal(value:bigint):string {
 const sign=value<0n?'-':'';const n=value<0n?-value:value;
 return `${sign}${n/USD_SCALE}.${(n%USD_SCALE).toString().padStart(14,'0')}`;
}
export function vipCharge(cost:string,bps=1000){
 if(!/^\d{1,20}(\.\d{1,10})?$/.test(cost)||!Number.isInteger(bps)||bps<0||bps>10000)throw new Error('Invalid provider cost or fee.');
 const api=usd(cost),fee=api*BigInt(bps)/10000n;
 return {api:decimal(api),fee:decimal(fee),total:decimal(api+fee),bps};
}
export function minMoney(...values:bigint[]){return values.reduce((a,b)=>a<b?a:b);}
