import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if('serviceWorker' in navigator && import.meta.env.PROD){
  let registration: ServiceWorkerRegistration | null = null;

  const notifyWaitingUpdate = () => {
    if(registration?.waiting){
      window.dispatchEvent(new CustomEvent('inside-code-sw-update'));
    }
  };

  window.addEventListener('inside-code-sw-check',()=>{
    void (registration ?? navigator.serviceWorker.ready)
      .then(reg=>{
        registration = reg;
        return reg.update();
      })
      .then(()=>notifyWaitingUpdate())
      .catch(()=>{ /* update checks are best-effort */ });
  });

  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register('/sw.js').then(reg=>{
      registration = reg;
      notifyWaitingUpdate();
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{
          if(worker.state==='installed'&&navigator.serviceWorker.controller){
            window.dispatchEvent(new CustomEvent('inside-code-sw-update'));
          }
        });
      });
    });
  });
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
