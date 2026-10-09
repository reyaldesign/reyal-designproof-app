// Proofs are previews, not final artwork. Keeping uploads small also keeps them well under the proxy's request limit.
export const MAX_IMAGE_MB = 10;
export const MAX_PDF_MB = 30;
export const MAX_UPLOAD_MB = 40; // all files in one upload together
export const MAX_PDF_PAGES = 60;
export const MAX_ATTACH_MB = 25; // one file attached to a ClickUp task; all of them together stay under MAX_UPLOAD_MB
