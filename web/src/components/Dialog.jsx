import React, { useEffect, useRef } from 'react';
export function Dialog({ children, onClose, titleId, className = 'ras-modal open' }) {
  const ref = useRef(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement, previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const items = () => [...ref.current.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')];
    items()[0]?.focus();
    function keydown(event) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = items(), first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); ref.current.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <><div className="overlay open" onClick={onClose} aria-hidden="true"/>
    <div ref={ref} className={className} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>{children}</div></>;
}
