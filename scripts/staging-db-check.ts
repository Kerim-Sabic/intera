import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {postgres} from '../server/db';
async function main(){
 const env=parseEnv(readFileSync('server/.env.staging','utf8'));
 if(!env.DATABASE_URL||/REPLACE|YOUR-PASSWORD/.test(env.DATABASE_URL)){console.log('BLOCKED: database password has not been saved privately.');process.exitCode=2;return;}
 const db=postgres(env.DATABASE_URL);
 try { const result=await db.query(`select count(*)::int as private_tables,bool_and(c.relrowsecurity) as all_rls_enabled,bool_and(not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')) as no_client_table_access from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'`);console.log(JSON.stringify({status:'VERIFIED_DATABASE_CONNECTION',...result.rows[0]},null,2)); }
 catch(error){ const code=error && typeof error==='object' && 'code' in error ? String(error.code):'UNKNOWN'; console.log(JSON.stringify({status:'BLOCKED',reason:'Private database connection failed',code:/^[A-Z0-9_]{5,50}$/.test(code)?code:'UNKNOWN'}));process.exitCode=1;} finally{await db.close();}
}
void main();

