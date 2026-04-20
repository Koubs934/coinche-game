// MOCK DATA — a frozen copy of backend/src/training/reasonTags.json used
// only by the mock review harness. When sockets are wired, replace all
// imports of this file with a `getTrainingTags` socket fetch cached into
// App-level state, then delete this file and _mockReasonTags.json.
//
// Do NOT let this file drift from the backend source. If you edit the
// backend JSON and the mock harness still displays, re-copy the backend file
// verbatim.

import tags from './_mockReasonTags.json';
export default tags;
