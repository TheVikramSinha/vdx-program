export class Templates {
  async load(url) {
    const response=await fetch(url,{cache:'no-store'}); if(!response.ok)throw new Error(`Unable to load views (${response.status}).`);
    this.document=new DOMParser().parseFromString(await response.text(),'text/html');
  }
  render(id, slots={}) {
    const source=this.document.getElementById(id);if(!source)throw new Error(`Missing view: ${id}`);
    const fragment=source.content.cloneNode(true);
    for(const [key,html] of Object.entries(slots))for(const slot of fragment.querySelectorAll(`[data-slot="${key}"]`))slot.innerHTML=html;
    const wrapper=document.createElement('div');wrapper.append(fragment);return wrapper.innerHTML;
  }
}
