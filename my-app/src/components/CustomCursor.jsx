// import { useEffect, useRef } from 'react';

// export default function CustomCursor() {
//   const dotRef  = useRef(null);
//   const ringRef = useRef(null);

//   useEffect(() => {
//     const dot  = dotRef.current;
//     const ring = ringRef.current;
//     if (!dot || !ring) return;

//     let mouseX = window.innerWidth  / 2;
//     let mouseY = window.innerHeight / 2;
//     let ringX  = mouseX;
//     let ringY  = mouseY;
//     let rafId;


//     const onMove = (e) => {
//       mouseX = e.clientX;
//       mouseY = e.clientY;
//       dot.style.left = mouseX + 'px';
//       dot.style.top  = mouseY + 'px';
//     };


//     const lerp = (a, b, t) => a + (b - a) * t;
//     const animateRing = () => {
//       ringX = lerp(ringX, mouseX, 0.14);
//       ringY = lerp(ringY, mouseY, 0.14);
//       ring.style.left = ringX + 'px';
//       ring.style.top  = ringY + 'px';
//       rafId = requestAnimationFrame(animateRing);
//     };
//     rafId = requestAnimationFrame(animateRing);


//     const onEnterHover = () => document.body.classList.add('cursor-hover');
//     const onLeaveHover = () => document.body.classList.remove('cursor-hover');

//     const hoverTargets = 'a, button, [role="button"], .xp-nav-tab, .xp-slider, label, select, .xp-expense-item, .xp-week-card-header, .xp-flow-step, .xp-summary-row';

//     const addHoverListeners = () => {
//       document.querySelectorAll(hoverTargets).forEach(el => {
//         el.addEventListener('mouseenter', onEnterHover);
//         el.addEventListener('mouseleave', onLeaveHover);
//       });
//     };
//     addHoverListeners();


//     const observer = new MutationObserver(addHoverListeners);
//     observer.observe(document.body, { childList: true, subtree: true });

//     const onDown = () => document.body.classList.add('cursor-click');
//     const onUp   = () => document.body.classList.remove('cursor-click');


//     const textTargets = 'input[type="text"], input[type="email"], input[type="password"], input[type="number"], textarea';
//     const onTextEnter = () => document.body.classList.add('cursor-text');
//     const onTextLeave = () => document.body.classList.remove('cursor-text');

//     const addTextListeners = () => {
//       document.querySelectorAll(textTargets).forEach(el => {
//         el.addEventListener('mouseenter', onTextEnter);
//         el.addEventListener('mouseleave', onTextLeave);
//         el.addEventListener('focus',      onTextEnter);
//         el.addEventListener('blur',       onTextLeave);
//       });
//     };
//     addTextListeners();

//     window.addEventListener('mousemove',  onMove);
//     window.addEventListener('mousedown',  onDown);
//     window.addEventListener('mouseup',    onUp);


//     return () => {
//       window.removeEventListener('mousemove',  onMove);
//       window.removeEventListener('mousedown',  onDown);
//       window.removeEventListener('mouseup',    onUp);
//       cancelAnimationFrame(rafId);
//       observer.disconnect();
//       document.body.classList.remove('cursor-hover', 'cursor-click', 'cursor-text');
//     };
//   }, []);

//   return (
//     <>
//       <div ref={dotRef}  className="xp-cursor-dot"  aria-hidden="true" />
//       <div ref={ringRef} className="xp-cursor-ring" aria-hidden="true" />
//     </>
//   );
// }