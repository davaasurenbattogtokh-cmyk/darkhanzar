import type {ReactNode} from 'react';

export const LEGAL_CONTACT='techopenworld@gmail.com';
export const LEGAL_UPDATED='2026 оны 11 дүгээр сарын 21';

export function LegalPage({title,children}:{title:string;children:ReactNode}){
 return <main style={{minHeight:'100vh',background:'#fff5e8',color:'#101c45',padding:'32px 16px'}}>
  <article style={{maxWidth:760,margin:'0 auto',background:'#fff',borderRadius:24,padding:'32px clamp(20px,5vw,48px)',boxShadow:'0 12px 50px #101c4510',lineHeight:1.65,fontSize:16}}>
   <a href="/" style={{fontWeight:800,fontSize:22,textDecoration:'none',color:'#101c45'}}>darkhan<span style={{color:'#f28b16'}}>zar</span></a>
   <h1 style={{fontSize:30,margin:'24px 0 4px'}}>{title}</h1>
   <p style={{color:'#586174',margin:'0 0 24px',fontSize:14}}>Сүүлд шинэчилсэн: {LEGAL_UPDATED}</p>
   {children}
   <hr style={{border:0,borderTop:'1px solid #e6e8ef',margin:'32px 0 16px'}}/>
   <p style={{fontSize:14,color:'#586174'}}><a href="/privacy">Нууцлалын бодлого</a> · <a href="/terms">Үйлчилгээний нөхцөл</a> · <a href="/">Нүүр хуудас</a></p>
  </article>
 </main>;
}

export function Section({title,children}:{title:string;children:ReactNode}){
 return <section style={{marginTop:28}}><h2 style={{fontSize:20,margin:'0 0 8px'}}>{title}</h2>{children}</section>;
}
