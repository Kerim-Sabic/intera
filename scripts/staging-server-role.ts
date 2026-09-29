import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {postgres} from '../server/db';

// Run only after protecting both ignored files with owner-only permissions/ACLs.
// No secret is accepted as an argument or printed, including on failure.
async function main(){
 const file='server/.env.staging',adminFile='server/.env.staging-admin';
 const raw=readFileSync(file,'utf8'),env=parseEnv(raw);
 const databaseUrl=env.DATABASE_URL;if(!databaseUrl)throw new Error('Missing database configuration');
 if(env.SUPABASE_URL!=='https://pggkdfbbnmkbxrxodghu.supabase.co'||env.WHOP_ENVIRONMENT!=='sandbox')throw new Error('Wrong staging project');
 if(!existsSync(adminFile))throw new Error('Create and protect the admin environment file first');
 const saved=parseEnv(readFileSync(adminFile,'utf8'));
 const adminUrl=saved.DATABASE_URL||databaseUrl;
 const parsed=new URL(adminUrl);
 if(decodeURIComponent(parsed.username)!=='postgres.pggkdfbbnmkbxrxodghu')throw new Error('Expected staging owner');
 if(!saved.DATABASE_URL)writeFileSync(adminFile,`DATABASE_URL=${adminUrl}\n`);
 const admin=postgres(adminUrl);
 try{
  const exists=(await admin.query("select to_regprocedure('private.session_is_active(uuid,uuid)') is not null as present")).rows[0].present;
  if(!exists)await admin.transaction(sql=>sql.query(readFileSync('supabase/migrations/20260929182332_restricted_server_role.sql','utf8')));
  await admin.query(readFileSync('supabase/migrations/20260929184200_billing_review_runtime_update.sql','utf8'));
  if(decodeURIComponent(new URL(databaseUrl).username)==='intera_server.pggkdfbbnmkbxrxodghu'){
   console.log('Restricted staging role already configured.');return;
  }
  const secret=randomBytes(32).toString('hex');
  // Hex generated locally, never external input; ALTER ROLE has no bind parameter syntax.
  await admin.query(`alter role intera_server login password '${secret}'`);
  const runtime=new URL(adminUrl);runtime.username='intera_server.pggkdfbbnmkbxrxodghu';runtime.password=secret;
  const db=postgres(runtime.href);
  try{
   await db.query('select id from private.billing_lock for update');
   const role=(await db.query('select rolbypassrls,rolsuper,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user')).rows[0];
   if(!role||Object.values(role).some(Boolean))throw new Error('Unexpected privilege');
   const check=(await db.query("select private.session_is_active('00000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000000') as active")).rows[0];
   if(check.active!==false)throw new Error('Session check failed');
   let authDenied=false;
   try{await db.query('select * from auth.sessions limit 0');}
   catch(error){authDenied=Boolean(error&&typeof error==='object'&&'code'in error&&error.code==='42501');}
   if(!authDenied)throw new Error('Auth table access must be denied');
   writeFileSync(file,raw.replace(/^DATABASE_URL=.*$/m,`DATABASE_URL=${runtime.href}`));
   console.log(JSON.stringify({status:'VERIFIED_RESTRICTED_STAGING_ROLE',bypassRls:false,authTableAccess:false,privateSessionLookup:true}));
  }finally{await db.close();}
 }finally{await admin.close();}
}
void main().catch(error=>{const code=error&&typeof error==='object'&&'code'in error?String(error.code):'UNKNOWN';console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z0-9_]{5,50}$/.test(code)?code:'UNKNOWN',reason:'Restricted staging role setup failed; credentials not logged.'}));process.exitCode=1;});
