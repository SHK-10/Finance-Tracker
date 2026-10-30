(() => {
  const content=document.querySelector('.main-content');
  if(!content||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;

  const ease='cubic-bezier(.22,1,.36,1)';
  requestAnimationFrame(()=>content.animate(
    [{transform:'translateY(9px)'},{transform:'translateY(0)'}],
    {duration:280,easing:ease}
  ));

  let leaving=false;
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    if((link.target&&link.target!=='_self')||link.hasAttribute('download'))return;
    const destination=new URL(link.href,window.location.href);
    if(destination.origin!==window.location.origin||destination.pathname===window.location.pathname)return;
    event.preventDefault();
    if(leaving)return;
    leaving=true;
    const navigate=()=>window.location.assign(destination.href);
    const animation=content.animate(
      [{transform:'translateY(0)'},{transform:'translateY(-4px)'}],
      {duration:155,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'}
    );
    animation.onfinish=navigate;
    window.setTimeout(navigate,260);
  });
})();
