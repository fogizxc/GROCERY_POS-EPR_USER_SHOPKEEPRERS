import { useEffect, useState } from 'react';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthScreen } from './components/AuthScreen';
import { AdminDeliveryPricingOverlay } from './components/AdminDeliveryPricingOverlay';
import { PartnerCredentialManager } from './components/PartnerCredentialManager';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import './index.css';

type SessionRole = 'customer' | 'shopkeeper' | 'employee' | 'admin' | 'super_admin';
function readRoleFromToken(): SessionRole { const token=localStorage.getItem('freshcart_token');if(!token)return 'customer';try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) as {role?:string};const role=payload.role;if(role==='shopkeeper'||role==='employee'||role==='admin'||role==='super_admin')return role;return 'customer';}catch{return 'customer'}}
function AppGate(){const isSuperPortal=window.location.pathname.startsWith('/super-admin');const [authenticated,setAuthenticated]=useState(()=>Boolean(localStorage.getItem('freshcart_token')));useEffect(()=>{void fetch('/api/health',{cache:'no-store'}).catch(()=>undefined)},[]);if(!authenticated)return <AuthScreen onAuthenticated={()=>{const role=readRoleFromToken();if(isSuperPortal&&role!=='super_admin'){localStorage.removeItem('freshcart_token');localStorage.removeItem('freshcart_role');window.location.reload();return;}localStorage.setItem('freshcart_role',role);setAuthenticated(true)}}/>;const role=readRoleFromToken();if(isSuperPortal){if(role!=='super_admin'){localStorage.removeItem('freshcart_token');localStorage.removeItem('freshcart_role');return <AuthScreen onAuthenticated={()=>{const nextRole=readRoleFromToken();if(nextRole==='super_admin'){localStorage.setItem('freshcart_role',nextRole);setAuthenticated(true)}else{localStorage.removeItem('freshcart_token');window.location.reload()}}}/>;}return <SuperAdminPortal onLogout={()=>{localStorage.removeItem('freshcart_token');localStorage.removeItem('freshcart_role');setAuthenticated(false);}}/>;}localStorage.setItem('freshcart_role',role);return <><App/>{role==='admin'&&<><AdminDeliveryPricingOverlay/><PartnerCredentialManager/></>}</>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AppGate/></React.StrictMode>);
