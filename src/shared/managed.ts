import {z} from 'zod';
import {regionSchema} from './config';
export const admissionSchema=z.object({leaseId:z.uuid(),status:z.literal('issued'),apiKey:z.string().min(1),expiresAt:z.iso.datetime(),maxSeconds:z.number().int().positive().max(18000),region:regionSchema,endpoint:z.string()});
export type Admission=z.infer<typeof admissionSchema>;
export interface AdmissionBoundary{admit:()=>Promise<Admission>;end:(id:string)=>Promise<void>}
