export interface SkipLinkProps {
  href: string;
  label: string;
}

/** Visually hidden until focused — jumps to main content or landmarks. */
export function SkipLink({ href, label }: SkipLinkProps) {
  return (
    <a
      href={href}
      className="abs-skip-link"
      onClick={e => {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target instanceof HTMLElement) {
          target.focus({ preventScroll: false });
          target.scrollIntoView({ block: 'nearest' });
        }
      }}
    >
      {label}
    </a>
  );
}
