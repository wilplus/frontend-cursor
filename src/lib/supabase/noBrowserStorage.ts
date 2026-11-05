/* -------------------------------------------------------------------------- */
/*  The browser's stand-in for @supabase/storage-js.                          */
/*                                                                            */
/*  supabase-js builds a Storage client in its constructor, so every page     */
/*  (the root layout's side-effect components make the browser client on all */
/*  of them) downloaded Supabase Storage, the iceberg catalog it carries and, */
/*  through one `typeof Buffer` check, a Node Buffer polyfill: about 13 kB    */
/*  gzipped that nothing in the browser calls. Recordings, decks and files go */
/*  through the BFF routes and the backend, never through Supabase Storage    */
/*  from the browser.                                                         */
/*                                                                            */
/*  next.config.mjs points the CLIENT bundles' `@supabase/storage-js` here;   */
/*  the server and edge bundles keep the real one. A browser call to          */
/*  `supabase.storage` now fails loudly instead of quietly working, which is  */
/*  the point: one belongs behind a BFF route, or the alias goes.             */
/* -------------------------------------------------------------------------- */

const NOT_IN_THE_BROWSER =
  "Supabase Storage is not in the browser bundle (next.config.mjs, src/lib/supabase/noBrowserStorage.ts). Go through a BFF route.";

/** What supabase-js constructs as `client.storage`. It takes the real
 *  client's arguments and holds none of them. */
export class StorageClient {
  constructor(..._args: unknown[]) {}

  from(..._args: unknown[]): never {
    throw new Error(NOT_IN_THE_BROWSER);
  }
}
