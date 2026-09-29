import type { ButtonHTMLAttributes, ReactNode } from 'react';
export function Card({children,className='' }:{children:ReactNode;className?:string}){return <section className={`card ${className}`}>{children}</section>}
export function Button({children,variant='primary',...props}:{children:ReactNode;variant?:'primary'|'ghost'|'danger'|'soft'}&ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`btn btn-${variant}`} {...props}>{children}</button>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'good'|'warn'|'danger'|'info'}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Empty({title,body}:{title:string;body?:string}){return <div className="empty"><div className="empty-icon">◌</div><strong>{title}</strong>{body&&<span>{body}</span>}</div>}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
