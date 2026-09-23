import { useEffect } from 'react';

/**
 * Public resume at /resume (tutamall.com + onlinemall.website).
 * Vite serves fe/public/resume.pdf as /resume.pdf; production BE also serves /resume inline.
 */
export default function ResumePage() {
  useEffect(() => {
    window.location.replace('/resume.pdf');
  }, []);

  return null;
}
