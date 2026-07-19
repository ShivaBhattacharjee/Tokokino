# dav1d WebAssembly decoder

`decoder.wasm` is a browser-only AV1 decoder built from dav1d 1.5.2 using
Emscripten 3.1.57 with `-O2`, 8-bit decoding, no native assembly, and no WASM
SIMD. The O2/non-SIMD configuration avoids the WebKit trap seen with the
prebuilt O3 artifact.

SHA-256 (`decoder.wasm`):
`0b61c70f0f76bbc3c565c5e6fb0ca661e13546e75a1b9d386bfc15c8f69f7ea5`

The decoder is distributed under dav1d's BSD 2-Clause license; see
`COPYING-dav1d.txt`. The JavaScript bridge is derived from ogv.js (MIT); see
`COPYING-ogv.txt`.
