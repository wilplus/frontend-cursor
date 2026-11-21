/** Lets a prompt file be imported as raw text. The experiments loader reads it. */
declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
