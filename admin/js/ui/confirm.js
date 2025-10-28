import { openModal } from './modal.js';
export function confirmDialog(message){
  return new Promise(resolve=>{
    const { close } = openModal({
      title: 'Please confirm',
      content: `<p>${message}</p>`,
      actions: [
        { key:'cancel', label:'Cancel', class:'btn-ghost', onClick:()=>{ close(); resolve(false); } },
        { key:'ok', label:'Confirm', class:'btn-danger', onClick:()=>{ close(); resolve(true); } }
      ]
    });
  });
}
