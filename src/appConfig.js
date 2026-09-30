// Per-page camera bindings.
//
// Today both the waterer and feeder look at the same physical camera
// (aimed at the crate where both dispensers sit). Splitting them here
// lets us swap either independently later without touching page code.
// A page whose value doesn't resolve to a discovered camera simply
// omits the camera section.
export const PAGE_CAMERAS = {
  waterer: 'crate-inside',
  feeder: 'crate-inside',
};
