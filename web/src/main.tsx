import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

if('serviceWorker' in navigator && import.meta.env.PROD){
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register('/sw.js').then(reg=>{
      if(reg.waiting) window.dispatchEvent(new CustomEvent('student-hub-sw-update'));
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;
        if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)window.dispatchEvent(new CustomEvent('student-hub-sw-update'))});
      });
    });
  });
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
