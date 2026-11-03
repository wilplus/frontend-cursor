/* -------------------------------------------------------------------------- */
/*  A photo on its way from the "+" (backend N351). The platform refuses a    */
/*  request body over about 4.5 MB before the backend sees it, and a phone's  */
/*  camera often makes a bigger photo. So a photo over 4 MB is redrawn in the */
/*  browser, as a JPEG at most 2048px on its longest side; a smaller one goes */
/*  as it is. Anything that fails on the way sends it as it is: the platform  */
/*  or the backend then refuses it, and nothing new shows, as for any failed  */
/*  send.                                                                     */
/* -------------------------------------------------------------------------- */

const SEND_AS_IS_BYTES = 4 * 1024 * 1024;
const LONGEST_SIDE = 2048;

export async function photoForUpload(file: File): Promise<{ blob: Blob; name: string }> {
  const asIs = { blob: file as Blob, name: file.name };
  if (file.size <= SEND_AS_IS_BYTES || typeof createImageBitmap !== "function") return asIs;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size === 0 || blob.size >= file.size) return asIs;
    // Its own name, now ending in .jpg; a photo's name is never on screen.
    return { blob, name: `${file.name.replace(/\.[^./]*$/, "") || file.name}.jpg` };
  } catch {
    return asIs;
  }
}
