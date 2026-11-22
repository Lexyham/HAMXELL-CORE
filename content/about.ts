/**
 * Content for /about. Edit this file; nothing else needs to change.
 * - `founder` renders only when `name` is filled in.
 * - `cv` renders a download link only when `path` is set (put the file in /public, for example /cv.pdf).
 */
export const ABOUT = {
  identity: [
    'HAMXELL CORE is a technology laboratory. It builds software, AI products and experimental systems.',
    'The public site is the headquarters: every public product has its own page, published documentation and licence. Work in progress is listed with an honest status.',
  ],
  founder: { name: '', role: '', bio: [] as string[] },
  cv: { path: '', label: 'Download CV' },
};
