import React from 'react';
import symbol from '../../assets/brand/masters/symbol.svg';
export function Brand({label=true}:{label?:boolean}){return <span className="intera-brand"><img src={symbol} alt="" width="28" height="28"/>{label&&<strong>Intera AI</strong>}</span>;}
