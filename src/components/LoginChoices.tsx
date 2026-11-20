'use client';
import {Icon,Logo} from './Brand';

function GoogleMark(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.37Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.4l-3.24-2.52c-.9.6-2.06.96-3.38.96-2.6 0-4.8-1.76-5.6-4.12H3.06v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.1 12c0-.67.1-1.31.3-1.92v-2.6H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.52l3.34-2.6Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87C16.96 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.48l3.34 2.6c.8-2.36 3-4.12 5.6-4.12Z"/></svg>;}
function FacebookMark(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.68.23 2.68.23v2.95h-1.51c-1.49 0-1.95.93-1.95 1.88V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12Z"/></svg>;}

export default function LoginChoices({onDemo}:{onDemo:()=>void}){
 return <div className="login-body social-login-body">
  <div className="social-login-brand"><Logo/></div>
  <p className="social-login-intro">Ойрхон хай. Амархан ол.<br/><span>Нэвтрэх аргаа сонгоорой.</span></p>
  <a href="/login?return_to=%2F%3Fview%3Dmine" target="_top" className="button button-navy full-width market-login-link"><Icon name="verified"/>Бүртгэлээр нэвтрэх</a><p className="market-entry-help">И-мэйл бүртгэлээр бодит зараа хадгалж, QPay-аар онцгой болгоно.</p><div className="social-login-options" aria-label="Хэрэглэгч нэвтрэх сонголт">
   <button type="button" className="social-provider google-provider" disabled aria-describedby="social-connection-status"><GoogleMark/><span>Google-ээр нэвтрэх<small>Gmail бүртгэлээрээ</small></span><span className="social-provider-status">Холбогдоогүй</span></button>
   <button type="button" className="social-provider facebook-provider" disabled aria-describedby="social-connection-status"><FacebookMark/><span>Facebook-ээр нэвтрэх<small>Facebook бүртгэлээрээ</small></span><span className="social-provider-status">Холбогдоогүй</span></button>
  </div>
  <p id="social-connection-status" className="social-login-status"><Icon name="info"/><span>Google, Facebook нэвтрэх үйлчилгээ одоогоор холбогдоогүй байна.</span></p>
  <details className="social-demo"><summary>Туршилтын хувилбарыг үзэх</summary><p>Зар нэмэх урсгалыг зөвхөн энэ хөтөчид туршина. Google, Facebook бүртгэлээр нэвтрэхгүй.</p><button type="button" className="button button-outline full-width" onClick={onDemo}>Туршилтын эрхээр үргэлжлүүлэх <Icon name="arrow-right"/></button></details>
 </div>;
}
